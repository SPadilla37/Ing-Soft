from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks
from sqlalchemy import or_, select
from app.db.database import SessionLocal
from app.db.models.entities import Intercambio, IntercambioFinalizacion, Reseña, Usuario, Habilidad
from app.schemas import MatchFinalizePayload, MatchRatePayload
from app.services.email import send_notification_email
from app.services.notifications import push_notification
from app.services.core import (
    ensure_user,
    get_match_for_users,
    serialize_intercambio_for_user,
    serialize_intercambio_for_viewer,
    serialize_user,
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

            serialized = serialize_intercambio_for_viewer(session, intercambio, user_id)

            emisor = session.get(Usuario, intercambio.usuario_emisor_id)
            if emisor:
                user_data = serialize_user(emisor, session)
                serialized["nombre"] = user_data["nombre"]
                serialized["apellido"] = user_data["apellido"]
                serialized["biografia"] = user_data["biografia"]
                serialized["foto_url"] = user_data["foto_url"]
                serialized["rating"] = user_data["rating"]
                serialized["habilidades_ofertadas"] = user_data["habilidades_ofertadas"]
                serialized["habilidades_buscadas"] = user_data["habilidades_buscadas"]

            items.append(serialized)

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
def finalize_match(match_id: int, payload: MatchFinalizePayload, background_tasks: BackgroundTasks) -> dict:
    with SessionLocal() as session:
        intercambio = session.get(Intercambio, match_id)
        if not intercambio:
            raise HTTPException(status_code=404, detail="Match no encontrado")

        if payload.user_id not in {intercambio.usuario_emisor_id, intercambio.usuario_receptor_id}:
            raise HTTPException(status_code=403, detail="No perteneces a este match")

        if intercambio.estado not in {"aceptado", "completado"}:
            raise HTTPException(status_code=400, detail="Solo puedes finalizar matches aceptados")

        if intercambio.estado == "aceptado":
            existing_confirmation = session.execute(
                select(IntercambioFinalizacion).where(
                    IntercambioFinalizacion.intercambio_id == match_id,
                    IntercambioFinalizacion.usuario_id == payload.user_id,
                )
            ).scalars().first()

            if not existing_confirmation:
                session.add(
                    IntercambioFinalizacion(
                        intercambio_id=match_id,
                        usuario_id=payload.user_id,
                        created_at=datetime.now(timezone.utc),
                    )
                )
                session.flush()

            confirmations = session.execute(
                select(IntercambioFinalizacion).where(
                    IntercambioFinalizacion.intercambio_id == match_id,
                    IntercambioFinalizacion.usuario_id.in_([
                        intercambio.usuario_emisor_id,
                        intercambio.usuario_receptor_id,
                    ]),
                )
            ).scalars().all()

            confirmed_users = {item.usuario_id for item in confirmations}
            if (
                intercambio.usuario_emisor_id in confirmed_users
                and intercambio.usuario_receptor_id in confirmed_users
            ):
                pair_rows = session.execute(
                    select(Intercambio).where(
                        or_(
                            (Intercambio.usuario_emisor_id == intercambio.usuario_emisor_id) & (Intercambio.usuario_receptor_id == intercambio.usuario_receptor_id),
                            (Intercambio.usuario_emisor_id == intercambio.usuario_receptor_id) & (Intercambio.usuario_receptor_id == intercambio.usuario_emisor_id),
                        ),
                        Intercambio.estado == "aceptado",
                    )
                ).scalars().all()

                for row in pair_rows:
                    row.estado = "completado"

                # Notificar a ambos usuarios que el match fue completado
                for uid in [intercambio.usuario_emisor_id, intercambio.usuario_receptor_id]:
                    background_tasks.add_task(push_notification, uid, {"type": "badge_update"})
                    background_tasks.add_task(push_notification, uid, {"type": "match_completed", "match_id": match_id})
            else:
                # One user has confirmed, the other hasn't. Send email notification.
                other_user_id = intercambio.usuario_receptor_id if payload.user_id == intercambio.usuario_emisor_id else intercambio.usuario_emisor_id
                
                # Check if the other user has already confirmed
                if other_user_id not in confirmed_users:
                    background_tasks.add_task(push_notification, other_user_id, {"type": "badge_update"})
                    sender = session.get(Usuario, payload.user_id)
                    receiver = session.get(Usuario, other_user_id)
                    hab_ofrecida = session.get(Habilidad, intercambio.habilidad_id)
                    hab_solicitada = session.get(Habilidad, intercambio.habilidad_solicitada_id)
                    
                    # Ensure we send the correct perspective
                    # If I am finalizer (payload.user_id), and I offered X for Y.
                    # The receiver is receiving my finalization request.
                    
                    if sender and receiver and hab_ofrecida and hab_solicitada and receiver.email:
                        context = {
                            "user_name": receiver.nombre,
                            "sender_name": f"{sender.nombre} {sender.apellido}",
                            "skill_offered": hab_ofrecida.nombre,
                            "skill_requested": hab_solicitada.nombre,
                            "frontend_url": "http://localhost:3000/Ing-Soft/Frontend"
                        }
                        background_tasks.add_task(
                            send_notification_email,
                            subject="Confirmación de finalización requerida",
                            email_to=receiver.email,
                            template_name="esperando_respuesta.html",
                            context=context
                        )

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
