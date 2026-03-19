import os
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.security import pwd_context, verify_password, create_access_token
from app.db.database import SessionLocal
from app.db.models.entities import User
from app.schemas.contracts import UserRegisterPayload, UserLoginPayload
from app.services.core import serialize_user


router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


@router.post("/register", response_model=dict)
def register_user(payload: UserRegisterPayload) -> dict:
    email = payload.email.strip().lower()
    with SessionLocal() as session:
        existing = session.get(User, email)
        if existing and existing.password_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ese correo ya esta registrado"
            )

        now = datetime.now(timezone.utc)
        if not existing:
            existing = User(
                id=email,
                name=payload.name.strip(),
                password_hash=pwd_context.hash(payload.password),
                created_at=now,
                updated_at=now,
            )
            session.add(existing)
        else:
            existing.name = payload.name.strip()
            existing.password_hash = pwd_context.hash(payload.password)
            existing.updated_at = now

        session.commit()
        session.refresh(existing)
        return {"user": serialize_user(existing, session)}


@router.post("/login", response_model=Token)
def login_user(form_data: OAuth2PasswordRequestForm = Depends()) -> Token:
    email = form_data.username.strip().lower()
    password = form_data.password
    with SessionLocal() as session:
        user = session.get(User, email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Correo o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        access_token = create_access_token(data={"sub": user.id})
        return {"access_token": access_token, "token_type": "bearer"}

