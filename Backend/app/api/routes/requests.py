from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select
from app.db.database import SessionLocal
from app.db.models.entities_2 import Intercambio, Conversacion
from app.schemas import MarketplaceAcceptRequest, MessageRequestCreate, MessageRequestResponse
from app.services.core import (
    PUBLIC_MARKETPLACE_USER_ID,
    create_conversation_for_intercambio,
    ensure_user,
    get_match_for_users,
    serialize_intercambio_for_viewer,
    serialize_intercambio_with_names,
)


router = APIRouter()


@router.post("/message-requests")
def create_message_request(payload: MessageRequestCreate) -> dict:
    if payload.to_user_id and payload.from_user_id == payload.to_user_id:
        raise HTTPException(status_code=400, detail="No puedes enviarte solicitud a ti mismo")

    with SessionLocal() as session:
        ensure_user(session, payload.from_user_id)
        if payload.to_user_id:
            ensure_user(session, payload.to_user_id)
            receptor_id = payload.to_user_id
        else:
            receptor_id = PUBLIC_MARKETPLACE_USER_ID

        now = datetime.now(timezone.utc)
        intercambio = Intercambio(
            usuario_emisor_id=payload.from_user_id,
            usuario_receptor_id=receptor_id,
            habilidad_id=payload.habilidad_id,
            habilidad_solicitada_id=payload.habilidad_solicitada_id,
            mensaje=payload.mensaje,
            estado="pendiente",
            fecha_creacion=now,
        )
        session.add(intercambio)
        session.commit()
        session.refresh(intercambio)
        return {"request": serialize_intercambio_with_names(session, intercambio)}


@router.get("/marketplace/requests")
def list_marketplace_requests(
    viewer_user_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    with SessionLocal() as session:
        stmt = select(Intercambio).where(
            Intercambio.estado == "pendiente",
            Intercambio.usuario_receptor_id == PUBLIC_MARKETPLACE_USER_ID,
        )

        if viewer_user_id:
            stmt = stmt.where(Intercambio.usuario_emisor_id != viewer_user_id)

        intercambios = session.execute(
            stmt.order_by(Intercambio.fecha_creacion.desc())
        ).scalars().all()

        serialized = []
        for item in intercambios:
            ser = serialize_intercambio_for_viewer(session, item, viewer_user_id)
            if viewer_user_id and ser.get("viewer_match_state") == "matched":
                continue
            serialized.append(ser)

        return {"requests": serialized}


@router.post("/marketplace/requests/{request_id}/accept")
def accept_marketplace_request(request_id: int, payload: MarketplaceAcceptRequest) -> dict:
    with SessionLocal() as session:
        intercambio = session.get(Intercambio, request_id)
        if not intercambio:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if intercambio.estado != "pendiente":
            raise HTTPException(status_code=400, detail="Esta solicitud ya no esta disponible")

        if intercambio.usuario_receptor_id != PUBLIC_MARKETPLACE_USER_ID:
            raise HTTPException(status_code=400, detail="Esta solicitud no es publica")

        ensure_user(session, payload.viewer_user_id)

        viewer = payload.viewer_user_id
        target = intercambio.usuario_emisor_id

        if viewer == target:
            raise HTTPException(status_code=400, detail="No puedes aceptar tu propia solicitud")

        existing_match = get_match_for_users(session, viewer, target)
        if existing_match:
            conv = session.execute(
                select(Conversacion).where(
                    or_(
                        (Conversacion.usuario_1_id == existing_match.usuario_emisor_id) & (Conversacion.usuario_2_id == existing_match.usuario_receptor_id),
                        (Conversacion.usuario_1_id == existing_match.usuario_receptor_id) & (Conversacion.usuario_2_id == existing_match.usuario_emisor_id),
                    )
                )
            ).scalars().first()
            return {
                "request": serialize_intercambio_for_viewer(session, intercambio, viewer),
                "matched": True,
                "conversation_id": conv.id if conv else None,
                "match_state": "matched",
            }

        matched = session.execute(
            select(Intercambio).where(
                Intercambio.usuario_emisor_id == viewer,
                Intercambio.usuario_receptor_id == target,
                Intercambio.estado == "pendiente",
            )
        ).scalars().first()

        conversation_id = None
        match_state = "sent"

        if matched:
            now = datetime.now(timezone.utc)
            acepted_intercambio = Intercambio(
                usuario_emisor_id=viewer,
                usuario_receptor_id=target,
                habilidad_id=getattr(matched, "habilidad_id", None),
                habilidad_solicitada_id=getattr(matched, "habilidad_solicitada_id", None),
                mensaje=getattr(matched, "mensaje", ""),
                estado="aceptado",
                fecha_creacion=now,
            )
            session.add(acepted_intercambio)
            session.flush()
            conversation_id = create_conversation_for_intercambio(session, acepted_intercambio)
            match_state = "matched"

        session.commit()

        return {
            "request": serialize_intercambio_for_viewer(session, intercambio, viewer),
            "matched": matched is not None,
            "match_state": match_state,
            "conversation_id": conversation_id,
        }


@router.delete("/message-requests/{request_id}")
def delete_own_message_request(request_id: int, user_id: int = Query(..., min_length=1)) -> dict:
    with SessionLocal() as session:
        intercambio = session.get(Intercambio, request_id)
        if not intercambio:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if intercambio.usuario_emisor_id != user_id:
            raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias solicitudes")

        if intercambio.estado != "pendiente" or intercambio.usuario_receptor_id != PUBLIC_MARKETPLACE_USER_ID:
            raise HTTPException(status_code=400, detail="Solo puedes borrar solicitudes publicas pendientes")

        session.delete(intercambio)
        session.commit()
        return {"deleted": True, "request_id": request_id}


@router.get("/message-requests/{user_id}/incoming")
def get_incoming_requests(user_id: int) -> dict:
    with SessionLocal() as session:
        ensure_user(session, user_id)
        intercambios = session.execute(
            select(Intercambio)
            .where(Intercambio.usuario_receptor_id == user_id)
            .order_by(Intercambio.fecha_creacion.desc())
        ).scalars().all()
        return {"requests": [serialize_intercambio_with_names(session, item) for item in intercambios]}


@router.get("/message-requests/{user_id}/outgoing")
def get_outgoing_requests(user_id: int) -> dict:
    with SessionLocal() as session:
        ensure_user(session, user_id)
        intercambios = session.execute(
            select(Intercambio)
            .where(Intercambio.usuario_emisor_id == user_id)
            .order_by(Intercambio.fecha_creacion.desc())
        ).scalars().all()
        return {"requests": [serialize_intercambio_with_names(session, item) for item in intercambios]}


@router.patch("/message-requests/{request_id}/respond")
def respond_message_request(request_id: int, payload: MessageRequestResponse) -> dict:
    if payload.action not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="La accion debe ser accept o reject")

    with SessionLocal() as session:
        intercambio = session.get(Intercambio, request_id)
        if not intercambio:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if payload.user_id != intercambio.usuario_receptor_id:
            raise HTTPException(status_code=403, detail="Solo el receptor puede responder la solicitud")

        if intercambio.estado != "pendiente":
            raise HTTPException(status_code=400, detail="Esta solicitud ya fue respondida")

        if payload.action == "accept":
            intercambio.estado = "aceptado"
            conversation_id = create_conversation_for_intercambio(session, intercambio)
        else:
            intercambio.estado = "cancelado"
            conversation_id = None

        session.commit()
        session.refresh(intercambio)
        return {
            "request": serialize_intercambio_with_names(session, intercambio),
            "conversation_id": conversation_id,
        }
