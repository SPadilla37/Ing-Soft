from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.db.database import SessionLocal
from app.db.models.entities import Habilidad
from app.schemas.contracts import HabilidadCreate, HabilidadResponse


router = APIRouter()


def serialize_habilidad(habilidad: Habilidad) -> dict:
    return {
        "id": habilidad.id,
        "nombre": habilidad.nombre,
        "categoria": habilidad.categoria,
    }


@router.get("/habilidades")
def list_habilidades(categoria: str = Query(default=None)) -> dict:
    with SessionLocal() as session:
        query = select(Habilidad)
        if categoria:
            query = query.where(Habilidad.categoria == categoria)
        query = query.order_by(Habilidad.nombre)
        habilidades = session.execute(query).scalars().all()
        return {"habilidades": [serialize_habilidad(h) for h in habilidades]}


@router.get("/habilidades/{habilidad_id}")
def get_habilidad(habilidad_id: int) -> dict:
    with SessionLocal() as session:
        habilidad = session.execute(
            select(Habilidad).where(Habilidad.id == habilidad_id)
        ).scalars().first()
        if not habilidad:
            raise HTTPException(status_code=404, detail="Habilidad no encontrada")
        return {"habilidad": serialize_habilidad(habilidad)}


@router.post("/habilidades")
def create_habilidad(payload: HabilidadCreate) -> dict:
    with SessionLocal() as session:
        existing = session.execute(
            select(Habilidad).where(Habilidad.nombre == payload.nombre)
        ).scalars().first()
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe una habilidad con ese nombre")
        try:
            habilidad = Habilidad(nombre=payload.nombre, categoria=payload.categoria)
            session.add(habilidad)
            session.commit()
            session.refresh(habilidad)
            return {"habilidad": serialize_habilidad(habilidad)}
        except IntegrityError:
            session.rollback()
            raise HTTPException(status_code=409, detail="Ya existe una habilidad con ese nombre")


@router.put("/habilidades/{habilidad_id}")
def update_habilidad(habilidad_id: int, payload: HabilidadCreate) -> dict:
    with SessionLocal() as session:
        habilidad = session.execute(
            select(Habilidad).where(Habilidad.id == habilidad_id)
        ).scalars().first()
        if not habilidad:
            raise HTTPException(status_code=404, detail="Habilidad no encontrada")
        if habilidad.nombre != payload.nombre:
            duplicate = session.execute(
                select(Habilidad).where(Habilidad.nombre == payload.nombre)
            ).scalars().first()
            if duplicate:
                raise HTTPException(status_code=409, detail="Ya existe una habilidad con ese nombre")
        try:
            habilidad.nombre = payload.nombre
            habilidad.categoria = payload.categoria
            session.commit()
            session.refresh(habilidad)
            return {"habilidad": serialize_habilidad(habilidad)}
        except IntegrityError:
            session.rollback()
            raise HTTPException(status_code=409, detail="Ya existe una habilidad con ese nombre")


@router.delete("/habilidades/{habilidad_id}")
def delete_habilidad(habilidad_id: int) -> dict:
    with SessionLocal() as session:
        habilidad = session.execute(
            select(Habilidad).where(Habilidad.id == habilidad_id)
        ).scalars().first()
        if not habilidad:
            raise HTTPException(status_code=404, detail="Habilidad no encontrada")
        session.delete(habilidad)
        session.commit()
        return {"deleted": True, "habilidad_id": habilidad_id}
