from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


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
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
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