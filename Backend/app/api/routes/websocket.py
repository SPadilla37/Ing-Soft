import json
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from app.db.database import SessionLocal
from app.db.models import ChatMessageModel, ConversationModel, ConversationParticipant
from app.services.core import is_conversation_hidden_for_user, serialize_message, utc_now_iso
from app.services.websocket import manager


router = APIRouter()


async def chat_socket_impl(websocket: WebSocket, conversation_id: str, user_id: str) -> None:
    with SessionLocal() as session:
        conversation = session.get(ConversationModel, conversation_id)
        if not conversation:
            await websocket.close(code=1008, reason="Conversacion no encontrada")
            return

        membership = session.get(
            ConversationParticipant,
            {"conversation_id": conversation_id, "user_id": user_id},
        )
        if not membership:
            await websocket.close(code=1008, reason="No autorizado para esta conversacion")
            return

        if is_conversation_hidden_for_user(session, conversation_id, user_id):
            await websocket.close(code=1008, reason="Conversacion oculta para este usuario")
            return

        history = session.execute(
            select(ChatMessageModel)
            .where(ChatMessageModel.conversation_id == conversation_id)
            .order_by(ChatMessageModel.sent_at.asc())
        ).scalars().all()

    await manager.connect(conversation_id, user_id, websocket)
    await websocket.send_text(
        json.dumps(
            {
                "type": "history",
                "messages": [serialize_message(m) for m in history],
            }
        )
    )

    await manager.broadcast(
        conversation_id,
        {
            "type": "presence",
            "event": "joined",
            "user_id": user_id,
            "at": utc_now_iso(),
        },
    )

    try:
        while True:
            raw_text = await websocket.receive_text()
            incoming = json.loads(raw_text)
            message_type = incoming.get("type")

            if message_type != "message":
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "detail": "Formato invalido. Usa {type: 'message', content: '...'}",
                        }
                    )
                )
                continue

            content = str(incoming.get("content", "")).strip()
            if not content:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Mensaje vacio"}))
                continue

            with SessionLocal() as session:
                message = ChatMessageModel(
                    id=str(uuid4()),
                    conversation_id=conversation_id,
                    from_user_id=user_id,
                    content=content,
                    sent_at=datetime.now(timezone.utc),
                )
                session.add(message)
                session.commit()
                session.refresh(message)

            serialized = serialize_message(message)

            await manager.broadcast(
                conversation_id,
                {
                    "type": "chat_message",
                    "message": serialized,
                },
            )
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, user_id)
        await manager.broadcast(
            conversation_id,
            {
                "type": "presence",
                "event": "left",
                "user_id": user_id,
                "at": utc_now_iso(),
            },
        )


@router.websocket("/ws/{conversation_id}/{user_id}")
async def chat_socket_alias(websocket: WebSocket, conversation_id: str, user_id: str) -> None:
    await chat_socket_impl(websocket, conversation_id, user_id)