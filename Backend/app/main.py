import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.habilidades import router as habilidades_router
from app.api.routes.matches import router as matches_router
from app.api.routes.requests import router as requests_router
from app.api.routes.users import router as users_router
from app.api.routes.websocket import router as websocket_router
from app.db.database import Base, engine


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


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


app.include_router(auth_router)
app.include_router(habilidades_router)
app.include_router(matches_router)
app.include_router(requests_router)
app.include_router(users_router)
app.include_router(websocket_router)
app.include_router(conversations_router)
