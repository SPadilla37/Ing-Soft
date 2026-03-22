from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class RequestStatus(str, Enum):
    pendiente = "pendiente"
    aceptado = "aceptado"
    completado = "completado"
    cancelado = "cancelado"


class MessageRequestCreate(BaseModel):
    from_user_id: int
    to_user_id: Optional[int] = None
    habilidad_id: int
    habilidad_solicitada_id: int
    mensaje: str = Field(default="", max_length=500)


class MessageRequestResponse(BaseModel):
    user_id: int
    action: str


class ChatMessageCreate(BaseModel):
    from_user_id: int
    content: str = Field(min_length=1, max_length=2000)


class ConversationCreatePayload(BaseModel):
    usuario_1_id: int
    usuario_2_id: int


class MessageCreatePayload(BaseModel):
    conversation_id: int
    from_user_id: int
    content: str = Field(min_length=1, max_length=2000)


class MarketplaceAcceptRequest(BaseModel):
    viewer_user_id: int


class MatchFinalizePayload(BaseModel):
    user_id: int


class MatchRatePayload(BaseModel):
    user_id: int
    rating: int = Field(ge=0, le=5)
    comentario: Optional[str] = Field(default=None, max_length=500)


class UserRegisterPayload(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    username: str = Field(min_length=3, max_length=25)
    password: str = Field(min_length=4, max_length=200)
    clerk_id: str = Field(default="")


class UserLoginPayload(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=4, max_length=200)


class UserProfileUpdatePayload(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=35)
    apellido: Optional[str] = Field(default=None, min_length=1, max_length=35)
    foto_url: Optional[str] = Field(default=None, max_length=50)
    biografia: Optional[str] = Field(default=None, max_length=2000)
    habilidades_ofertadas: Optional[List[int]] = Field(default=None)
    habilidades_busçadas: Optional[List[int]] = Field(default=None)


class HabilidadCreate(BaseModel):
    nombre: str
    categoria: str


class HabilidadResponse(BaseModel):
    id: int
    nombre: str
    categoria: str


class ResenaCreate(BaseModel):
    intercambio_id: int
    autor_id: int
    receptor_id: int
    calificacion: int = Field(ge=0, le=5)
    comentario: Optional[str] = Field(default=None, max_length=500)
