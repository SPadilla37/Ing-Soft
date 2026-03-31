import asyncio
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.notifications import notification_manager

router = APIRouter()

async def event_generator(request: Request, user_id: int):
    queue = await notification_manager.get_queue(user_id)
    try:
        while True:
            # Check if client is still connected
            if await request.is_disconnected():
                break

            try:
                # Wait for message with a timeout to detect disconnects periodically
                message = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {json.dumps(message)}\n\n"
            except asyncio.TimeoutError:
                # Send a ping to keep connection alive
                yield ": ping\n\n"
                continue
    except asyncio.CancelledError:
        pass
    finally:
        # Cleanup if needed, though for an unbounded queue per user we might just leave it 
        # or clear it out. For simplicity, we just stop serving.
        pass

@router.get("/notifications/stream/{user_id}")
async def notification_stream(user_id: int, request: Request):
    return StreamingResponse(event_generator(request, user_id), media_type="text/event-stream")
