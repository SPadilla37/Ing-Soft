import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import inspect, or_, select, text
from sqlalchemy.orm import Session

from app.db.database import engine
from app.db.models import (
    ChatMessageModel,
    ConversationModel,
    ConversationParticipant,
    HiddenConversationModel,
    MatchIntentModel,
    MatchModel,
    MessageRequestModel,
    User,
)
from app.services.matching import canonical_match_pair
from app.services.reputation import average_rating


PUBLIC_MARKETPLACE_USER = "__PUBLIC__"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_user(session: Session, user_id: str) -> None:
    user = session.get(User, user_id)
    if not user:
        now = datetime.now(timezone.utc)
        session.add(User(id=user_id, created_at=now, updated_at=now))


def decode_skills(raw_skills: str) -> list[str]:
    try:
        parsed = json.loads(raw_skills or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(skill).strip() for skill in parsed if str(skill).strip()]


def encode_skills(skills: list[str]) -> str:
    normalized = [str(skill).strip() for skill in skills if str(skill).strip()]
    return json.dumps(normalized)


def calculate_received_rating(session: Session, user_id: str) -> dict:
    matches = session.execute(
        select(MatchModel).where(
            or_(
                MatchModel.user_a_id == user_id,
                MatchModel.user_b_id == user_id,
            )
        )
    ).scalars().all()

    ratings: list[int] = []
    for match in matches:
        if match.user_a_id == user_id and match.rating_by_b is not None:
            ratings.append(int(match.rating_by_b))
        elif match.user_b_id == user_id and match.rating_by_a is not None:
            ratings.append(int(match.rating_by_a))

    if not ratings:
        return {"average": None, "count": 0}

    average = average_rating(ratings)
    return {"average": average, "count": len(ratings)}


def serialize_user(user: User, session: Session | None = None) -> dict:
    rating_info = {"average": None, "count": 0}
    if session is not None:
        rating_info = calculate_received_rating(session, user.id)

    return {
        "id": user.id,
        "name": user.name,
        "created_at": user.created_at.isoformat() if user.created_at else utc_now_iso(),
        "updated_at": user.updated_at.isoformat() if user.updated_at else utc_now_iso(),
        "rating": {
            "average": rating_info["average"],
            "count": rating_info["count"],
        },
        "profile": {
            "full_name": user.name,
            "bio": user.bio or "",
            "city": user.city or "",
            "language": user.language or "",
            "teach_skills": decode_skills(user.teach_skills),
            "learn_skills": decode_skills(user.learn_skills),
            "marketplace_message": user.marketplace_message or "",
        },
    }


def ensure_users_table_columns() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "users" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    columns_to_add = {
        "name": "VARCHAR(120)",
        "password_hash": "VARCHAR(128)",
        "bio": "TEXT",
        "city": "VARCHAR(120)",
        "language": "VARCHAR(80)",
        "teach_skills": "TEXT",
        "learn_skills": "TEXT",
        "marketplace_message": "TEXT",
        "updated_at": "TIMESTAMP",
    }

    with engine.begin() as connection:
        for column_name, column_type in columns_to_add.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"))


def ensure_matches_table_columns() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "matches" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("matches")}
    columns_to_add = {
        "source_request_id": "VARCHAR(36)",
        "status": "VARCHAR(20)",
        "finalized_by_a": "BOOLEAN",
        "finalized_by_b": "BOOLEAN",
        "rating_by_a": "INTEGER",
        "rating_by_b": "INTEGER",
        "updated_at": "TIMESTAMP",
        "completed_at": "TIMESTAMP",
    }

    added_columns: set[str] = set()

    with engine.begin() as connection:
        for column_name, column_type in columns_to_add.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(f"ALTER TABLE matches ADD COLUMN {column_name} {column_type}"))
            added_columns.add(column_name)

        all_columns = existing_columns.union(added_columns)

        if "status" in all_columns:
            connection.execute(text("UPDATE matches SET status = 'in_progress' WHERE status IS NULL OR status = ''"))
        if "finalized_by_a" in all_columns:
            connection.execute(text("UPDATE matches SET finalized_by_a = FALSE WHERE finalized_by_a IS NULL"))
        if "finalized_by_b" in all_columns:
            connection.execute(text("UPDATE matches SET finalized_by_b = FALSE WHERE finalized_by_b IS NULL"))
        if "updated_at" in all_columns:
            connection.execute(text("UPDATE matches SET updated_at = created_at WHERE updated_at IS NULL"))


def serialize_request(request: MessageRequestModel) -> dict:
    return {
        "id": request.id,
        "from_user_id": request.from_user_id,
        "to_user_id": request.to_user_id,
        "offered_skill": request.offered_skill,
        "requested_skill": request.requested_skill,
        "intro_message": request.intro_message,
        "status": request.status,
        "created_at": request.created_at.isoformat(),
        "updated_at": request.updated_at.isoformat(),
    }


def get_user_display_name(session: Session, user_id: str | None) -> str | None:
    if not user_id:
        return None
    user = session.get(User, user_id)
    if user and user.name and user.name.strip():
        return user.name.strip()
    return user_id


def serialize_request_with_names(session: Session, request: MessageRequestModel) -> dict:
    serialized = serialize_request(request)
    serialized["from_user_name"] = get_user_display_name(session, request.from_user_id)
    serialized["to_user_name"] = get_user_display_name(session, request.to_user_id)
    return serialized


def get_match_for_users(
    session: Session,
    user_one_id: str,
    user_two_id: str,
    source_request_id: str | None = None,
) -> MatchModel | None:
    user_a_id, user_b_id = canonical_match_pair(user_one_id, user_two_id)
    stmt = select(MatchModel).where(
        MatchModel.user_a_id == user_a_id,
        MatchModel.user_b_id == user_b_id,
    )
    if source_request_id is not None:
        stmt = stmt.where(MatchModel.source_request_id == source_request_id)
    return session.execute(stmt).scalars().first()


def get_match_intent(
    session: Session,
    from_user_id: str,
    to_user_id: str,
    request_id: str | None = None,
) -> MatchIntentModel | None:
    stmt = select(MatchIntentModel).where(
        MatchIntentModel.from_user_id == from_user_id,
        MatchIntentModel.to_user_id == to_user_id,
    )
    if request_id is not None:
        stmt = stmt.where(MatchIntentModel.request_id == request_id)
    return session.execute(stmt).scalars().first()


def create_conversation_for_request(session: Session, request: MessageRequestModel) -> str:
    if not request.to_user_id:
        raise HTTPException(status_code=400, detail="La solicitud aun no tiene receptor")

    existing = session.execute(
        select(ConversationModel).where(ConversationModel.request_id == request.id)
    ).scalars().first()
    if existing:
        return existing.id

    conversation = ConversationModel(
        id=str(uuid4()),
        request_id=request.id,
        created_at=datetime.now(timezone.utc),
    )
    session.add(conversation)
    session.add(ConversationParticipant(conversation_id=conversation.id, user_id=request.from_user_id))
    session.add(ConversationParticipant(conversation_id=conversation.id, user_id=request.to_user_id))
    return conversation.id


def create_match_conversation(session: Session, user_one_id: str, user_two_id: str, request: MessageRequestModel) -> str:
    now = datetime.now(timezone.utc)
    anchor_request = MessageRequestModel(
        id=str(uuid4()),
        from_user_id=user_one_id,
        to_user_id=user_two_id,
        offered_skill=request.offered_skill,
        requested_skill=request.requested_skill,
        intro_message=request.intro_message,
        status="accepted",
        created_at=now,
        updated_at=now,
    )
    session.add(anchor_request)
    session.flush()
    return create_conversation_for_request(session, anchor_request)


def serialize_request_for_viewer(
    session: Session,
    request: MessageRequestModel,
    viewer_user_id: str | None,
) -> dict:
    serialized = serialize_request_with_names(session, request)
    serialized["viewer_match_state"] = "none"
    serialized["viewer_conversation_id"] = None

    if not viewer_user_id or viewer_user_id == request.from_user_id:
        return serialized

    existing_match = get_match_for_users(session, viewer_user_id, request.from_user_id, request.id)
    if existing_match:
        serialized["viewer_match_state"] = "matched"
        serialized["viewer_conversation_id"] = existing_match.conversation_id
        return serialized

    sent_intent = get_match_intent(session, viewer_user_id, request.from_user_id, request.id)
    if sent_intent:
        serialized["viewer_match_state"] = "sent"

    received_intent = get_match_intent(session, request.from_user_id, viewer_user_id)
    if received_intent:
        serialized["viewer_match_state"] = "received" if serialized["viewer_match_state"] == "none" else "mutual-pending"

    return serialized


def get_match_side(match: MatchModel, user_id: str) -> str:
    if user_id == match.user_a_id:
        return "a"
    if user_id == match.user_b_id:
        return "b"
    raise HTTPException(status_code=403, detail="No perteneces a este match")


def serialize_match_for_user(session: Session, match: MatchModel, user_id: str) -> dict:
    side = get_match_side(match, user_id)
    other_user_id = match.user_b_id if side == "a" else match.user_a_id
    my_finalized = match.finalized_by_a if side == "a" else match.finalized_by_b
    other_finalized = match.finalized_by_b if side == "a" else match.finalized_by_a
    my_rating = match.rating_by_a if side == "a" else match.rating_by_b
    other_rating = match.rating_by_b if side == "a" else match.rating_by_a

    conversation = session.get(ConversationModel, match.conversation_id)
    request_payload = None
    if conversation:
        request = session.get(MessageRequestModel, conversation.request_id)
        if request:
            request_payload = serialize_request_with_names(session, request)

    return {
        "id": match.id,
        "conversation_id": match.conversation_id,
        "status": match.status or "in_progress",
        "created_at": match.created_at.isoformat() if match.created_at else utc_now_iso(),
        "updated_at": match.updated_at.isoformat() if match.updated_at else utc_now_iso(),
        "completed_at": match.completed_at.isoformat() if match.completed_at else None,
        "other_user_id": other_user_id,
        "other_user_name": get_user_display_name(session, other_user_id),
        "my_finalized": bool(my_finalized),
        "other_finalized": bool(other_finalized),
        "my_rating": my_rating,
        "other_rating": other_rating,
        "can_finalize": (match.status or "in_progress") == "in_progress" and not bool(my_finalized),
        "can_rate": (match.status or "in_progress") == "completed" and my_rating is None,
        "request": request_payload,
    }


def is_conversation_hidden_for_user(session: Session, conversation_id: str, user_id: str) -> bool:
    hidden = session.get(
        HiddenConversationModel,
        {"conversation_id": conversation_id, "user_id": user_id},
    )
    return hidden is not None


def serialize_message(message: ChatMessageModel) -> dict:
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "from_user_id": message.from_user_id,
        "content": message.content,
        "sent_at": message.sent_at.isoformat(),
    }