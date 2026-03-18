from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


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


class ConversationCreatePayload(BaseModel):
    request_id: str = Field(min_length=1, max_length=36)
    user_id: str = Field(min_length=1, max_length=120)


class MessageCreatePayload(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=36)
    from_user_id: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=2000)


class MarketplaceAcceptRequest(BaseModel):
    accepter_user_id: str = Field(min_length=1, max_length=120)
    responder_to_user_id: Optional[str] = Field(default=None, min_length=1, max_length=120)


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