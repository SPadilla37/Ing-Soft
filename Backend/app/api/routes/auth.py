from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.core.security import create_access_token, hash_password, needs_rehash, verify_password
from app.core.text_moderation import assert_text_is_allowed
from app.db.database import SessionLocal
from app.db.models.entities import Usuario
from app.schemas import AuthTokenResponse, UserLoginPayload, UserRegisterPayload
from app.services.core import serialize_user, utc_now_iso


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": utc_now_iso()}


@router.post("/auth/register")
def register_user(payload: UserRegisterPayload) -> AuthTokenResponse:
    email = payload.email.strip().lower()
    clean_username = payload.username.strip()
    try:
        assert_text_is_allowed("username", clean_username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    with SessionLocal() as session:
        existing = session.execute(
            select(Usuario).where(Usuario.email == email)
        ).scalars().first()

        if existing and existing.password_hash:
            raise HTTPException(status_code=409, detail="Ese correo ya esta registrado")

        existing_username = session.execute(
            select(Usuario).where(Usuario.username == clean_username)
        ).scalars().first()

        if existing_username:
            raise HTTPException(status_code=409, detail="Ese nombre de usuario ya esta en uso")

        now = datetime.now(timezone.utc)
        if not existing:
            existing = Usuario(
                username=clean_username,
                email=email,
                password_hash=hash_password(payload.password),
                clerk_id=payload.clerk_id or "",
                nombre="",
                apellido="",
                fecha_registro=now,
            )
            session.add(existing)
        else:
            existing.username = clean_username
            existing.password_hash = hash_password(payload.password)
            if payload.clerk_id:
                existing.clerk_id = payload.clerk_id

        session.commit()
        session.refresh(existing)

        access_token = create_access_token({
            "sub": str(existing.id),
            "email": existing.email,
            "role": getattr(existing, 'role', 'user')
        })
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": serialize_user(existing, session),
        }


@router.post("/auth/login")
def login_user(payload: UserLoginPayload) -> AuthTokenResponse:
    email = payload.email.strip().lower()
    with SessionLocal() as session:
        user = session.execute(
            select(Usuario).where(Usuario.email == email)
        ).scalars().first()

        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")
        
        if getattr(user, 'is_suspended', False):
            raise HTTPException(status_code=403, detail="ACCOUNT_SUSPENDED")

        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(payload.password)

        user.ultimo_login = datetime.now(timezone.utc)
        session.commit()
        session.refresh(user)

        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": getattr(user, 'role', 'user')
        })
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": serialize_user(user, session),
        }
