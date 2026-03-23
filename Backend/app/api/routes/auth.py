import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select

from app.core.security import pwd_context, verify_password, create_access_token
from app.db.database import SessionLocal
from app.db.models.entities import Usuario
from app.schemas.contracts import UserRegisterPayload
from app.services.core import serialize_user


router = APIRouter(prefix="/auth", tags=["auth"])


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


_ = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")


@router.post("/register", response_model=dict)
def register_user(payload: UserRegisterPayload) -> dict:
    email = payload.email.strip().lower()
    username = payload.username.strip()

    with SessionLocal() as session:
        existing = session.execute(
            select(Usuario).where(Usuario.email == email)
        ).scalars().first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ese correo ya esta registrado",
            )

        now = datetime.now(timezone.utc)
        user = Usuario(
            username=username,
            email=email,
            password_hash=pwd_context.hash(payload.password),
            clerk_id=payload.clerk_id or "",
            # Valores iniciales mínimos para que el perfil pueda renderizarse;
            # luego el onboarding sobrescribe nombre/apellido/biografia/habilidades.
            nombre=username,
            apellido="",
            fecha_registro=now,
            ultimo_login=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        access_token = create_access_token(data={"sub": user.id})
        return {
            "user": serialize_user(user, session),
            "access_token": access_token,
            "token_type": "bearer",
        }


@router.post("/login", response_model=dict)
def login_user(form_data: OAuth2PasswordRequestForm = Depends()) -> dict:
    email = form_data.username.strip().lower()
    password = form_data.password

    with SessionLocal() as session:
        user = session.execute(
            select(Usuario).where(Usuario.email == email)
        ).scalars().first()

        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Correo o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user.ultimo_login = datetime.now(timezone.utc)
        session.commit()
        session.refresh(user)

        access_token = create_access_token(data={"sub": user.id})
        return {
            "user": serialize_user(user, session),
            "access_token": access_token,
            "token_type": "bearer",
        }

