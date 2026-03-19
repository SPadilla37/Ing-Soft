from fastapi import APIRouter

from . import auth, messaging

router = APIRouter()

router.include_router(auth.router, prefix="/api", tags=["auth"])
router.include_router(messaging.router, prefix="/api", tags=["messaging"])

__all__ = ["router"]
