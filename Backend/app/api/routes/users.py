from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.db.database import SessionLocal
from app.db.models import User
from app.schemas import UserProfileUpdatePayload
from app.services.core import encode_skills, serialize_user


router = APIRouter()


@router.get("/usuarios/{user_id}")
def get_user(user_id: str) -> dict:
    with SessionLocal() as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return {"user": serialize_user(user, session)}


@router.put("/usuarios/{user_id}/profile")
def update_user_profile(user_id: str, payload: UserProfileUpdatePayload) -> dict:
    with SessionLocal() as session:
        user = session.get(User, user_id)
        if not user:
            now = datetime.now(timezone.utc)
            user = User(id=user_id, created_at=now, updated_at=now)
            session.add(user)

        if payload.name is not None:
            user.name = payload.name.strip()
        if payload.bio is not None:
            user.bio = payload.bio.strip()
        if payload.city is not None:
            user.city = payload.city.strip()
        if payload.language is not None:
            user.language = payload.language.strip()
        if payload.teach_skills is not None:
            user.teach_skills = encode_skills(payload.teach_skills)
        if payload.learn_skills is not None:
            user.learn_skills = encode_skills(payload.learn_skills)
        if payload.marketplace_message is not None:
            user.marketplace_message = payload.marketplace_message.strip()

        user.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(user)
        return {"user": serialize_user(user, session)}