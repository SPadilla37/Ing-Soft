import json
import os
from hashlib import sha256
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, String, Text, create_engine, inspect, or_, select, text
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column, sessionmaker


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


PUBLIC_MARKETPLACE_USER = "__PUBLIC__"


class RequestStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class MessageRequestCreate(BaseModel):
    from_user_id: str = Field(min_length=1, max_length=120)
    to_user_id: Optional[str] = Field(default=None, min_length=1, max_length=120)
    offered_skill: str = Field(min_length=1, max_length=120)
    requested_skill: str = Field(min_length=1, max_length=120)
    intro_message: str = Field(default="", max_length=500)


class MessageRequestResponse(BaseModel):
    responder_user_id: str = Field(min_length=1, max_length=120)
    action: RequestStatus


class ChatMessageCreate(BaseModel):
    from_user_id: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=2000)


class MarketplaceAcceptRequest(BaseModel):
    accepter_user_id: str = Field(min_length=1, max_length=120)


class MatchFinalizePayload(BaseModel):
    user_id: str = Field(min_length=1, max_length=120)


class MatchRatePayload(BaseModel):
    user_id: str = Field(min_length=1, max_length=120)
    rating: int = Field(ge=0, le=5)


class UserRegisterPayload(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=4, max_length=200)


class UserLoginPayload(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=4, max_length=200)


class UserProfileUpdatePayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=2000)
    city: Optional[str] = Field(default=None, max_length=120)
    language: Optional[str] = Field(default=None, max_length=80)
    teach_skills: Optional[List[str]] = Field(default=None)
    learn_skills: Optional[List[str]] = Field(default=None)
    marketplace_message: Optional[str] = Field(default=None, max_length=500)


Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(128), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    language: Mapped[str] = mapped_column(String(80), default="")
    teach_skills: Mapped[str] = mapped_column(Text, default="[]")
    learn_skills: Mapped[str] = mapped_column(Text, default="[]")
    marketplace_message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MessageRequestModel(Base):
    __tablename__ = "message_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    from_user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), index=True)
    to_user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), index=True, nullable=True)
    offered_skill: Mapped[str] = mapped_column(String(120))
    requested_skill: Mapped[str] = mapped_column(String(120))
    intro_message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=RequestStatus.pending.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ConversationModel(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("message_requests.id"), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), primary_key=True)


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), index=True)
    from_user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class HiddenConversationModel(Base):
    __tablename__ = "hidden_conversations"

    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), primary_key=True)
    hidden_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MatchIntentModel(Base):
    __tablename__ = "match_intents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    from_user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), index=True)
    to_user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), index=True)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("message_requests.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MatchModel(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_a_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), index=True)
    user_b_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), index=True)
    source_request_id: Mapped[str] = mapped_column(String(36), ForeignKey("message_requests.id"), index=True, nullable=True)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress", index=True)
    finalized_by_a: Mapped[bool] = mapped_column(default=False)
    finalized_by_b: Mapped[bool] = mapped_column(default=False)
    rating_by_a: Mapped[int] = mapped_column(default=None, nullable=True)
    rating_by_b: Mapped[int] = mapped_column(default=None, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=None, nullable=True)


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


default_db = "sqlite:////tmp/skillswap.db" if os.getenv("RENDER") else "sqlite:///./skillswap.db"
database_url = normalize_database_url(os.getenv("DATABASE_URL", default_db))

engine_kwargs: Dict[str, object] = {"pool_pre_ping": True}
if database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def ensure_user(session: Session, user_id: str) -> None:
    user = session.get(User, user_id)
    if not user:
        now = datetime.now(timezone.utc)
        session.add(User(id=user_id, created_at=now, updated_at=now))


def hash_password(password: str) -> str:
    return sha256(password.encode("utf-8")).hexdigest()


def decode_skills(raw_skills: str) -> List[str]:
    try:
        parsed = json.loads(raw_skills or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(skill).strip() for skill in parsed if str(skill).strip()]


def encode_skills(skills: List[str]) -> str:
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

    ratings: List[int] = []
    for match in matches:
        if match.user_a_id == user_id and match.rating_by_b is not None:
            ratings.append(int(match.rating_by_b))
        elif match.user_b_id == user_id and match.rating_by_a is not None:
            ratings.append(int(match.rating_by_a))

    if not ratings:
        return {"average": None, "count": 0}

    average = round(sum(ratings) / len(ratings), 2)
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


def canonical_match_pair(user_one_id: str, user_two_id: str) -> tuple[str, str]:
    return tuple(sorted([user_one_id, user_two_id]))


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


def create_match_conversation(session: Session, user_one_id: str, user_two_id: str, request: MessageRequestModel) -> str:
    now = datetime.now(timezone.utc)
    anchor_request = MessageRequestModel(
        id=str(uuid4()),
        from_user_id=user_one_id,
        to_user_id=user_two_id,
        offered_skill=request.offered_skill,
        requested_skill=request.requested_skill,
        intro_message=request.intro_message,
        status=RequestStatus.accepted.value,
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


class ConnectionManager:
    def __init__(self) -> None:
        self.connections_by_conversation: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, conversation_id: str, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections_by_conversation.setdefault(conversation_id, {})[user_id] = websocket

    def disconnect(self, conversation_id: str, user_id: str) -> None:
        conversation_connections = self.connections_by_conversation.get(conversation_id, {})
        conversation_connections.pop(user_id, None)
        if not conversation_connections:
            self.connections_by_conversation.pop(conversation_id, None)

    async def broadcast(self, conversation_id: str, payload: dict) -> None:
        conversation_connections = self.connections_by_conversation.get(conversation_id, {})
        to_remove: List[str] = []

        for user_id, websocket in conversation_connections.items():
            try:
                await websocket.send_text(json.dumps(payload))
            except Exception:
                to_remove.append(user_id)

        for user_id in to_remove:
            self.disconnect(conversation_id, user_id)


app = FastAPI(title="Skill Exchange Messaging API", version="1.0.0")

allowed_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_users_table_columns()
    ensure_matches_table_columns()
    with SessionLocal() as session:
        ensure_user(session, PUBLIC_MARKETPLACE_USER)
        session.commit()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "time": utc_now_iso()}


@app.post("/users/register")
def register_user(payload: UserRegisterPayload) -> dict:
    email = payload.email.strip().lower()
    with SessionLocal() as session:
        existing = session.get(User, email)
        if existing and existing.password_hash:
            raise HTTPException(status_code=409, detail="Ese correo ya esta registrado")

        now = datetime.now(timezone.utc)
        if not existing:
            existing = User(
                id=email,
                name=payload.name.strip(),
                password_hash=hash_password(payload.password),
                created_at=now,
                updated_at=now,
            )
            session.add(existing)
        else:
            existing.name = payload.name.strip()
            existing.password_hash = hash_password(payload.password)
            existing.updated_at = now

        session.commit()
        session.refresh(existing)
        return {"user": serialize_user(existing, session)}


@app.post("/users/login")
def login_user(payload: UserLoginPayload) -> dict:
    email = payload.email.strip().lower()
    with SessionLocal() as session:
        user = session.get(User, email)
        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")
        if user.password_hash != hash_password(payload.password):
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")

        return {"user": serialize_user(user, session)}


@app.get("/users/{user_id}")
def get_user(user_id: str) -> dict:
    with SessionLocal() as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return {"user": serialize_user(user, session)}


@app.put("/users/{user_id}/profile")
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


@app.post("/message-requests")
def create_message_request(payload: MessageRequestCreate) -> dict:
    if payload.to_user_id and payload.from_user_id == payload.to_user_id:
        raise HTTPException(status_code=400, detail="No puedes enviarte solicitud a ti mismo")

    with SessionLocal() as session:
        ensure_user(session, payload.from_user_id)
        if payload.to_user_id:
            ensure_user(session, payload.to_user_id)
        else:
            ensure_user(session, PUBLIC_MARKETPLACE_USER)

        now = datetime.now(timezone.utc)
        request = MessageRequestModel(
            id=str(uuid4()),
            from_user_id=payload.from_user_id,
            to_user_id=payload.to_user_id or PUBLIC_MARKETPLACE_USER,
            offered_skill=payload.offered_skill,
            requested_skill=payload.requested_skill,
            intro_message=payload.intro_message,
            status=RequestStatus.pending.value,
            created_at=now,
            updated_at=now,
        )
        session.add(request)
        session.commit()
        session.refresh(request)
        return {"request": serialize_request_with_names(session, request)}


@app.get("/marketplace/requests")
def list_marketplace_requests(
    viewer_user_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    with SessionLocal() as session:
        stmt = select(MessageRequestModel).where(
            MessageRequestModel.status == RequestStatus.pending.value,
            MessageRequestModel.to_user_id == PUBLIC_MARKETPLACE_USER,
        )

        if viewer_user_id:
            stmt = stmt.where(MessageRequestModel.from_user_id != viewer_user_id)

        if q:
            q_text = f"%{q.lower()}%"
            stmt = stmt.where(
                or_(
                    MessageRequestModel.offered_skill.ilike(q_text),
                    MessageRequestModel.requested_skill.ilike(q_text),
                    MessageRequestModel.intro_message.ilike(q_text),
                    MessageRequestModel.from_user_id.ilike(q_text),
                )
            )

        requests = session.execute(
            stmt.order_by(MessageRequestModel.created_at.desc())
        ).scalars().all()

        return {"requests": [serialize_request_for_viewer(session, item, viewer_user_id) for item in requests]}


@app.post("/marketplace/requests/{request_id}/accept")
def accept_marketplace_request(request_id: str, payload: MarketplaceAcceptRequest) -> dict:
    with SessionLocal() as session:
        request = session.get(MessageRequestModel, request_id)
        if not request:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if request.status != RequestStatus.pending.value:
            raise HTTPException(status_code=400, detail="Esta solicitud ya no esta disponible")

        if request.to_user_id != PUBLIC_MARKETPLACE_USER:
            raise HTTPException(status_code=400, detail="Esta solicitud no es publica")

        if payload.accepter_user_id == request.from_user_id:
            raise HTTPException(status_code=400, detail="No puedes aceptar tu propia solicitud")

        ensure_user(session, payload.accepter_user_id)
        existing_match = get_match_for_users(session, payload.accepter_user_id, request.from_user_id, request.id)
        if existing_match:
            return {
                "request": serialize_request_for_viewer(session, request, payload.accepter_user_id),
                "matched": True,
                "conversation_id": existing_match.conversation_id,
                "match_state": "matched",
            }

        existing_intent = get_match_intent(session, payload.accepter_user_id, request.from_user_id, request.id)
        reverse_intent = get_match_intent(session, request.from_user_id, payload.accepter_user_id)

        if not existing_intent:
            session.add(
                MatchIntentModel(
                    id=str(uuid4()),
                    from_user_id=payload.accepter_user_id,
                    to_user_id=request.from_user_id,
                    request_id=request.id,
                    created_at=datetime.now(timezone.utc),
                )
            )

        matched = reverse_intent is not None
        conversation_id = None
        match_state = "sent"

        if matched:
            conversation_id = create_match_conversation(session, payload.accepter_user_id, request.from_user_id, request)
            user_a_id, user_b_id = canonical_match_pair(payload.accepter_user_id, request.from_user_id)
            session.add(
                MatchModel(
                    id=str(uuid4()),
                    user_a_id=user_a_id,
                    user_b_id=user_b_id,
                    source_request_id=request.id,
                    conversation_id=conversation_id,
                    status="in_progress",
                    finalized_by_a=False,
                    finalized_by_b=False,
                    updated_at=datetime.now(timezone.utc),
                    created_at=datetime.now(timezone.utc),
                )
            )
            match_state = "matched"

        session.commit()

        return {
            "request": serialize_request_for_viewer(session, request, payload.accepter_user_id),
            "matched": matched,
            "match_state": match_state,
            "conversation_id": conversation_id,
        }


@app.get("/matches/{user_id}/incoming")
def get_incoming_match_intents(user_id: str) -> dict:
    with SessionLocal() as session:
        intents = session.execute(
            select(MatchIntentModel)
            .where(MatchIntentModel.to_user_id == user_id)
            .order_by(MatchIntentModel.created_at.desc())
        ).scalars().all()

        items = []
        for intent in intents:
            existing_match = get_match_for_users(session, intent.from_user_id, intent.to_user_id, intent.request_id)
            if existing_match:
                continue

            request = session.get(MessageRequestModel, intent.request_id)
            if not request:
                continue
            if request.status != RequestStatus.pending.value or request.to_user_id != PUBLIC_MARKETPLACE_USER:
                continue

            items.append(
                {
                    "intent_id": intent.id,
                    "created_at": intent.created_at.isoformat(),
                    "request": serialize_request_for_viewer(session, request, user_id),
                }
            )

        return {"incoming": items}


@app.get("/matches/{user_id}")
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


@app.post("/matches/{match_id}/finalize")
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


@app.post("/matches/{match_id}/rate")
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


@app.delete("/message-requests/{request_id}")
def delete_own_message_request(request_id: str, user_id: str = Query(..., min_length=1)) -> dict:
    with SessionLocal() as session:
        request = session.get(MessageRequestModel, request_id)
        if not request:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if request.from_user_id != user_id:
            raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias solicitudes")

        if request.status != RequestStatus.pending.value or request.to_user_id != PUBLIC_MARKETPLACE_USER:
            raise HTTPException(status_code=400, detail="Solo puedes borrar solicitudes publicas pendientes")

        session.delete(request)
        session.commit()
        return {"deleted": True, "request_id": request_id}


@app.get("/message-requests/{user_id}/incoming")
def get_incoming_requests(user_id: str) -> dict:
    with SessionLocal() as session:
        requests = session.execute(
            select(MessageRequestModel)
            .where(MessageRequestModel.to_user_id == user_id)
            .order_by(MessageRequestModel.created_at.desc())
        ).scalars().all()
        return {"requests": [serialize_request_with_names(session, item) for item in requests]}


@app.get("/message-requests/{user_id}/outgoing")
def get_outgoing_requests(user_id: str) -> dict:
    with SessionLocal() as session:
        requests = session.execute(
            select(MessageRequestModel)
            .where(MessageRequestModel.from_user_id == user_id)
            .order_by(MessageRequestModel.created_at.desc())
        ).scalars().all()
        return {"requests": [serialize_request_with_names(session, item) for item in requests]}


@app.patch("/message-requests/{request_id}/respond")
def respond_message_request(request_id: str, payload: MessageRequestResponse) -> dict:
    if payload.action not in {RequestStatus.accepted, RequestStatus.rejected}:
        raise HTTPException(status_code=400, detail="La accion debe ser accepted o rejected")

    with SessionLocal() as session:
        request = session.get(MessageRequestModel, request_id)
        if not request:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if payload.responder_user_id != request.to_user_id:
            raise HTTPException(status_code=403, detail="Solo el receptor puede responder la solicitud")

        if request.status != RequestStatus.pending.value:
            raise HTTPException(status_code=400, detail="Esta solicitud ya fue respondida")

        request.status = payload.action.value
        request.updated_at = datetime.now(timezone.utc)

        conversation_id = None
        if request.status == RequestStatus.accepted.value:
            conversation_id = create_conversation_for_request(session, request)

        session.commit()
        session.refresh(request)
        return {
            "request": serialize_request_with_names(session, request),
            "conversation_id": conversation_id,
        }


@app.get("/conversations/{user_id}")
def get_user_conversations(user_id: str) -> dict:
    with SessionLocal() as session:
        participant_rows = session.execute(
            select(ConversationParticipant).where(ConversationParticipant.user_id == user_id)
        ).scalars().all()

        conversations = []
        for row in participant_rows:
            conversation = session.get(ConversationModel, row.conversation_id)
            if not conversation:
                continue

            if is_conversation_hidden_for_user(session, conversation.id, user_id):
                continue

            participants = session.execute(
                select(ConversationParticipant.user_id).where(
                    ConversationParticipant.conversation_id == conversation.id
                )
            ).scalars().all()
            participant_names = [get_user_display_name(session, participant_id) for participant_id in participants]

            request = session.get(MessageRequestModel, conversation.request_id)
            conversations.append(
                {
                    "id": conversation.id,
                    "request_id": conversation.request_id,
                    "participants": sorted(participants),
                    "participants_display": sorted([name for name in participant_names if name]),
                    "created_at": conversation.created_at.isoformat(),
                    "request": serialize_request_with_names(session, request) if request else None,
                }
            )

        conversations.sort(key=lambda item: item["created_at"], reverse=True)
        return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, user_id: str = Query(..., min_length=1)) -> dict:
    with SessionLocal() as session:
        conversation = session.get(ConversationModel, conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversacion no encontrada")

        membership = session.get(ConversationParticipant, {"conversation_id": conversation_id, "user_id": user_id})
        if not membership:
            raise HTTPException(status_code=403, detail="No puedes leer mensajes de esta conversacion")

        if is_conversation_hidden_for_user(session, conversation_id, user_id):
            raise HTTPException(status_code=403, detail="Conversacion oculta para este usuario")

        messages = session.execute(
            select(ChatMessageModel)
            .where(ChatMessageModel.conversation_id == conversation_id)
            .order_by(ChatMessageModel.sent_at.asc())
        ).scalars().all()
        return {"messages": [serialize_message(msg) for msg in messages]}


@app.post("/conversations/{conversation_id}/messages")
async def create_message(conversation_id: str, payload: ChatMessageCreate) -> dict:
    with SessionLocal() as session:
        conversation = session.get(ConversationModel, conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversacion no encontrada")

        membership = session.get(
            ConversationParticipant,
            {"conversation_id": conversation_id, "user_id": payload.from_user_id},
        )
        if not membership:
            raise HTTPException(status_code=403, detail="No puedes enviar mensajes en esta conversacion")

        if is_conversation_hidden_for_user(session, conversation_id, payload.from_user_id):
            raise HTTPException(status_code=403, detail="Conversacion oculta para este usuario")

        message = ChatMessageModel(
            id=str(uuid4()),
            conversation_id=conversation_id,
            from_user_id=payload.from_user_id,
            content=payload.content,
            sent_at=datetime.now(timezone.utc),
        )
        session.add(message)
        session.commit()
        session.refresh(message)

    serialized = serialize_message(message)

    await manager.broadcast(
        conversation_id,
        {
            "type": "chat_message",
            "message": serialized,
        },
    )

    return {"message": serialized}


@app.delete("/conversations/{conversation_id}")
def hide_conversation_for_user(conversation_id: str, user_id: str = Query(..., min_length=1)) -> dict:
    with SessionLocal() as session:
        conversation = session.get(ConversationModel, conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversacion no encontrada")

        membership = session.get(
            ConversationParticipant,
            {"conversation_id": conversation_id, "user_id": user_id},
        )
        if not membership:
            raise HTTPException(status_code=403, detail="No puedes borrar esta conversacion")

        hidden = session.get(
            HiddenConversationModel,
            {"conversation_id": conversation_id, "user_id": user_id},
        )
        if not hidden:
            session.add(
                HiddenConversationModel(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    hidden_at=datetime.now(timezone.utc),
                )
            )
            session.commit()

        return {"deleted_for_user": True, "conversation_id": conversation_id, "user_id": user_id}


@app.websocket("/ws/chat/{conversation_id}")
async def chat_socket(websocket: WebSocket, conversation_id: str, user_id: str = Query(..., min_length=1)) -> None:
    with SessionLocal() as session:
        conversation = session.get(ConversationModel, conversation_id)
        if not conversation:
            await websocket.close(code=1008, reason="Conversacion no encontrada")
            return

        membership = session.get(
            ConversationParticipant,
            {"conversation_id": conversation_id, "user_id": user_id},
        )
        if not membership:
            await websocket.close(code=1008, reason="No autorizado para esta conversacion")
            return

        if is_conversation_hidden_for_user(session, conversation_id, user_id):
            await websocket.close(code=1008, reason="Conversacion oculta para este usuario")
            return

        history = session.execute(
            select(ChatMessageModel)
            .where(ChatMessageModel.conversation_id == conversation_id)
            .order_by(ChatMessageModel.sent_at.asc())
        ).scalars().all()

    await manager.connect(conversation_id, user_id, websocket)
    await websocket.send_text(
        json.dumps(
            {
                "type": "history",
                "messages": [serialize_message(m) for m in history],
            }
        )
    )

    await manager.broadcast(
        conversation_id,
        {
            "type": "presence",
            "event": "joined",
            "user_id": user_id,
            "at": utc_now_iso(),
        },
    )

    try:
        while True:
            raw_text = await websocket.receive_text()
            incoming = json.loads(raw_text)
            message_type = incoming.get("type")

            if message_type != "message":
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "detail": "Formato invalido. Usa {type: 'message', content: '...'}",
                        }
                    )
                )
                continue

            content = str(incoming.get("content", "")).strip()
            if not content:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Mensaje vacio"}))
                continue

            with SessionLocal() as session:
                message = ChatMessageModel(
                    id=str(uuid4()),
                    conversation_id=conversation_id,
                    from_user_id=user_id,
                    content=content,
                    sent_at=datetime.now(timezone.utc),
                )
                session.add(message)
                session.commit()
                session.refresh(message)

            serialized = serialize_message(message)

            await manager.broadcast(
                conversation_id,
                {
                    "type": "chat_message",
                    "message": serialized,
                },
            )
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, user_id)
        await manager.broadcast(
            conversation_id,
            {
                "type": "presence",
                "event": "left",
                "user_id": user_id,
                "at": utc_now_iso(),
            },
        )
