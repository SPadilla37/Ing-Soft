from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from sqlalchemy import or_, select
from app.db.database import SessionLocal
from app.db.models.entities import Intercambio, Conversacion, Habilidad, Usuario, UsuarioHabilidad
from app.schemas import MarketplaceAcceptRequest, MessageRequestCreate, MessageRequestResponse
from app.services.email import send_notification_email
from app.services.core import (
    calculate_received_rating,
    create_conversation_for_intercambio,
    ensure_user,
    get_match_for_users,
    get_user_habilidades,
    serialize_intercambio_for_viewer,
    serialize_intercambio_with_names,
    serialize_habilidad,
)


router = APIRouter()


def _is_public_marketplace_request(intercambio: Intercambio) -> bool:
    # Public requests are represented as self-addressed rows to keep FK integrity.
    return intercambio.usuario_receptor_id == intercambio.usuario_emisor_id


@router.get("/marketplace/habilidades")
def list_marketplace_habilidades(
    viewer_user_id: int = Query(...),
    q: str | None = Query(default=None),
) -> dict:
    with SessionLocal() as session:
        viewer = session.get(Usuario, viewer_user_id)
        if not viewer:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        viewer_ofertadas = get_user_habilidades(session, viewer_user_id, "ofertada")
        viewer_buscadas = get_user_habilidades(session, viewer_user_id, "buscada")

        viewer_ofertadas_ids = {h.id for h in viewer_ofertadas}
        viewer_buscadas_ids = {h.id for h in viewer_buscadas}

        all_users = session.execute(
            select(Usuario).where(
                Usuario.id != viewer_user_id,
                Usuario.role == "user",
            )
        ).scalars().all()

        compatible_users = []
        for user in all_users:
            user_ofertadas = get_user_habilidades(session, user.id, "ofertada")
            user_buscadas = get_user_habilidades(session, user.id, "buscada")

            user_ofertadas_ids = {h.id for h in user_ofertadas}
            user_buscadas_ids = {h.id for h in user_buscadas}

            if viewer_buscadas_ids & user_ofertadas_ids and viewer_ofertadas_ids & user_buscadas_ids:
                compatible_users.append(user)

        result = []
        for user in compatible_users:
            user_ofertadas = get_user_habilidades(session, user.id, "ofertada")
            user_buscadas = get_user_habilidades(session, user.id, "buscada")

            habilidades_ofertadas = [serialize_habilidad(h) for h in user_ofertadas]
            habilidades_buscadas = [serialize_habilidad(h) for h in user_buscadas]

            existing_match = get_match_for_users(session, viewer_user_id, user.id)

            viewer_sent = session.execute(
                select(Intercambio).where(
                    Intercambio.usuario_emisor_id == viewer_user_id,
                    Intercambio.usuario_receptor_id == user.id,
                    Intercambio.estado == "pendiente",
                )
            ).scalars().first()

            viewer_received = session.execute(
                select(Intercambio).where(
                    Intercambio.usuario_receptor_id == viewer_user_id,
                    Intercambio.usuario_emisor_id == user.id,
                    Intercambio.estado == "pendiente",
                )
            ).scalars().first()

            if existing_match:
                match_state = "matched"
            elif viewer_sent and viewer_received:
                match_state = "mutual-pending"
            elif viewer_sent:
                match_state = "sent"
            elif viewer_received:
                match_state = "received"
            else:
                match_state = "none"

            match_conv = None
            if existing_match:
                conv = session.execute(
                    select(Conversacion).where(
                        or_(
                            (Conversacion.usuario_1_id == existing_match.usuario_emisor_id) & (Conversacion.usuario_2_id == existing_match.usuario_receptor_id),
                            (Conversacion.usuario_1_id == existing_match.usuario_receptor_id) & (Conversacion.usuario_2_id == existing_match.usuario_emisor_id),
                        )
                    )
                ).scalars().first()
                if conv:
                    match_conv = conv.id

            user_result = {
                "id": user.id,
                "nombre": user.nombre,
                "apellido": user.apellido,
                "username": user.username,
                "foto_url": user.foto_url or "",
                "biografia": user.biografia or "",
                "habilidades_ofertadas": habilidades_ofertadas,
                "habilidades_buscadas": habilidades_buscadas,
                "viewer_match_state": match_state,
                "viewer_conversation_id": match_conv,
                "rating": calculate_received_rating(session, user.id),
            }

            if q:
                q_lower = q.lower()
                matches = False
                for h in user_ofertadas:
                    if q_lower in h.nombre.lower():
                        matches = True
                        break
                for h in user_buscadas:
                    if q_lower in h.nombre.lower():
                        matches = True
                        break
                if not matches:
                    continue

            result.append(user_result)

        return {"users": result}


@router.post("/message-requests")
def create_message_request(payload: MessageRequestCreate, background_tasks: BackgroundTasks) -> dict:
    if payload.to_user_id and payload.from_user_id == payload.to_user_id:
        raise HTTPException(status_code=400, detail="No puedes enviarte solicitud a ti mismo")

    with SessionLocal() as session:
        ensure_user(session, payload.from_user_id)
        if payload.to_user_id:
            ensure_user(session, payload.to_user_id)
            receptor_id = payload.to_user_id
        else:
            receptor_id = payload.from_user_id

            active_public_requests = session.execute(
                select(Intercambio).where(
                    Intercambio.usuario_emisor_id == payload.from_user_id,
                    Intercambio.usuario_receptor_id == payload.from_user_id,
                    Intercambio.estado == "pendiente",
                )
            ).scalars().all()

            if len(active_public_requests) >= 3:
                raise HTTPException(
                    status_code=400,
                    detail="Ya alcanzaste el limite de 3 publicaciones activas. Borra una para publicar otra.",
                )

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

        if payload.to_user_id:
            reciprocal = session.execute(
                select(Intercambio).where(
                    Intercambio.usuario_emisor_id == payload.to_user_id,
                    Intercambio.usuario_receptor_id == payload.from_user_id,
                    Intercambio.estado == "pendiente",
                )
            ).scalars().first()

            if reciprocal:
                intercambio.estado = "aceptado"
                session.flush()
                conv_id = create_conversation_for_intercambio(session, intercambio)
            else:
                conv_id = None
        else:
            conv_id = None

        session.commit()
        session.refresh(intercambio)
        
        # Email Notification (only if it's not a self-request/public request)
        if payload.to_user_id and intercambio.estado == "pendiente":
            emisor = session.get(Usuario, payload.from_user_id)
            receptor = session.get(Usuario, payload.to_user_id)
            hab_ofertada = session.get(Habilidad, payload.habilidad_solicitada_id)
            hab_buscada = session.get(Habilidad, payload.habilidad_id)
            
            if emisor and receptor and hab_ofertada and hab_buscada and receptor.email:
                context = {
                    "user_name": receptor.nombre,
                    "sender_name": f"{emisor.nombre} {emisor.apellido}",
                    "skill_offered": hab_ofertada.nombre,
                    "skill_requested": hab_buscada.nombre,
                    "frontend_url": "http://localhost:3000/Ing-Soft/Frontend/"  # Replace with env var if needed
                }
                background_tasks.add_task(
                    send_notification_email,
                    subject="Nueva propuesta de intercambio en Habilio",
                    email_to=receptor.email,
                    template_name="nueva_propuesta.html",
                    context=context
                )

        return {
            "request": serialize_intercambio_with_names(session, intercambio),
            "matched": intercambio.estado == "aceptado",
            "conversation_id": conv_id,
        }


@router.get("/marketplace/requests")
def list_marketplace_requests(
    viewer_user_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    with SessionLocal() as session:
        viewer_habilidades_ofertadas_ids: set[int] = set()
        viewer_habilidades_buscadas_ids: set[int] = set()

        if viewer_user_id:
            viewer_habilidades = get_user_habilidades(session, viewer_user_id, "ofertada")
            viewer_habilidades_ofertadas_ids = {h.id for h in viewer_habilidades}
            viewer_habilidades = get_user_habilidades(session, viewer_user_id, "buscada")
            viewer_habilidades_buscadas_ids = {h.id for h in viewer_habilidades}

        stmt = select(Intercambio).where(
            Intercambio.estado == "pendiente",
            Intercambio.usuario_receptor_id == Intercambio.usuario_emisor_id,
        )

        if viewer_user_id:
            stmt = stmt.where(Intercambio.usuario_emisor_id != viewer_user_id)

        intercambios_raw = session.execute(
            stmt.order_by(Intercambio.fecha_creacion.desc())
        ).scalars().all()

        serialized = []
        for item in intercambios_raw:
            if viewer_user_id:
                emisor_habilidades_ofertadas = get_user_habilidades(session, item.usuario_emisor_id, "ofertada")
                emisor_habilidades_buscadas = get_user_habilidades(session, item.usuario_emisor_id, "buscada")
                emisor_habilidades_ofertadas_ids = {h.id for h in emisor_habilidades_ofertadas}
                emisor_habilidades_buscadas_ids = {h.id for h in emisor_habilidades_buscadas}

                viewer_busca_algo = len(viewer_habilidades_buscadas_ids) > 0
                viewer_ofrece_algo = len(viewer_habilidades_ofertadas_ids) > 0
                emisor_busca_algo = len(emisor_habilidades_buscadas_ids) > 0
                emisor_ofrece_algo = len(emisor_habilidades_ofertadas_ids) > 0

                tiene_match = False
                if viewer_busca_algo and emisor_ofrece_algo:
                    if viewer_habilidades_buscadas_ids & emisor_habilidades_ofertadas_ids:
                        tiene_match = True
                if viewer_ofrece_algo and emisor_busca_algo:
                    if viewer_habilidades_ofertadas_ids & emisor_habilidades_buscadas_ids:
                        tiene_match = True

                if not tiene_match:
                    continue

            ser = serialize_intercambio_for_viewer(session, item, viewer_user_id)
            if viewer_user_id and ser.get("viewer_match_state") == "matched":
                continue

            if q:
                q_lower = q.lower()
                matches = False
                if q_lower in (ser.get("mensaje") or "").lower():
                    matches = True
                habilidad = ser.get("habilidad") or {}
                if q_lower in (habilidad.get("nombre") or "").lower():
                    matches = True
                habilidad_sol = ser.get("habilidad_solicitada") or {}
                if q_lower in (habilidad_sol.get("nombre") or "").lower():
                    matches = True
                emisor = ser.get("emisor") or {}
                emisor_name = f"{(emisor.get('nombre') or '')} {(emisor.get('apellido') or '')}".lower()
                if q_lower in emisor_name:
                    matches = True
                if not matches:
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

        if not _is_public_marketplace_request(intercambio):
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

        outgoing = session.execute(
            select(Intercambio).where(
                Intercambio.usuario_emisor_id == viewer,
                Intercambio.usuario_receptor_id == target,
                Intercambio.estado == "pendiente",
            )
        ).scalars().first()

        if not outgoing:
            outgoing = Intercambio(
                usuario_emisor_id=viewer,
                usuario_receptor_id=target,
                habilidad_id=intercambio.habilidad_solicitada_id,
                habilidad_solicitada_id=intercambio.habilidad_id,
                mensaje="Interesado en tu intercambio publico",
                estado="pendiente",
                fecha_creacion=datetime.now(timezone.utc),
            )
            session.add(outgoing)
            session.flush()

        matched = session.execute(
            select(Intercambio).where(
                Intercambio.usuario_emisor_id == target,
                Intercambio.usuario_receptor_id == viewer,
                Intercambio.estado == "pendiente",
            )
        ).scalars().first()

        conversation_id = None
        match_state = "sent"

        if matched:
            matched.estado = "aceptado"
            outgoing.estado = "aceptado"
            session.flush()
            conversation_id = create_conversation_for_intercambio(session, outgoing)
            match_state = "matched"

        session.commit()
        session.refresh(intercambio)
        session.refresh(outgoing)
        if matched:
            session.refresh(matched)

        return {
            "request": serialize_intercambio_for_viewer(session, intercambio, viewer),
            "matched": matched is not None,
            "match_state": match_state,
            "conversation_id": conversation_id,
        }


@router.delete("/message-requests/{request_id}")
def delete_own_message_request(request_id: int, user_id: int = Query(...)) -> dict:
    with SessionLocal() as session:
        intercambio = session.get(Intercambio, request_id)
        if not intercambio:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if intercambio.usuario_emisor_id != user_id:
            raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias solicitudes")

        if intercambio.estado != "pendiente" or not _is_public_marketplace_request(intercambio):
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
