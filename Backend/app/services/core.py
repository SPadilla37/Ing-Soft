from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import or_, select

from app.db.models.entities import (
    Conversacion,
    Habilidad,
    Intercambio,
    Mensaje,
    Reseña,
    Usuario,
    UsuarioHabilidad,
)
from app.services.matching import canonical_match_pair
from app.services.reputation import average_rating


PUBLIC_MARKETPLACE_USER_ID: int = 0


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_user(session, user_id: int) -> None:
    user = session.get(Usuario, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")


def calculate_received_rating(session, user_id: int) -> dict:
    reseñas = session.execute(
        select(Reseña).where(Reseña.receptor_id == user_id)
    ).scalars().all()

    if not reseñas:
        return {"average": None, "count": 0}

    ratings = [int(r.calificacion) for r in reseñas if r.calificacion is not None]
    if not ratings:
        return {"average": None, "count": 0}

    return {"average": average_rating(ratings), "count": len(ratings)}


def get_user_habilidades(session, usuario_id: int, categoria: str) -> List[Habilidad]:
    relaciones = session.execute(
        select(UsuarioHabilidad).where(
            UsuarioHabilidad.usuario_id == usuario_id,
            UsuarioHabilidad.categoria == categoria,
        )
    ).scalars().all()
    habilidades = []
    for rel in relaciones:
        hab = session.get(Habilidad, rel.habilidad_id)
        if hab:
            habilidades.append(hab)
    return habilidades


def serialize_user(user: Usuario, session=None) -> dict:
    rating_info = {"average": None, "count": 0}
    if session is not None:
        rating_info = calculate_received_rating(session, user.id)

    habilidades_ofertadas = []
    habilidades_buscadas = []
    if session is not None:
        ofe = get_user_habilidades(session, user.id, "ofertada")
        bus = get_user_habilidades(session, user.id, "buscada")
        habilidades_ofertadas = [serialize_habilidad(h) for h in ofe]
        habilidades_buscadas = [serialize_habilidad(h) for h in bus]

    return {
        "id": user.id,
        "nombre": user.nombre,
        "apellido": user.apellido,
        "email": user.email,
        "username": user.username,
        "foto_url": user.foto_url or "",
        "biografia": user.biografia or "",
        "fecha_registro": user.fecha_registro.isoformat() if user.fecha_registro else utc_now_iso(),
        "ultimo_login": user.ultimo_login.isoformat() if user.ultimo_login else None,
        "rating": {
            "average": rating_info["average"],
            "count": rating_info["count"],
        },
        "habilidades_ofertadas": habilidades_ofertadas,
        "habilidades_buscadas": habilidades_buscadas,
    }


def serialize_habilidad(habilidad: Habilidad) -> dict:
    return {
        "id": habilidad.id,
        "nombre": habilidad.nombre,
        "categoria": habilidad.categoria,
    }


def serialize_Reseña(reseña: Reseña) -> dict:
    return {
        "id": reseña.id,
        "intercambio_id": reseña.intercambio_id,
        "autor_id": reseña.autor_id,
        "receptor_id": reseña.receptor_id,
        "calificacion": reseña.calificacion,
        "comentario": reseña.comentario,
        "created_at": reseña.created_at.isoformat() if reseña.created_at else utc_now_iso(),
    }


def serialize_intercambio(intercambio: Intercambio) -> dict:
    return {
        "id": intercambio.id,
        "usuario_emisor_id": intercambio.usuario_emisor_id,
        "usuario_receptor_id": intercambio.usuario_receptor_id,
        "mensaje": intercambio.mensaje,
        "estado": intercambio.estado,
        "fecha_creacion": intercambio.fecha_creacion.isoformat() if intercambio.fecha_creacion else utc_now_iso(),
    }


def get_user_display_name(session, user_id: int) -> str | None:
    if not user_id:
        return None
    user = session.get(Usuario, user_id)
    if user and user.nombre and user.nombre.strip():
        return f"{user.nombre.strip()} {user.apellido.strip()}"
    return str(user_id)


def serialize_intercambio_with_names(session, intercambio: Intercambio) -> dict:
    serialized = serialize_intercambio(intercambio)
    emisor = session.get(Usuario, intercambio.usuario_emisor_id)
    receptor = session.get(Usuario, intercambio.usuario_receptor_id)

    serialized["emisor"] = None
    if emisor:
        serialized["emisor"] = {
            "id": emisor.id,
            "nombre": emisor.nombre,
            "apellido": emisor.apellido,
            "foto_url": emisor.foto_url or "",
        }

    serialized["receptor"] = None
    if receptor:
        serialized["receptor"] = {
            "id": receptor.id,
            "nombre": receptor.nombre,
            "apellido": receptor.apellido,
            "foto_url": receptor.foto_url or "",
        }

    habilidad = None
    habilidad_solicitada = None
    habilidad_obj = session.get(Habilidad, getattr(intercambio, "habilidad_id", None))
    if habilidad_obj:
        habilidad = serialize_habilidad(habilidad_obj)
    habilidad_sol_obj = session.get(Habilidad, getattr(intercambio, "habilidad_solicitada_id", None))
    if habilidad_sol_obj:
        habilidad_solicitada = serialize_habilidad(habilidad_sol_obj)

    serialized["habilidad"] = habilidad
    serialized["habilidad_solicitada"] = habilidad_solicitada

    return serialized


def get_match_for_users(
    session,
    user_one_id: int,
    user_two_id: int,
) -> Intercambio | None:
    user_a_id, user_b_id = canonical_match_pair(user_one_id, user_two_id)
    return session.execute(
        select(Intercambio).where(
            or_(
                (Intercambio.usuario_emisor_id == user_a_id) & (Intercambio.usuario_receptor_id == user_b_id),
                (Intercambio.usuario_emisor_id == user_b_id) & (Intercambio.usuario_receptor_id == user_a_id),
            ),
            Intercambio.estado.in_(["aceptado", "completado"]),
        )
    ).scalars().first()


def create_conversation_for_intercambio(session, intercambio: Intercambio) -> int:
    existing = session.execute(
        select(Conversacion).where(
            or_(
                (Conversacion.usuario_1_id == intercambio.usuario_emisor_id) & (Conversacion.usuario_2_id == intercambio.usuario_receptor_id),
                (Conversacion.usuario_1_id == intercambio.usuario_receptor_id) & (Conversacion.usuario_2_id == intercambio.usuario_emisor_id),
            )
        )
    ).scalars().first()
    if existing:
        return existing.id

    conv = Conversacion(
        usuario_1_id=intercambio.usuario_emisor_id,
        usuario_2_id=intercambio.usuario_receptor_id,
    )
    session.add(conv)
    session.flush()
    return conv.id


def serialize_intercambio_for_viewer(
    session,
    intercambio: Intercambio,
    viewer_user_id: int | None,
) -> dict:
    serialized = serialize_intercambio_with_names(session, intercambio)
    serialized["viewer_match_state"] = "none"
    serialized["viewer_conversation_id"] = None

    if not viewer_user_id or viewer_user_id == intercambio.usuario_emisor_id:
        return serialized

    existing_match = get_match_for_users(session, viewer_user_id, intercambio.usuario_emisor_id)
    if existing_match:
        serialized["viewer_match_state"] = "matched"
        existing_conv = session.execute(
            select(Conversacion).where(
                or_(
                    (Conversacion.usuario_1_id == existing_match.usuario_emisor_id) & (Conversacion.usuario_2_id == existing_match.usuario_receptor_id),
                    (Conversacion.usuario_1_id == existing_match.usuario_receptor_id) & (Conversacion.usuario_2_id == existing_match.usuario_emisor_id),
                )
            )
        ).scalars().first()
        if existing_conv:
            serialized["viewer_conversation_id"] = existing_conv.id

        return serialized

    outgoing = session.execute(
        select(Intercambio).where(
            Intercambio.usuario_emisor_id == viewer_user_id,
            Intercambio.usuario_receptor_id == intercambio.usuario_emisor_id,
            Intercambio.estado == "pendiente",
        )
    ).scalars().first()
    if outgoing:
        serialized["viewer_match_state"] = "sent"

    incoming = session.execute(
        select(Intercambio).where(
            Intercambio.usuario_receptor_id == viewer_user_id,
            Intercambio.usuario_emisor_id == intercambio.usuario_emisor_id,
            Intercambio.estado == "pendiente",
        )
    ).scalars().first()
    if incoming:
        serialized["viewer_match_state"] = "mutual-pending" if outgoing else "received"

    return serialized


def serialize_intercambio_for_user(session, intercambio: Intercambio, user_id: int) -> dict:
    if user_id == intercambio.usuario_emisor_id:
        other_user_id = intercambio.usuario_receptor_id
    elif user_id == intercambio.usuario_receptor_id:
        other_user_id = intercambio.usuario_emisor_id
    else:
        raise HTTPException(status_code=403, detail="No perteneces a este intercambio")

    other_user = session.get(Usuario, other_user_id)

    reseñas = session.execute(
        select(Reseña).where(Reseña.intercambio_id == intercambio.id)
    ).scalars().all()

    my_reseña = None
    other_reseña = None
    for r in reseñas:
        if r.autor_id == user_id:
            my_reseña = serialize_Reseña(r)
        if r.autor_id == other_user_id:
            other_reseña = serialize_Reseña(r)

    conversacion = session.execute(
        select(Conversacion).where(
            or_(
                (Conversacion.usuario_1_id == intercambio.usuario_emisor_id) & (Conversacion.usuario_2_id == intercambio.usuario_receptor_id),
                (Conversacion.usuario_1_id == intercambio.usuario_receptor_id) & (Conversacion.usuario_2_id == intercambio.usuario_emisor_id),
            )
        )
    ).scalars().first()

    habilidad_obj = session.get(Habilidad, getattr(intercambio, "habilidad_id", None))
    habilidad = serialize_habilidad(habilidad_obj) if habilidad_obj else None
    habilidad_sol_obj = session.get(Habilidad, getattr(intercambio, "habilidad_solicitada_id", None))
    habilidad_solicitada = serialize_habilidad(habilidad_sol_obj) if habilidad_sol_obj else None

    return {
        "id": intercambio.id,
        "conversation_id": conversacion.id if conversacion else None,
        "estado":intercambio.estado,
        "fecha_creacion":intercambio.fecha_creacion.isoformat() if intercambio.fecha_creacion else utc_now_iso(),
        "other_user_id": other_user_id,
        "other_user_name": get_user_display_name(session, other_user_id) if other_user else str(other_user_id),
        "my_reseña": my_reseña,
        "other_reseña": other_reseña,
        "can_finalize":intercambio.estado == "aceptado",
        "can_rate":intercambio.estado == "completado" and my_reseña is None,
        "habilidad": habilidad,
        "habilidad_solicitada": habilidad_solicitada,
    }


def serialize_message(message: Mensaje) -> dict:
    return {
        "id": message.id,
        "conversation_id": message.conversacion_id,
        "from_user_id": message.remitente_id,
        "content": message.contenido,
        "sent_at": message.enviado_at.isoformat() if message.enviado_at else utc_now_iso(),
    }
