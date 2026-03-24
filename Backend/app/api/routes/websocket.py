import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from app.db.database import SessionLocal
from app.db.models.entities import Conversacion, Mensaje
from app.services.core import can_users_chat, serialize_message, utc_now_iso
from app.services.websocket import manager


router = APIRouter()


async def chat_socket_impl(websocket: WebSocket, conversation_id: int, user_id: int) -> None:
    with SessionLocal() as session:
        conversation = session.get(Conversacion, conversation_id)
        if not conversation:
            await websocket.close(code=1008, reason="Conversacion no encontrada")
            return

        if user_id not in {conversation.usuario_1_id, conversation.usuario_2_id}:
            await websocket.close(code=1008, reason="No autorizado para esta conversacion")
            return

        history = session.execute(
            select(Mensaje)
            .where(Mensaje.conversacion_id == conversation_id)
            .order_by(Mensaje.enviado_at.asc())
        ).scalars().all()

    await manager.connect(str(conversation_id), user_id, websocket)
    await websocket.send_text(
        json.dumps(
            {
                "type": "history",
                "messages": [serialize_message(m) for m in history],
            }
        )
    )

    await manager.broadcast(
        str(conversation_id),
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
            
            try:
                incoming = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "detail": "JSON invalido"
                }))
                continue
            
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
                if not can_users_chat(session, conversation.usuario_1_id, conversation.usuario_2_id):
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "error",
                                "detail": "No puedes enviar mensajes: el match ya fue finalizado",
                            }
                        )
                    )
                    continue

                mensaje = Mensaje(
                    conversacion_id=conversation_id,
                    remitente_id=user_id,
                    contenido=content,
                    enviado_at=datetime.now(timezone.utc),
                )
                session.add(mensaje)
                session.commit()
                session.refresh(mensaje)

            serialized = serialize_message(mensaje)

            await manager.broadcast(
                str(conversation_id),
                {
                    "type": "chat_message",
                    "message": serialized,
                },
            )
    except WebSocketDisconnect:
        manager.disconnect(str(conversation_id), user_id)
        await manager.broadcast(
            str(conversation_id),
            {
                "type": "presence",
                "event": "left",
                "user_id": user_id,
                "at": utc_now_iso(),
            },
        )
    except Exception:
        manager.disconnect(str(conversation_id), user_id)
        try:
            await websocket.close(code=1011, reason="Error interno del servidor")
        except Exception:
            pass


@router.websocket("/ws/{conversation_id}/{user_id}")
async def chat_socket_alias(websocket: WebSocket, conversation_id: int, user_id: int) -> None:
    await chat_socket_impl(websocket, conversation_id, user_id)
