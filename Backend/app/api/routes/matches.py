from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select
from app.db.database import SessionLocal
from app.db.models import MatchIntentModel, MatchModel
from app.schemas import MatchFinalizePayload, MatchRatePayload
from app.services.core import (
    PUBLIC_MARKETPLACE_USER,
    get_match_for_users,
    get_match_intent,
    get_match_side,
    get_user_display_name,
    serialize_match_for_user,
    serialize_request_for_viewer,
)
from app.schemas import RequestStatus


router = APIRouter()


@router.get("/matches/{user_id}/incoming")
def get_incoming_match_intents(user_id: str) -> dict:
    with SessionLocal() as session:
        intents = session.execute(
            select(MatchIntentModel)
            .where(MatchIntentModel.to_user_id == user_id)
            .order_by(MatchIntentModel.created_at.desc())
        ).scalars().all()

        items = []
        for intent in intents:
            if intent.from_user_id == user_id:
                continue

            existing_match = get_match_for_users(session, intent.from_user_id, intent.to_user_id, intent.request_id)
            if existing_match:
                continue

            request_obj = session.get(type("MessageRequestModel"), intent.request_id)
            if not request_obj:
                continue

            items.append(
                {
                    "intent_id": intent.id,
                    "from_user_id": intent.from_user_id,
                    "from_user_name": get_user_display_name(session, intent.from_user_id),
                    "created_at": intent.created_at.isoformat(),
                    "request": serialize_request_for_viewer(session, request_obj, user_id),
                }
            )

        return {"incoming": items}


@router.get("/matches/{user_id}")
def list_user_matches(user_id: str, status: str | None = Query(default=None)) -> dict:
    with SessionLocal() as session:
        stmt = select(MatchModel).where(
            or_(
                MatchModel.user_a_id == user_id,
                MatchModel.user_b_id == user_id,
            )
        )

        if status in {"in_progress", "completed"}:
            stmt = stmt.where(MatchModel.status == status)

        matches = session.execute(
            stmt.order_by(MatchModel.updated_at.desc(), MatchModel.created_at.desc())
        ).scalars().all()

        return {"matches": [serialize_match_for_user(session, match, user_id) for match in matches]}


@router.post("/matches/{match_id}/finalize")
def finalize_match(match_id: str, payload: MatchFinalizePayload) -> dict:
    with SessionLocal() as session:
        match = session.get(MatchModel, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match no encontrado")

        side = get_match_side(match, payload.user_id)
        now = datetime.now(timezone.utc)

        if side == "a":
            match.finalized_by_a = True
        else:
            match.finalized_by_b = True

        if match.finalized_by_a and match.finalized_by_b:
            match.status = "completed"
            if not match.completed_at:
                match.completed_at = now

        match.updated_at = now
        session.commit()
        session.refresh(match)

        return {"match": serialize_match_for_user(session, match, payload.user_id)}


@router.post("/matches/{match_id}/rate")
def rate_match(match_id: str, payload: MatchRatePayload) -> dict:
    with SessionLocal() as session:
        match = session.get(MatchModel, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match no encontrado")

        if (match.status or "in_progress") != "completed":
            raise HTTPException(status_code=400, detail="Solo puedes calificar cuando ambos finalizaron el match")

        side = get_match_side(match, payload.user_id)
        current_rating = match.rating_by_a if side == "a" else match.rating_by_b
        if current_rating is not None:
            raise HTTPException(status_code=400, detail="Ya calificaste este match")

        if side == "a":
            match.rating_by_a = payload.rating
        else:
            match.rating_by_b = payload.rating

        match.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(match)

        return {"match": serialize_match_for_user(session, match, payload.user_id)}