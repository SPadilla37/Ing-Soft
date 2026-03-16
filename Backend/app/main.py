from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Set
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RequestStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class MessageRequestCreate(BaseModel):
    from_user_id: str = Field(min_length=1, max_length=120)
    to_user_id: str = Field(min_length=1, max_length=120)
    offered_skill: str = Field(min_length=1, max_length=120)
    requested_skill: str = Field(min_length=1, max_length=120)
    intro_message: str = Field(default="", max_length=500)


class MessageRequestResponse(BaseModel):
    responder_user_id: str = Field(min_length=1, max_length=120)
    action: RequestStatus


class ChatMessageCreate(BaseModel):
    from_user_id: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=2000)


@dataclass
class MessageRequest:
    id: str
    from_user_id: str
    to_user_id: str
    offered_skill: str
    requested_skill: str
    intro_message: str
    status: RequestStatus
    created_at: str
    updated_at: str


@dataclass
class ChatMessage:
    id: str
    conversation_id: str
    from_user_id: str
    content: str
    sent_at: str


@dataclass
class Conversation:
    id: str
    request_id: str
    participants: Set[str] = field(default_factory=set)
    created_at: str = field(default_factory=utc_now_iso)


class InMemoryStore:
    def __init__(self) -> None:
        self.requests: Dict[str, MessageRequest] = {}
        self.conversations: Dict[str, Conversation] = {}
        self.messages: Dict[str, List[ChatMessage]] = {}

    def create_request(self, payload: MessageRequestCreate) -> MessageRequest:
        if payload.from_user_id == payload.to_user_id:
            raise HTTPException(status_code=400, detail="No puedes enviarte solicitud a ti mismo")

        now = utc_now_iso()
        request = MessageRequest(
            id=str(uuid4()),
            from_user_id=payload.from_user_id,
            to_user_id=payload.to_user_id,
            offered_skill=payload.offered_skill,
            requested_skill=payload.requested_skill,
            intro_message=payload.intro_message,
            status=RequestStatus.pending,
            created_at=now,
            updated_at=now,
        )
        self.requests[request.id] = request
        return request

    def respond_request(self, request_id: str, payload: MessageRequestResponse) -> MessageRequest:
        request = self.requests.get(request_id)
        if not request:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if payload.responder_user_id != request.to_user_id:
            raise HTTPException(status_code=403, detail="Solo el receptor puede responder la solicitud")

        if request.status != RequestStatus.pending:
            raise HTTPException(status_code=400, detail="Esta solicitud ya fue respondida")

        if payload.action not in {RequestStatus.accepted, RequestStatus.rejected}:
            raise HTTPException(status_code=400, detail="La accion debe ser accepted o rejected")

        request.status = payload.action
        request.updated_at = utc_now_iso()

        if request.status == RequestStatus.accepted:
            conversation = Conversation(
                id=str(uuid4()),
                request_id=request.id,
                participants={request.from_user_id, request.to_user_id},
            )
            self.conversations[conversation.id] = conversation
            self.messages[conversation.id] = []

        return request

    def get_conversation_for_request(self, request_id: str) -> Conversation | None:
        for conversation in self.conversations.values():
            if conversation.request_id == request_id:
                return conversation
        return None


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

store = InMemoryStore()
manager = ConnectionManager()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "time": utc_now_iso()}


@app.post("/message-requests")
def create_message_request(payload: MessageRequestCreate) -> dict:
    request = store.create_request(payload)
    return {"request": request.__dict__}


@app.get("/message-requests/{user_id}/incoming")
def get_incoming_requests(user_id: str) -> dict:
    requests = [
        request.__dict__
        for request in store.requests.values()
        if request.to_user_id == user_id
    ]
    requests.sort(key=lambda item: item["created_at"], reverse=True)
    return {"requests": requests}


@app.get("/message-requests/{user_id}/outgoing")
def get_outgoing_requests(user_id: str) -> dict:
    requests = [
        request.__dict__
        for request in store.requests.values()
        if request.from_user_id == user_id
    ]
    requests.sort(key=lambda item: item["created_at"], reverse=True)
    return {"requests": requests}


@app.patch("/message-requests/{request_id}/respond")
def respond_message_request(request_id: str, payload: MessageRequestResponse) -> dict:
    request = store.respond_request(request_id, payload)
    conversation = store.get_conversation_for_request(request.id)
    return {
        "request": request.__dict__,
        "conversation_id": conversation.id if conversation else None,
    }


@app.get("/conversations/{user_id}")
def get_user_conversations(user_id: str) -> dict:
    conversations = []
    for conversation in store.conversations.values():
        if user_id in conversation.participants:
            request = store.requests.get(conversation.request_id)
            conversations.append(
                {
                    "id": conversation.id,
                    "request_id": conversation.request_id,
                    "participants": sorted(conversation.participants),
                    "created_at": conversation.created_at,
                    "request": request.__dict__ if request else None,
                }
            )

    conversations.sort(key=lambda item: item["created_at"], reverse=True)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, user_id: str = Query(..., min_length=1)) -> dict:
    conversation = store.conversations.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    if user_id not in conversation.participants:
        raise HTTPException(status_code=403, detail="No puedes leer mensajes de esta conversacion")

    messages = [message.__dict__ for message in store.messages.get(conversation_id, [])]
    return {"messages": messages}


@app.post("/conversations/{conversation_id}/messages")
async def create_message(conversation_id: str, payload: ChatMessageCreate) -> dict:
    conversation = store.conversations.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    if payload.from_user_id not in conversation.participants:
        raise HTTPException(status_code=403, detail="No puedes enviar mensajes en esta conversacion")

    message = ChatMessage(
        id=str(uuid4()),
        conversation_id=conversation_id,
        from_user_id=payload.from_user_id,
        content=payload.content,
        sent_at=utc_now_iso(),
    )
    store.messages.setdefault(conversation_id, []).append(message)

    await manager.broadcast(
        conversation_id,
        {
            "type": "chat_message",
            "message": message.__dict__,
        },
    )

    return {"message": message.__dict__}


@app.websocket("/ws/chat/{conversation_id}")
async def chat_socket(websocket: WebSocket, conversation_id: str, user_id: str = Query(..., min_length=1)) -> None:
    conversation = store.conversations.get(conversation_id)
    if not conversation:
        await websocket.close(code=1008, reason="Conversacion no encontrada")
        return

    if user_id not in conversation.participants:
        await websocket.close(code=1008, reason="No autorizado para esta conversacion")
        return

    await manager.connect(conversation_id, user_id, websocket)
    await websocket.send_text(
        json.dumps(
            {
                "type": "history",
                "messages": [m.__dict__ for m in store.messages.get(conversation_id, [])],
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

            message = ChatMessage(
                id=str(uuid4()),
                conversation_id=conversation_id,
                from_user_id=user_id,
                content=content,
                sent_at=utc_now_iso(),
            )
            store.messages.setdefault(conversation_id, []).append(message)

            await manager.broadcast(
                conversation_id,
                {
                    "type": "chat_message",
                    "message": message.__dict__,
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
