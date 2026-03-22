from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.core.security import hash_password
from app.db.database import SessionLocal
from app.db.models.entities import Usuario
from app.schemas import UserLoginPayload, UserRegisterPayload
from app.services.core import serialize_user, utc_now_iso


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": utc_now_iso()}


@router.post("/auth/register")
def register_user(payload: UserRegisterPayload) -> dict:
    email = payload.email.strip().lower()
    with SessionLocal() as session:
        existing = session.execute(
            select(Usuario).where(Usuario.email == email)
        ).scalars().first()

        if existing and existing.password_hash:
            raise HTTPException(status_code=409, detail="Ese correo ya esta registrado")

        now = datetime.now(timezone.utc)
        if not existing:
            existing = Usuario(
                username=payload.username.strip(),
                email=email,
                password_hash=hash_password(payload.password),
                clerk_id=payload.clerk_id or "",
                fecha_registro=now,
            )
            session.add(existing)
        else:
            existing.username = payload.username.strip()
            existing.password_hash = hash_password(payload.password)
            if payload.clerk_id:
                existing.clerk_id = payload.clerk_id

        session.commit()
        session.refresh(existing)
        return {"user": serialize_user(existing, session)}


@router.post("/auth/login")
def login_user(payload: UserLoginPayload) -> dict:
    email = payload.email.strip().lower()
    with SessionLocal() as session:
        user = session.execute(
            select(Usuario).where(Usuario.email == email)
        ).scalars().first()

        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")
        if user.password_hash != hash_password(payload.password):
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")

        user.ultimo_login = datetime.now(timezone.utc)
        session.commit()
        session.refresh(user)
        return {"user": serialize_user(user, session)}
