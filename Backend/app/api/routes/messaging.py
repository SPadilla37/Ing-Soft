import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import or_, select

from app.core.security import hash_password
from app.db.database import SessionLocal
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
from app.schemas import (
    ChatMessageCreate,
    ConversationCreatePayload,
    MarketplaceAcceptRequest,
    MatchFinalizePayload,
    MatchRatePayload,
    MessageCreatePayload,
    MessageRequestCreate,
    MessageRequestResponse,
    RequestStatus,
    UserLoginPayload,
    UserProfileUpdatePayload,
    UserRegisterPayload,
)
from app.services.core import (
    PUBLIC_MARKETPLACE_USER,
    create_conversation_for_request,
    create_match_conversation,
    encode_skills,
    ensure_user,
    get_match_for_users,
    get_match_intent,
    get_match_side,
    get_user_display_name,
    is_conversation_hidden_for_user,
    serialize_match_for_user,
    serialize_message,
    serialize_request_for_viewer,
    serialize_request_with_names,
    serialize_user,
    utc_now_iso,
)
from app.services.matching import canonical_match_pair
from app.services.websocket import manager


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": utc_now_iso()}


@router.post("/auth/register")
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


@router.post("/auth/login")
def login_user(payload: UserLoginPayload) -> dict:
    email = payload.email.strip().lower()
    with SessionLocal() as session:
        user = session.get(User, email)
        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")
        if user.password_hash != hash_password(payload.password):
            raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")

        return {"user": serialize_user(user, session)}


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


@router.post("/message-requests")
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
        request_obj = MessageRequestModel(
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
        session.add(request_obj)
        session.commit()
        session.refresh(request_obj)
        return {"request": serialize_request_with_names(session, request_obj)}


@router.get("/marketplace/requests")
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

        serialized_requests = [serialize_request_for_viewer(session, item, viewer_user_id) for item in requests]
        if viewer_user_id:
            serialized_requests = [
                item for item in serialized_requests
                if item.get("viewer_match_state") != "matched"
            ]

        return {"requests": serialized_requests}


@router.post("/marketplace/requests/{request_id}/accept")
def accept_marketplace_request(request_id: str, payload: MarketplaceAcceptRequest) -> dict:
    with SessionLocal() as session:
        request_obj = session.get(MessageRequestModel, request_id)
        if not request_obj:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if request_obj.status != RequestStatus.pending.value:
            raise HTTPException(status_code=400, detail="Esta solicitud ya no esta disponible")

        if request_obj.to_user_id != PUBLIC_MARKETPLACE_USER:
            raise HTTPException(status_code=400, detail="Esta solicitud no es publica")

        ensure_user(session, payload.accepter_user_id)
        target_user_id = request_obj.from_user_id

        if payload.accepter_user_id == request_obj.from_user_id:
            if not payload.responder_to_user_id:
                raise HTTPException(status_code=400, detail="Debes indicar que usuario quieres aceptar")
            if payload.responder_to_user_id == payload.accepter_user_id:
                raise HTTPException(status_code=400, detail="No puedes aceptar tu propio interes")

            incoming_intent = get_match_intent(
                session,
                payload.responder_to_user_id,
                payload.accepter_user_id,
                request_obj.id,
            )
            if not incoming_intent:
                raise HTTPException(status_code=400, detail="Ese interes recibido ya no esta disponible")

            target_user_id = payload.responder_to_user_id

        existing_match = get_match_for_users(session, payload.accepter_user_id, target_user_id, request_obj.id)
        if existing_match:
            return {
                "request": serialize_request_for_viewer(session, request_obj, payload.accepter_user_id),
                "matched": True,
                "conversation_id": existing_match.conversation_id,
                "match_state": "matched",
            }

        existing_intent = get_match_intent(session, payload.accepter_user_id, target_user_id, request_obj.id)
        reverse_intent = get_match_intent(session, target_user_id, payload.accepter_user_id)

        if not existing_intent:
            session.add(
                MatchIntentModel(
                    id=str(uuid4()),
                    from_user_id=payload.accepter_user_id,
                    to_user_id=target_user_id,
                    request_id=request_obj.id,
                    created_at=datetime.now(timezone.utc),
                )
            )

        matched = reverse_intent is not None
        conversation_id = None
        match_state = "sent"

        if matched:
            conversation_id = create_match_conversation(session, payload.accepter_user_id, target_user_id, request_obj)
            user_a_id, user_b_id = canonical_match_pair(payload.accepter_user_id, target_user_id)
            session.add(
                MatchModel(
                    id=str(uuid4()),
                    user_a_id=user_a_id,
                    user_b_id=user_b_id,
                    source_request_id=request_obj.id,
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
            "request": serialize_request_for_viewer(session, request_obj, payload.accepter_user_id),
            "matched": matched,
            "match_state": match_state,
            "conversation_id": conversation_id,
        }


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

            request_obj = session.get(MessageRequestModel, intent.request_id)
            if not request_obj:
                continue
            if request_obj.status != RequestStatus.pending.value or request_obj.to_user_id != PUBLIC_MARKETPLACE_USER:
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


@router.delete("/message-requests/{request_id}")
def delete_own_message_request(request_id: str, user_id: str = Query(..., min_length=1)) -> dict:
    with SessionLocal() as session:
        request_obj = session.get(MessageRequestModel, request_id)
        if not request_obj:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if request_obj.from_user_id != user_id:
            raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias solicitudes")

        if request_obj.status != RequestStatus.pending.value or request_obj.to_user_id != PUBLIC_MARKETPLACE_USER:
            raise HTTPException(status_code=400, detail="Solo puedes borrar solicitudes publicas pendientes")

        session.delete(request_obj)
        session.commit()
        return {"deleted": True, "request_id": request_id}


@router.get("/message-requests/{user_id}/incoming")
def get_incoming_requests(user_id: str) -> dict:
    with SessionLocal() as session:
        requests = session.execute(
            select(MessageRequestModel)
            .where(MessageRequestModel.to_user_id == user_id)
            .order_by(MessageRequestModel.created_at.desc())
        ).scalars().all()
        return {"requests": [serialize_request_with_names(session, item) for item in requests]}


@router.get("/message-requests/{user_id}/outgoing")
def get_outgoing_requests(user_id: str) -> dict:
    with SessionLocal() as session:
        requests = session.execute(
            select(MessageRequestModel)
            .where(MessageRequestModel.from_user_id == user_id)
            .order_by(MessageRequestModel.created_at.desc())
        ).scalars().all()
        return {"requests": [serialize_request_with_names(session, item) for item in requests]}


@router.patch("/message-requests/{request_id}/respond")
def respond_message_request(request_id: str, payload: MessageRequestResponse) -> dict:
    if payload.action not in {RequestStatus.accepted, RequestStatus.rejected}:
        raise HTTPException(status_code=400, detail="La accion debe ser accepted o rejected")

    with SessionLocal() as session:
        request_obj = session.get(MessageRequestModel, request_id)
        if not request_obj:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if payload.responder_user_id != request_obj.to_user_id:
            raise HTTPException(status_code=403, detail="Solo el receptor puede responder la solicitud")

        if request_obj.status != RequestStatus.pending.value:
            raise HTTPException(status_code=400, detail="Esta solicitud ya fue respondida")

        request_obj.status = payload.action.value
        request_obj.updated_at = datetime.now(timezone.utc)

        conversation_id = None
        if request_obj.status == RequestStatus.accepted.value:
            conversation_id = create_conversation_for_request(session, request_obj)

        session.commit()
        session.refresh(request_obj)
        return {
            "request": serialize_request_with_names(session, request_obj),
            "conversation_id": conversation_id,
        }


@router.get("/conversations/{user_id}")
@router.get("/conversaciones")
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

            request_obj = session.get(MessageRequestModel, conversation.request_id)
            conversations.append(
                {
                    "id": conversation.id,
                    "request_id": conversation.request_id,
                    "participants": sorted(participants),
                    "participants_display": sorted([name for name in participant_names if name]),
                    "created_at": conversation.created_at.isoformat(),
                    "request": serialize_request_with_names(session, request_obj) if request_obj else None,
                }
            )

        conversations.sort(key=lambda item: item["created_at"], reverse=True)
        return {"conversations": conversations}


@router.post("/conversaciones")
def create_conversation(payload: ConversationCreatePayload) -> dict:
    with SessionLocal() as session:
        request_obj = session.get(MessageRequestModel, payload.request_id)
        if not request_obj:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if payload.user_id not in {request_obj.from_user_id, request_obj.to_user_id}:
            raise HTTPException(status_code=403, detail="No autorizado para crear esta conversacion")

        if request_obj.status != RequestStatus.accepted.value:
            raise HTTPException(status_code=400, detail="La solicitud debe estar aceptada")

        conversation_id = create_conversation_for_request(session, request_obj)
        session.commit()
        return {"conversation_id": conversation_id}


@router.get("/conversations/{conversation_id}/messages")
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


@router.post("/conversations/{conversation_id}/messages")
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


@router.post("/mensajes")
async def create_message_alias(payload: MessageCreatePayload) -> dict:
    return await create_message(
        conversation_id=payload.conversation_id,
        payload=ChatMessageCreate(from_user_id=payload.from_user_id, content=payload.content),
    )


@router.delete("/conversations/{conversation_id}")
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


async def chat_socket_impl(websocket: WebSocket, conversation_id: str, user_id: str) -> None:
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


@router.websocket("/ws/{conversation_id}/{user_id}")
async def chat_socket_alias(websocket: WebSocket, conversation_id: str, user_id: str) -> None:
    await chat_socket_impl(websocket, conversation_id, user_id)