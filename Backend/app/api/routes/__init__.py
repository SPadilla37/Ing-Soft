from app.api.routes.auth import router as auth_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.matches import router as matches_router
from app.api.routes.requests import router as requests_router
from app.api.routes.users import router as users_router
from app.api.routes.websocket import router as websocket_router

__all__ = ["auth_router", "conversations_router", "matches_router", "requests_router", "users_router", "websocket_router"]
