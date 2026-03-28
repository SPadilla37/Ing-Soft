from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select
from app.db.database import SessionLocal
from app.db.models.entities import Usuario, UsuarioHabilidad, Reseña
from app.schemas import UserProfileUpdatePayload
from app.services.core import serialize_user


router = APIRouter()


@router.get("/usuarios/{user_id}")
def get_user(user_id: int) -> dict:
    with SessionLocal() as session:
        user = session.get(Usuario, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return {"user": serialize_user(user, session)}


@router.put("/usuarios/{user_id}/profile")
def update_user_profile(user_id: int, payload: UserProfileUpdatePayload) -> dict:
    with SessionLocal() as session:
        user = session.get(Usuario, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if payload.nombre is not None:
            user.nombre = payload.nombre.strip()
        if payload.apellido is not None:
            user.apellido = payload.apellido.strip()
        if payload.foto_url is not None:
            user.foto_url = payload.foto_url.strip()
        if payload.biografia is not None:
            user.biografia = payload.biografia.strip()

        if payload.habilidades_ofertadas is not None and payload.habilidades_buscadas is not None:
            overlap = set(payload.habilidades_ofertadas) & set(payload.habilidades_buscadas)
            if overlap:
                raise HTTPException(
                    status_code=400,
                    detail="No puedes tener la misma habilidad ofertada y buscada"
                )

        if payload.habilidades_ofertadas is not None:
            session.execute(
                delete(UsuarioHabilidad).where(
                    UsuarioHabilidad.usuario_id == user_id,
                    UsuarioHabilidad.categoria == "ofertada",
                )
            )
            for hab_id in payload.habilidades_ofertadas:
                session.add(UsuarioHabilidad(
                    habilidad_id=hab_id,
                    usuario_id=user_id,
                    categoria="ofertada",
                ))

        if payload.habilidades_buscadas is not None:
            session.execute(
                delete(UsuarioHabilidad).where(
                    UsuarioHabilidad.usuario_id == user_id,
                    UsuarioHabilidad.categoria == "buscada",
                )
            )
            for hab_id in payload.habilidades_buscadas:
                session.add(UsuarioHabilidad(
                    habilidad_id=hab_id,
                    usuario_id=user_id,
                    categoria="buscada",
                ))

        session.commit()
        session.refresh(user)
        return {"user": serialize_user(user, session)}


@router.get("/usuarios/{user_id}/reviews")
def get_user_reviews(user_id: int) -> dict:
    """
    Fetch all reviews received by a user with author information.
    
    Args:
        user_id: The ID of the user whose reviews to fetch
        
    Returns:
        dict: {"reviews": [list of review objects with author info]}
        
    Raises:
        HTTPException 404: User not found
        HTTPException 400: Invalid user_id format
    """
    # Validate user_id is positive integer
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="ID de usuario inválido")
    
    with SessionLocal() as session:
        # Check if user exists
        user = session.get(Usuario, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Query reviews filtering by receptor_id, sorted by created_at DESC
        reviews_query = select(Reseña).where(
            Reseña.receptor_id == user_id
        ).order_by(Reseña.created_at.desc())
        
        reviews = session.execute(reviews_query).scalars().all()
        
        # Serialize reviews with author information
        serialized_reviews = []
        for review in reviews:
            # Get author information
            author = session.get(Usuario, review.autor_id) if review.autor_id else None
            
            # Handle deleted authors
            if author:
                author_info = {
                    "id": author.id,
                    "nombre": author.nombre,
                    "apellido": author.apellido,
                    "username": author.username
                }
            else:
                author_info = {
                    "id": review.autor_id,
                    "nombre": "Usuario",
                    "apellido": "eliminado",
                    "username": "eliminado"
                }
            
            # Serialize review with author info
            serialized_review = {
                "id": review.id,
                "calificacion": review.calificacion,
                "comentario": review.comentario,
                "created_at": review.created_at.isoformat() if review.created_at else datetime.now(timezone.utc).isoformat(),
                "autor": author_info
            }
            serialized_reviews.append(serialized_review)
        
        return {"reviews": serialized_reviews}
