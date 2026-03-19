import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.db.database import Base, SessionLocal, engine
from app.services.core import (
    PUBLIC_MARKETPLACE_USER,
    ensure_matches_table_columns,
    ensure_user,
    ensure_users_table_columns,
)


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
    ensure_users_table_columns()
    ensure_matches_table_columns()
    with SessionLocal() as session:
        ensure_user(session, PUBLIC_MARKETPLACE_USER)
        session.commit()


app.include_router(router)