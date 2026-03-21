from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import delete
from app.db.database import SessionLocal
from app.db.models.entities import Usuario, UsuarioHabilidad
from app.schemas import UserProfileUpdatePayload
from app.services.core import serialize_user


router = APIRouter()


@router.get("/usuarios/{user_id}")
def get_user(user_id: int) -> dict:
    with SessionLocal() as session:
        user = session.get(Usuario, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return {"user": serialize_user(user, session)}


@router.put("/usuarios/{user_id}/profile")
def update_user_profile(user_id: int, payload: UserProfileUpdatePayload) -> dict:
    with SessionLocal() as session:
        user = session.get(Usuario, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if payload.nombre is not None:
            user.nombre = payload.nombre.strip()
        if payload.apellido is not None:
            user.apellido = payload.apellido.strip()
        if payload.foto_url is not None:
            user.foto_url = payload.foto_url.strip()
        if payload.biografia is not None:
            user.biografia = payload.biografia.strip()

        if payload.habilidades_ofertadas is not None:
            session.execute(
                delete(UsuarioHabilidad).where(
                    UsuarioHabilidad.usuario_id == user_id,
                    UsuarioHabilidad.categoria == "ofertada",
                )
            )
            for hab_id in payload.habilidades_ofertadas:
                session.add(UsuarioHabilidad(
                    habilidad_id=hab_id,
                    usuario_id=user_id,
                    categoria="ofertada",
                ))

        if payload.habilidades_busçadas is not None:
            session.execute(
                delete(UsuarioHabilidad).where(
                    UsuarioHabilidad.usuario_id == user_id,
                    UsuarioHabilidad.categoria == "buscada",
                )
            )
            for hab_id in payload.habilidades_busçadas:
                session.add(UsuarioHabilidad(
                    habilidad_id=hab_id,
                    usuario_id=user_id,
                    categoria="buscada",
                ))

        session.commit()
        session.refresh(user)
        return {"user": serialize_user(user, session)}
