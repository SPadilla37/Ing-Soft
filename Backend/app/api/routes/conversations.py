from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import or_, select
from app.db.database import SessionLocal
from app.db.models.entities import Conversacion, Mensaje
from app.schemas import ChatMessageCreate, ConversationCreatePayload, MessageCreatePayload
from app.services.core import can_users_chat, get_user_display_name, serialize_message


router = APIRouter()


@router.get("/conversations/{user_id}")
def get_user_conversations(user_id: int) -> dict:
    with SessionLocal() as session:
        conversaciones = session.execute(
            select(Conversacion).where(
                or_(
                    Conversacion.usuario_1_id == user_id,
                    Conversacion.usuario_2_id == user_id,
                )
            )
        ).scalars().all()

        result = []
        for conv in conversaciones:
            other_id = conv.usuario_2_id if conv.usuario_1_id == user_id else conv.usuario_1_id
            other_name = get_user_display_name(session, other_id)
            can_chat = can_users_chat(session, conv.usuario_1_id, conv.usuario_2_id)
            result.append({
                "id": conv.id,
                "other_user_id": other_id,
                "other_user_name": other_name,
                "can_chat": can_chat,
            })
        return {"conversations": result}


@router.get("/conversaciones")
def get_conversaciones_alias(user_id: int) -> dict:
    return get_user_conversations(user_id)


@router.post("/conversaciones")
def create_conversation(payload: ConversationCreatePayload) -> dict:
    with SessionLocal() as session:
        if payload.usuario_1_id == payload.usuario_2_id:
            raise HTTPException(status_code=400, detail="No puedes crear una conversacion contigo mismo")

        existing = session.execute(
            select(Conversacion).where(
                or_(
                    (Conversacion.usuario_1_id == payload.usuario_1_id) & (Conversacion.usuario_2_id == payload.usuario_2_id),
                    (Conversacion.usuario_1_id == payload.usuario_2_id) & (Conversacion.usuario_2_id == payload.usuario_1_id),
                )
            )
        ).scalars().first()

        if existing:
            return {"conversation_id": existing.id, "created": False}

        conv = Conversacion(
            usuario_1_id=payload.usuario_1_id,
            usuario_2_id=payload.usuario_2_id,
        )
        session.add(conv)
        session.commit()
        session.refresh(conv)
        return {"conversation_id": conv.id, "created": True}


@router.get("/conversations/{id}/messages")
def get_conversation_messages(id: int, viewer_user_id: int) -> dict:
    with SessionLocal() as session:
        conv = session.get(Conversacion, id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversacion no encontrada")

        if viewer_user_id not in {conv.usuario_1_id, conv.usuario_2_id}:
            raise HTTPException(status_code=403, detail="No perteneces a esta conversacion")

        mensajes = session.execute(
            select(Mensaje)
            .where(Mensaje.conversacion_id == id)
            .order_by(Mensaje.enviado_at.asc())
        ).scalars().all()

        return {"messages": [serialize_message(m) for m in mensajes]}


@router.post("/conversations/{id}/messages")
def create_conversation_message(id: int, payload: ChatMessageCreate) -> dict:
    return send_message(id, payload)


@router.post("/mensajes")
def send_message_alias(payload: MessageCreatePayload) -> dict:
    return send_message(payload.conversation_id, ChatMessageCreate(from_user_id=payload.from_user_id, content=payload.content))


def send_message(conversation_id: int, payload: ChatMessageCreate) -> dict:
    with SessionLocal() as session:
        conv = session.get(Conversacion, conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversacion no encontrada")

        if payload.from_user_id not in {conv.usuario_1_id, conv.usuario_2_id}:
            raise HTTPException(status_code=403, detail="No perteneces a esta conversacion")

        if not can_users_chat(session, conv.usuario_1_id, conv.usuario_2_id):
            raise HTTPException(status_code=403, detail="No puedes enviar mensajes: el match ya fue finalizado")

        mensaje = Mensaje(
            conversacion_id=conversation_id,
            remitente_id=payload.from_user_id,
            contenido=payload.content,
            enviado_at=datetime.now(timezone.utc),
        )
        session.add(mensaje)
        session.commit()
        session.refresh(mensaje)
        return {"message": serialize_message(mensaje)}
