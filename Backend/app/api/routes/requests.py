from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select
from app.db.database import SessionLocal
from app.db.models import MessageRequestModel, MatchIntentModel, MatchModel
from app.schemas import (
    MarketplaceAcceptRequest,
    MessageRequestCreate,
    MessageRequestResponse,
    RequestStatus,
)
from app.services.core import (
    PUBLIC_MARKETPLACE_USER,
    create_conversation_for_request,
    create_match_conversation,
    ensure_user,
    get_match_for_users,
    get_match_intent,
    get_user_display_name,
    serialize_match_for_user,
    serialize_request_for_viewer,
    serialize_request_with_names,
)
from app.services.matching import canonical_match_pair


router = APIRouter()


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