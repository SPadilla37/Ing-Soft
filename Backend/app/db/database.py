import os
from typing import Dict

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


Base = declarative_base()


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def build_engine_and_session() -> tuple[object, object, str]:
    default_db = "sqlite:////tmp/skillswap.db" if os.getenv("RENDER") else "sqlite:///./skillswap.db"
    database_url = normalize_database_url(os.getenv("DATABASE_URL", default_db))

    engine_kwargs: Dict[str, object] = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    engine = create_engine(database_url, **engine_kwargs)
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return engine, session_local, database_url


engine, SessionLocal, database_url = build_engine_and_session()