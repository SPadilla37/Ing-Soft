from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import or_, select
from app.db.database import SessionLocal
from app.db.models.entities import Intercambio, Reseña
from app.schemas import MatchFinalizePayload, MatchRatePayload
from app.services.core import (
    ensure_user,
    get_match_for_users,
    serialize_intercambio_for_user,
    serialize_intercambio_for_viewer,
)


router = APIRouter()


@router.get("/matches/{user_id}/incoming")
def get_incoming_match_intents(user_id: int) -> dict:
    with SessionLocal() as session:
        ensure_user(session, user_id)

        incoming = session.execute(
            select(Intercambio)
            .where(
                Intercambio.usuario_receptor_id == user_id,
                Intercambio.estado.in_(["pendiente", "aceptado"]),
            )
            .order_by(Intercambio.fecha_creacion.desc())
        ).scalars().all()

        items = []
        for intercambio in incoming:
            if intercambio.usuario_emisor_id == user_id:
                continue

            existing_match = get_match_for_users(session, user_id, intercambio.usuario_emisor_id)
            if existing_match:
                continue

            items.append(
                serialize_intercambio_for_viewer(session, intercambio, user_id)
            )

        return {"incoming": items}


@router.get("/matches/{user_id}")
def list_user_matches(user_id: int) -> dict:
    with SessionLocal() as session:
        ensure_user(session, user_id)

        intercambios = session.execute(
            select(Intercambio).where(
                or_(
                    Intercambio.usuario_emisor_id == user_id,
                    Intercambio.usuario_receptor_id == user_id,
                ),
                Intercambio.estado.in_(["aceptado", "completado"]),
            ).order_by(Intercambio.fecha_creacion.desc())
        ).scalars().all()

        return {"matches": [serialize_intercambio_for_user(session, item, user_id) for item in intercambios]}


@router.post("/matches/{match_id}/finalize")
def finalize_match(match_id: int, payload: MatchFinalizePayload) -> dict:
    with SessionLocal() as session:
        intercambio = session.get(Intercambio, match_id)
        if not intercambio:
            raise HTTPException(status_code=404, detail="Match no encontrado")

        if payload.user_id not in {intercambio.usuario_emisor_id, intercambio.usuario_receptor_id}:
            raise HTTPException(status_code=403, detail="No perteneces a este match")

        if intercambio.estado not in {"aceptado", "completado"}:
            raise HTTPException(status_code=400, detail="Solo puedes finalizar matches aceptados")

        if intercambio.estado != "completado":
            intercambio.estado = "completado"

        session.commit()
        session.refresh(intercambio)
        return {"match": serialize_intercambio_for_user(session, intercambio, payload.user_id)}


@router.post("/matches/{match_id}/rate")
def rate_match(match_id: int, payload: MatchRatePayload) -> dict:
    with SessionLocal() as session:
        intercambio = session.get(Intercambio, match_id)
        if not intercambio:
            raise HTTPException(status_code=404, detail="Match no encontrado")

        if intercambio.estado != "completado":
            raise HTTPException(status_code=400, detail="Solo puedes calificar cuando el match esta completado")

        if payload.user_id not in {intercambio.usuario_emisor_id, intercambio.usuario_receptor_id}:
            raise HTTPException(status_code=403, detail="No perteneces a este match")

        other_user_id = intercambio.usuario_receptor_id if payload.user_id == intercambio.usuario_emisor_id else intercambio.usuario_emisor_id

        existing = session.execute(
            select(Reseña).where(
                Reseña.intercambio_id == match_id,
                Reseña.autor_id == payload.user_id,
            )
        ).scalars().first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya calificaste este match")

        nueva_reseña = Reseña(
            intercambio_id=match_id,
            autor_id=payload.user_id,
            receptor_id=other_user_id,
            calificacion=payload.rating,
            comentario=payload.comentario,
            created_at=datetime.now(timezone.utc),
        )
        session.add(nueva_reseña)
        session.commit()
        session.refresh(intercambio)
        return {"match": serialize_intercambio_for_user(session, intercambio, payload.user_id)}
