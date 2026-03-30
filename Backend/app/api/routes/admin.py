from fastapi import APIRouter, Header, Query, HTTPException
from typing import Annotated, Optional
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta, timezone
from app.core.auth_middleware import require_admin, require_superadmin
from app.db.database import SessionLocal
from app.db.models.entities import Usuario, Intercambio, Reseña, Habilidad, UsuarioHabilidad
from app.schemas.admin import (
    StatsResponse, UserListResponse, UserListItem, PaginationMeta,
    UserDetailResponse, UserStats, UserSkills, SkillItem, RoleUpdateRequest,
    SkillWithStats, SkillListResponse, ActivityReportResponse, DailyActivity,
    SkillCreateRequest, CategoriesResponse
)
import math

# Initialize router with admin prefix and tags
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=StatsResponse)
@require_admin
async def get_stats(
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get platform statistics.
    
    Requires admin or superadmin role.
    Returns total users, completed exchanges, average rating, and total skills.
    """
    db = SessionLocal()
    try:
        # Query total users count
        total_users = db.query(func.count(Usuario.id)).scalar() or 0
        
        # Query total completed exchanges
        total_exchanges = db.query(func.count(Intercambio.id)).filter(
            Intercambio.estado == 'completado'
        ).scalar() or 0
        
        # Calculate average rating from reviews
        average_rating_result = db.query(func.avg(Reseña.calificacion)).scalar()
        average_rating = float(average_rating_result) if average_rating_result else 0.0
        
        # Query total skills count
        total_skills = db.query(func.count(Habilidad.id)).scalar() or 0
        
        return StatsResponse(
            total_users=total_users,
            total_exchanges=total_exchanges,
            average_rating=average_rating,
            total_skills=total_skills
        )
    finally:
        db.close()


@router.get("/users", response_model=UserListResponse)
@require_admin
async def get_users(
    authorization: Annotated[str, Header()],
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page"),
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get paginated list of users.
    
    Requires admin or superadmin role.
    Returns users ordered by registration date (newest first) with pagination metadata.
    """
    db = SessionLocal()
    try:
        # Calculate offset from page and limit
        offset = (page - 1) * limit
        
        # Query total users count
        total_users = db.query(func.count(Usuario.id)).scalar() or 0
        
        # Calculate total pages
        total_pages = math.ceil(total_users / limit) if total_users > 0 else 1
        
        # Query usuarios with ORDER BY fecha_registro DESC and apply pagination
        users_query = db.query(Usuario).order_by(Usuario.fecha_registro.desc())
        users = users_query.offset(offset).limit(limit).all()
        
        # Convert to UserListItem
        user_items = [
            UserListItem(
                id=user.id,
                username=user.username,
                email=user.email,
                role=user.role,
                fecha_registro=user.fecha_registro.isoformat() if user.fecha_registro else None,
                ultimo_login=user.ultimo_login.isoformat() if user.ultimo_login else None
            )
            for user in users
        ]
        
        # Build pagination metadata
        pagination = PaginationMeta(
            total_users=total_users,
            total_pages=total_pages,
            current_page=page,
            limit=limit
        )
        
        return UserListResponse(
            users=user_items,
            pagination=pagination
        )
    finally:
        db.close()


@router.get("/users/{user_id}", response_model=UserDetailResponse)
@require_admin
async def get_user_detail(
    user_id: int,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get detailed information about a specific user.
    
    Requires admin or superadmin role.
    Returns complete user profile with exchange statistics, review statistics, and skills.
    """
    db = SessionLocal()
    try:
        # Query usuario by ID
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
        
        # Return 404 if not found
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Calculate exchange statistics
        exchanges_sent = db.query(func.count(Intercambio.id)).filter(
            Intercambio.usuario_emisor_id == user_id
        ).scalar() or 0
        
        exchanges_received = db.query(func.count(Intercambio.id)).filter(
            Intercambio.usuario_receptor_id == user_id
        ).scalar() or 0
        
        exchanges_completed = db.query(func.count(Intercambio.id)).filter(
            and_(
                Intercambio.estado == 'completado',
                or_(
                    Intercambio.usuario_emisor_id == user_id,
                    Intercambio.usuario_receptor_id == user_id
                )
            )
        ).scalar() or 0
        
        # Calculate review statistics
        reviews_count = db.query(func.count(Reseña.id)).filter(
            Reseña.receptor_id == user_id
        ).scalar() or 0
        
        average_rating_result = db.query(func.avg(Reseña.calificacion)).filter(
            Reseña.receptor_id == user_id
        ).scalar()
        average_rating = float(average_rating_result) if average_rating_result else 0.0
        
        # Query offered skills via usuarios_habilidades join
        offered_skills = db.query(Habilidad).join(
            UsuarioHabilidad,
            Habilidad.id == UsuarioHabilidad.habilidad_id
        ).filter(
            and_(
                UsuarioHabilidad.usuario_id == user_id,
                UsuarioHabilidad.categoria == 'ofertada'
            )
        ).all()
        
        # Query wanted skills via usuarios_habilidades join
        wanted_skills = db.query(Habilidad).join(
            UsuarioHabilidad,
            Habilidad.id == UsuarioHabilidad.habilidad_id
        ).filter(
            and_(
                UsuarioHabilidad.usuario_id == user_id,
                UsuarioHabilidad.categoria == 'buscada'
            )
        ).all()
        
        # Build response
        return UserDetailResponse(
            user={
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "nombre": user.nombre,
                "apellido": user.apellido,
                "foto_url": user.foto_url,
                "biografia": user.biografia,
                "fecha_registro": user.fecha_registro.isoformat() if user.fecha_registro else None,
                "ultimo_login": user.ultimo_login.isoformat() if user.ultimo_login else None
            },
            stats=UserStats(
                exchanges_sent=exchanges_sent,
                exchanges_received=exchanges_received,
                exchanges_completed=exchanges_completed,
                reviews_count=reviews_count,
                average_rating=average_rating
            ),
            skills=UserSkills(
                offered=[
                    SkillItem(
                        id=skill.id,
                        nombre=skill.nombre,
                        categoria=skill.categoria
                    )
                    for skill in offered_skills
                ],
                wanted=[
                    SkillItem(
                        id=skill.id,
                        nombre=skill.nombre,
                        categoria=skill.categoria
                    )
                    for skill in wanted_skills
                ]
            )
        )
    finally:
        db.close()


@router.patch("/users/{user_id}/role")
@require_superadmin
async def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Update user role (superadmin only).
    
    Requires superadmin role.
    Validates role value, updates database, and logs the change.
    """
    # Validate role value (Pydantic already validates via pattern, but double-check)
    if payload.role not in ['user', 'admin', 'superadmin']:
        raise HTTPException(status_code=400, detail="Rol inválido")
    
    db = SessionLocal()
    try:
        # Query usuario by ID
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
        
        # Return 404 if not found
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Store old role for logging
        old_role = user.role if hasattr(user, 'role') else 'user'
        
        # Update user role in database
        user.role = payload.role
        db.commit()
        
        # Log role change with user_id, old_role, new_role, changed_by, timestamp
        import logging
        from datetime import datetime
        logger = logging.getLogger(__name__)
        logger.info(
            f"Role change: user_id={user_id}, old_role={old_role}, "
            f"new_role={payload.role}, changed_by={current_user_id}, "
            f"timestamp={datetime.utcnow().isoformat()}"
        )
        
        # Return success message with new role
        return {
            "message": "Rol actualizado exitosamente",
            "user_id": user_id,
            "new_role": payload.role
        }
    finally:
        db.close()


@router.get("/skills", response_model=SkillListResponse)
@require_admin
async def get_skills(
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get all skills with usage statistics.
    
    Requires admin or superadmin role.
    Returns all skills ordered by name with counts of users offering and seeking each skill.
    """
    db = SessionLocal()
    try:
        # Query all habilidades ordered by nombre
        skills = db.query(Habilidad).order_by(Habilidad.nombre).all()
        
        # Build response with usage counts
        skills_with_stats = []
        for skill in skills:
            # Count users offering this skill (categoria='ofertada')
            users_offering = db.query(func.count(UsuarioHabilidad.id)).filter(
                and_(
                    UsuarioHabilidad.habilidad_id == skill.id,
                    UsuarioHabilidad.categoria == 'ofertada'
                )
            ).scalar() or 0
            
            # Count users seeking this skill (categoria='buscada')
            users_seeking = db.query(func.count(UsuarioHabilidad.id)).filter(
                and_(
                    UsuarioHabilidad.habilidad_id == skill.id,
                    UsuarioHabilidad.categoria == 'buscada'
                )
            ).scalar() or 0
            
            skills_with_stats.append(
                SkillWithStats(
                    id=skill.id,
                    nombre=skill.nombre,
                    categoria=skill.categoria,
                    users_offering=users_offering,
                    users_seeking=users_seeking
                )
            )
        
        return SkillListResponse(skills=skills_with_stats)
    finally:
        db.close()


@router.delete("/skills/{skill_id}")
@require_admin
async def delete_skill(
    skill_id: int,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Delete a skill if not in use.
    
    Requires admin or superadmin role.
    Checks for active exchanges using this skill before deletion.
    """
    db = SessionLocal()
    try:
        # Query habilidad by ID
        skill = db.query(Habilidad).filter(Habilidad.id == skill_id).first()
        
        # Return 404 if not found
        if not skill:
            raise HTTPException(status_code=404, detail="Habilidad no encontrada")
        
        # Check for active exchanges using this skill (estado in ['pendiente', 'aceptado'])
        active_exchanges = db.query(func.count(Intercambio.id)).filter(
            and_(
                or_(
                    Intercambio.habilidad_id == skill_id,
                    Intercambio.habilidad_solicitada_id == skill_id
                ),
                Intercambio.estado.in_(['pendiente', 'aceptado'])
            )
        ).scalar() or 0
        
        # Return 409 with descriptive message if skill is in use
        if active_exchanges > 0:
            raise HTTPException(
                status_code=409,
                detail=f"No se puede eliminar: la habilidad está siendo usada en {active_exchanges} intercambios activos"
            )
        
        # Delete all usuarios_habilidades records for this skill
        db.query(UsuarioHabilidad).filter(UsuarioHabilidad.habilidad_id == skill_id).delete()
        
        # Delete habilidad record from database
        db.delete(skill)
        db.commit()
        
        # Return success message
        return {
            "message": "Habilidad eliminada exitosamente",
            "skill_id": skill_id
        }
    finally:
        db.close()



@router.get("/reports/activity", response_model=ActivityReportResponse)
@require_admin
async def get_activity_report(
    authorization: Annotated[str, Header()],
    start_date: Optional[str] = Query(None, description="Start date in ISO 8601 format"),
    end_date: Optional[str] = Query(None, description="End date in ISO 8601 format"),
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Generate activity report for a given period.
    
    Requires admin or superadmin role.
    Defaults to last 30 days if dates not provided.
    Returns new users, exchanges created/completed, and daily breakdown.
    """
    db = SessionLocal()
    try:
        # Parse dates or use defaults (last 30 days)
        if end_date:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        else:
            end = datetime.now(timezone.utc)
        
        if start_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        else:
            start = end - timedelta(days=30)
        
        # Count new users registered in period
        new_users = db.query(func.count(Usuario.id)).filter(
            and_(
                Usuario.fecha_registro >= start,
                Usuario.fecha_registro <= end
            )
        ).scalar() or 0
        
        # Count exchanges created in period
        exchanges_created = db.query(func.count(Intercambio.id)).filter(
            and_(
                Intercambio.fecha_creacion >= start,
                Intercambio.fecha_creacion <= end
            )
        ).scalar() or 0
        
        # Count exchanges completed in period
        exchanges_completed = db.query(func.count(Intercambio.id)).filter(
            and_(
                Intercambio.estado == 'completado',
                Intercambio.fecha_creacion >= start,
                Intercambio.fecha_creacion <= end
            )
        ).scalar() or 0
        
        # Generate daily breakdown by iterating through date range
        daily_data = []
        current = start
        while current <= end:
            next_day = current + timedelta(days=1)
            
            # Count new users for this day
            day_users = db.query(func.count(Usuario.id)).filter(
                and_(
                    Usuario.fecha_registro >= current,
                    Usuario.fecha_registro < next_day
                )
            ).scalar() or 0
            
            # Count exchanges created for this day
            day_exchanges = db.query(func.count(Intercambio.id)).filter(
                and_(
                    Intercambio.fecha_creacion >= current,
                    Intercambio.fecha_creacion < next_day
                )
            ).scalar() or 0
            
            daily_data.append(
                DailyActivity(
                    date=current.date().isoformat(),
                    new_users=day_users,
                    exchanges=day_exchanges
                )
            )
            
            current = next_day
        
        # Return ActivityReportResponse with period, summary, and daily_data
        return ActivityReportResponse(
            period={
                "start": start.isoformat(),
                "end": end.isoformat()
            },
            summary={
                "new_users": new_users,
                "exchanges_created": exchanges_created,
                "exchanges_completed": exchanges_completed
            },
            daily_data=daily_data
        )
    finally:
        db.close()


@router.get("/skills/categories", response_model=CategoriesResponse)
@require_admin
async def get_skill_categories(
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get list of unique skill categories.
    
    Requires admin or superadmin role.
    Returns distinct categories from all skills for autocomplete functionality.
    """
    db = SessionLocal()
    try:
        # Query DISTINCT categoria FROM habilidades
        categories_query = db.query(Habilidad.categoria).distinct().order_by(Habilidad.categoria).all()
        
        # Extract category strings from query result
        categories = [cat[0] for cat in categories_query if cat[0]]
        
        return CategoriesResponse(categories=categories)
    finally:
        db.close()


@router.post("/skills")
@require_admin
async def create_skill(
    payload: SkillCreateRequest,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Create a new skill.
    
    Requires admin or superadmin role.
    Validates that skill name doesn't already exist and that both fields meet requirements:
    - Maximum 20 characters
    - Only letters and spaces allowed
    """
    db = SessionLocal()
    try:
        # Normalize nombre for comparison (trim and lowercase)
        nombre_normalized = payload.nombre.strip().lower()
        
        # Check if skill already exists (case-insensitive)
        existing_skill = db.query(Habilidad).filter(
            func.lower(Habilidad.nombre) == nombre_normalized
        ).first()
        
        if existing_skill:
            raise HTTPException(
                status_code=409,
                detail=f"La habilidad '{payload.nombre}' ya existe"
            )
        
        # Create new skill
        new_skill = Habilidad(
            nombre=payload.nombre.strip(),
            categoria=payload.categoria.strip()
        )
        
        db.add(new_skill)
        db.commit()
        db.refresh(new_skill)
        
        # Return created skill
        return {
            "message": "Habilidad creada exitosamente",
            "skill": {
                "id": new_skill.id,
                "nombre": new_skill.nombre,
                "categoria": new_skill.categoria
            }
        }
    finally:
        db.close()
