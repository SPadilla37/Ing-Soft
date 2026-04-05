from fastapi import APIRouter, Header, Query, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Annotated, Optional
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta, timezone
import logging
import asyncio
import json

from app.core.auth_middleware import require_admin, require_superadmin
from app.db.database import SessionLocal
from app.db.models.entities import Usuario, Intercambio, Reseña, Habilidad, UsuarioHabilidad, Conversacion, Mensaje, IntercambioFinalizacion
from app.services.notifications import push_notification
from app.services.email import send_notification_email
from app.core.config import settings
from app.schemas.admin import (
    StatsResponse, UserListResponse, UserListItem, PaginationMeta,
    UserDetailResponse, UserStats, UserSkills, SkillItem, RoleUpdateRequest,
    SkillWithStats, SkillListResponse, ActivityReportResponse, DailyActivity,
    SkillCreateRequest, CategoriesResponse
)
import math

# Initialize router with admin prefix and tags
router = APIRouter(prefix="/admin", tags=["admin"])

# SSE event queue for broadcasting admin events
admin_event_queues = []

async def broadcast_admin_event(event_data: dict):
    """Broadcast an event to all connected admin SSE clients."""
    dead_queues = []
    for queue in admin_event_queues:
        try:
            await queue.put(event_data)
        except:
            dead_queues.append(queue)
    
    # Remove dead queues
    for queue in dead_queues:
        admin_event_queues.remove(queue)


@router.get("/stats", response_model=StatsResponse)
@require_admin
async def get_stats(
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get platform statistics.
    
    Requires admin role.
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
        average_rating = round(average_rating,2)
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
    
    Requires admin role.
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
                is_suspended=user.is_suspended,
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
    
    Requires admin role.
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
        average_rating = round(average_rating,2)
        
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
                "is_suspended": user.is_suspended,
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
@require_admin
async def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Update user role (admin only).
    
    Requires admin role.
    Validates role value, updates database, and logs the change.
    """
    # Validate role value (Pydantic already validates via pattern, but double-check)
    if payload.role not in ['user', 'admin']:
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
    
    Requires admin role.
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
    
    Requires admin role.
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
    
    Requires admin role.
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
    
    Requires admin role.
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
    
    Requires admin role.
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


@router.patch("/users/{user_id}/suspend")
@require_admin
async def suspend_user(
    user_id: int,
    authorization: Annotated[str, Header()],
    background_tasks: BackgroundTasks,
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Suspend a user account.
    
    Requires admin role.
    Prevents self-suspension.
    Updates is_suspended field to True.
    Cancels all active exchanges (pendiente, aceptado) automatically.
    """
    if user_id == current_user_id:
        raise HTTPException(status_code=400, detail="No puedes suspender tu propia cuenta")
    
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Cancelar todos los intercambios activos del usuario
        active_exchanges = db.query(Intercambio).filter(
            or_(
                Intercambio.usuario_emisor_id == user_id,
                Intercambio.usuario_receptor_id == user_id
            ),
            Intercambio.estado.in_(['pendiente', 'aceptado'])
        ).all()
        
        cancelled_count = len(active_exchanges)
        affected_users = set()
        
        for exchange in active_exchanges:
            exchange.estado = 'cancelado'
            
            # Identificar al otro usuario afectado
            other_user_id = exchange.usuario_receptor_id if exchange.usuario_emisor_id == user_id else exchange.usuario_emisor_id
            affected_users.add(other_user_id)
        
        user.is_suspended = True
        db.commit()
        
        logger = logging.getLogger(__name__)
        logger.info(
            f"Account suspended: user_id={user_id}, suspended_by={current_user_id}, "
            f"cancelled_exchanges={cancelled_count}, timestamp={datetime.utcnow().isoformat()}"
        )
        
        # Notificar al usuario suspendido
        background_tasks.add_task(
            push_notification,
            user_id,
            {"type": "account_suspended", "message": "Tu cuenta ha sido suspendida"}
        )
        
        # Notificar a los usuarios afectados por la cancelación de intercambios
        for affected_user_id in affected_users:
            background_tasks.add_task(
                push_notification,
                affected_user_id,
                {
                    "type": "exchange_cancelled",
                    "message": "Un intercambio ha sido cancelado debido a la suspensión de una cuenta"
                }
            )
        
        if user.email:
            user_name = f"{user.nombre} {user.apellido}".strip() or user.username
            background_tasks.add_task(
                send_notification_email,
                subject="Tu cuenta ha sido suspendida - Habilio",
                email_to=user.email,
                template_name="cuenta_suspendida.html",
                context={"user_name": user_name, "frontend_url": settings.FRONTEND_URL}
            )
        
        return {
            "message": "Cuenta suspendida exitosamente",
            "user_id": user_id,
            "is_suspended": True,
            "cancelled_exchanges": cancelled_count
        }
    finally:
        db.close()


@router.patch("/users/{user_id}/unsuspend")
@require_admin
async def unsuspend_user(
    user_id: int,
    authorization: Annotated[str, Header()],
    background_tasks: BackgroundTasks,
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Reactivate a suspended user account.
    
    Requires admin role.
    Updates is_suspended field to False.
    """
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        user.is_suspended = False
        db.commit()
        
        logger = logging.getLogger(__name__)
        logger.info(
            f"Account unsuspended: user_id={user_id}, unsuspended_by={current_user_id}, "
            f"timestamp={datetime.utcnow().isoformat()}"
        )
        
        if user.email:
            user_name = f"{user.nombre} {user.apellido}".strip() or user.username
            background_tasks.add_task(
                send_notification_email,
                subject="Tu cuenta ha sido reactivada - Habilio",
                email_to=user.email,
                template_name="cuenta_reactivada.html",
                context={"user_name": user_name, "frontend_url": settings.FRONTEND_URL}
            )
        
        return {
            "message": "Cuenta reactivada exitosamente",
            "user_id": user_id,
            "is_suspended": False
        }
    finally:
        db.close()


@router.delete("/users/{user_id}")
@require_admin
async def delete_user(
    user_id: int,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Permanently delete a user account.
    
    Requires admin role.
    Prevents self-deletion.
    Requires the account to be suspended first.
    Handles related data deletion (conversations, messages, reviews, exchanges).
    """
    if user_id == current_user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Verificar que la cuenta esté suspendida
        if not user.is_suspended:
            raise HTTPException(
                status_code=400,
                detail="Debes suspender la cuenta antes de eliminarla"
            )
        
        # Verificar que no haya intercambios activos (por seguridad adicional)
        active_exchanges = db.query(func.count(Intercambio.id)).filter(
            or_(
                Intercambio.usuario_emisor_id == user_id,
                Intercambio.usuario_receptor_id == user_id
            ),
            Intercambio.estado.in_(['pendiente', 'aceptado'])
        ).scalar() or 0
        
        if active_exchanges > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Error: el usuario aún tiene {active_exchanges} intercambios activos. Esto no debería ocurrir."
            )
        
        # Eliminar mensajes del usuario
        db.query(Mensaje).filter(Mensaje.remitente_id == user_id).delete()
        
        # Eliminar conversaciones donde el usuario participa
        db.query(Conversacion).filter(
            or_(
                Conversacion.usuario_1_id == user_id,
                Conversacion.usuario_2_id == user_id
            )
        ).delete()
        
        # Eliminar habilidades del usuario
        db.query(UsuarioHabilidad).filter(UsuarioHabilidad.usuario_id == user_id).delete()
        
        # Eliminar reseñas (como autor o receptor)
        db.query(Reseña).filter(or_(Reseña.autor_id == user_id, Reseña.receptor_id == user_id)).delete()
        
        # Eliminar finalizaciones de intercambios
        db.query(IntercambioFinalizacion).filter(IntercambioFinalizacion.usuario_id == user_id).delete()
        
        # Eliminar todos los intercambios (ya deberían estar cancelados)
        db.query(Intercambio).filter(
            or_(
                Intercambio.usuario_emisor_id == user_id,
                Intercambio.usuario_receptor_id == user_id
            )
        ).delete()
        
        # Finalmente, eliminar el usuario
        db.delete(user)
        db.commit()
        
        logger = logging.getLogger(__name__)
        logger.warning(
            f"Account deleted: user_id={user_id}, deleted_by={current_user_id}, "
            f"timestamp={datetime.utcnow().isoformat()}"
        )
        
        return {
            "message": "Cuenta eliminada exitosamente",
            "user_id": user_id
        }
    finally:
        db.close()


# ============================================================================
# REPORT MANAGEMENT ENDPOINTS
# ============================================================================

from app.db.models.entities import Reporte
from app.schemas.reports import (
    ReportDetailResponse, ReportStatsResponse, ReportListResponse,
    ReportStatusUpdateRequest, ReportResolveRequest, PaginationMeta as ReportPaginationMeta
)
from app.services.reports import validate_status_transition


@router.get("/reports", response_model=ReportListResponse)
@require_admin
async def get_reports(
    authorization: Annotated[str, Header()],
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by reported username"),
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get paginated list of reports with optional filtering.
    
    Requires admin role.
    Supports filtering by status and searching by reported username.
    """
    db = SessionLocal()
    try:
        # Build query
        query = db.query(Reporte)
        
        # Apply status filter if provided
        if status and status != 'all':
            query = query.filter(Reporte.estado == status)
        
        # Apply search filter if provided
        if search:
            query = query.filter(
                Reporte.reportado_username_snapshot.ilike(f"%{search}%")
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        reports = query.order_by(Reporte.fecha_creacion.desc()).offset(offset).limit(limit).all()
        
        # Convert to response format
        from app.schemas.reports import ReportResponse
        report_responses = [
            ReportResponse(
                id=r.id,
                reportado_username=r.reportado_username_snapshot,
                motivo=r.motivo,
                descripcion=r.descripcion,
                estado=r.estado,
                fecha_creacion=r.fecha_creacion.isoformat(),
                fecha_resolucion=r.fecha_resolucion.isoformat() if r.fecha_resolucion else None,
                accion_tomada=r.accion_tomada
            )
            for r in reports
        ]
        
        # Calculate total pages
        total_pages = (total + limit - 1) // limit
        
        return ReportListResponse(
            reports=report_responses,
            pagination=ReportPaginationMeta(
                page=page,
                limit=limit,
                total=total,
                pages=total_pages
            )
        )
    finally:
        db.close()


@router.get("/reports/stats", response_model=ReportStatsResponse)
@require_admin
async def get_report_stats(
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get report statistics.
    
    Requires admin role.
    Returns counts of pending and resolved reports.
    """
    db = SessionLocal()
    try:
        pending_count = db.query(func.count(Reporte.id)).filter(
            Reporte.estado == 'pendiente'
        ).scalar() or 0
        
        resolved_count = db.query(func.count(Reporte.id)).filter(
            Reporte.estado == 'resuelto'
        ).scalar() or 0
        
        total_count = db.query(func.count(Reporte.id)).scalar() or 0
        
        return ReportStatsResponse(
            pending_count=pending_count,
            resolved_count=resolved_count,
            total_count=total_count
        )
    finally:
        db.close()


@router.get("/reports/{report_id}", response_model=ReportDetailResponse)
@require_admin
async def get_report_detail(
    report_id: int,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Get detailed information about a specific report.
    
    Requires admin role.
    Returns full report details including:
    - Reporter and reported user information
    - Reviews received by both users
    - Conversation history between them
    """
    db = SessionLocal()
    try:
        report = db.query(Reporte).filter(Reporte.id == report_id).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        
        # Log report access for audit trail
        logger = logging.getLogger(__name__)
        logger.info(
            f"Report accessed: report_id={report_id}, admin_id={current_user_id}, "
            f"timestamp={datetime.utcnow().isoformat()}"
        )
        
        # Build reporter info if available
        reportante_info = None
        if report.reportante_id:
            reportante = db.query(Usuario).filter(Usuario.id == report.reportante_id).first()
            if reportante:
                reportante_info = {
                    "id": reportante.id,
                    "username": reportante.username,
                    "email": reportante.email
                }
        
        # Build reported user info
        reportado_info = None
        if report.reportado_id:
            reportado = db.query(Usuario).filter(Usuario.id == report.reportado_id).first()
            if reportado:
                reportado_info = {
                    "id": reportado.id,
                    "username": reportado.username,
                    "email": reportado.email,
                    "is_suspended": reportado.is_suspended
                }
        
        # Build resolver info if available
        resolvedor_info = None
        if report.resuelto_por:
            resolvedor = db.query(Usuario).filter(Usuario.id == report.resuelto_por).first()
            if resolvedor:
                resolvedor_info = {
                    "id": resolvedor.id,
                    "username": resolvedor.username,
                    "email": resolvedor.email
                }
        
        # Get reviews received by reported user
        reportado_reviews = []
        if report.reportado_id:
            reviews = db.query(Reseña).filter(
                Reseña.receptor_id == report.reportado_id
            ).order_by(Reseña.created_at.desc()).limit(10).all()
            
            for review in reviews:
                autor = db.query(Usuario).filter(Usuario.id == review.autor_id).first()
                reportado_reviews.append({
                    "id": review.id,
                    "calificacion": review.calificacion,
                    "comentario": review.comentario,
                    "fecha_creacion": review.created_at.isoformat() if review.created_at else None,
                    "autor_username": autor.username if autor else "Usuario eliminado",
                    "intercambio_id": review.intercambio_id
                })
        
        # Get reviews received by reporter
        reportante_reviews = []
        if report.reportante_id:
            reviews = db.query(Reseña).filter(
                Reseña.receptor_id == report.reportante_id
            ).order_by(Reseña.created_at.desc()).limit(10).all()
            
            for review in reviews:
                autor = db.query(Usuario).filter(Usuario.id == review.autor_id).first()
                reportante_reviews.append({
                    "id": review.id,
                    "calificacion": review.calificacion,
                    "comentario": review.comentario,
                    "fecha_creacion": review.created_at.isoformat() if review.created_at else None,
                    "autor_username": autor.username if autor else "Usuario eliminado",
                    "intercambio_id": review.intercambio_id
                })
        
        # Get conversation history between reporter and reported user
        conversation_info = None
        if report.reportante_id and report.reportado_id:
            # Find conversation between these two users
            conversacion = db.query(Conversacion).filter(
                or_(
                    and_(
                        Conversacion.usuario_1_id == report.reportante_id,
                        Conversacion.usuario_2_id == report.reportado_id
                    ),
                    and_(
                        Conversacion.usuario_1_id == report.reportado_id,
                        Conversacion.usuario_2_id == report.reportante_id
                    )
                )
            ).first()
            
            if conversacion:
                # Get total message count BEFORE report creation
                total_mensajes = db.query(func.count(Mensaje.id)).filter(
                    and_(
                        Mensaje.conversacion_id == conversacion.id,
                        Mensaje.enviado_at <= report.fecha_creacion
                    )
                ).scalar() or 0
                
                # Get first message for fecha_inicio
                primer_mensaje = db.query(Mensaje).filter(
                    Mensaje.conversacion_id == conversacion.id
                ).order_by(Mensaje.enviado_at.asc()).first()
                
                # Get last 10 messages BEFORE report creation
                mensajes = db.query(Mensaje).filter(
                    and_(
                        Mensaje.conversacion_id == conversacion.id,
                        Mensaje.enviado_at <= report.fecha_creacion
                    )
                ).order_by(Mensaje.enviado_at.desc()).limit(10).all()
                
                mensajes_info = []
                for mensaje in reversed(mensajes):  # Reverse to show chronologically
                    remitente = db.query(Usuario).filter(Usuario.id == mensaje.remitente_id).first()
                    mensajes_info.append({
                        "id": mensaje.id,
                        "remitente_id": mensaje.remitente_id,
                        "remitente_username": remitente.username if remitente else "Usuario eliminado",
                        "contenido": mensaje.contenido,
                        "enviado_at": mensaje.enviado_at.isoformat() if mensaje.enviado_at else None
                    })
                
                # Get last message content (before report)
                ultimo_mensaje = mensajes[0].contenido if mensajes else None
                
                conversation_info = {
                    "id": conversacion.id,
                    "fecha_inicio": primer_mensaje.enviado_at.isoformat() if primer_mensaje and primer_mensaje.enviado_at else None,
                    "ultimo_mensaje": ultimo_mensaje,
                    "total_mensajes": total_mensajes,
                    "mensajes_recientes": mensajes_info
                }
        
        return ReportDetailResponse(
            id=report.id,
            reportante=reportante_info,
            reportado=reportado_info,
            reportado_username=report.reportado_username_snapshot,
            motivo=report.motivo,
            descripcion=report.descripcion,
            estado=report.estado,
            fecha_creacion=report.fecha_creacion.isoformat(),
            fecha_resolucion=report.fecha_resolucion.isoformat() if report.fecha_resolucion else None,
            accion_tomada=report.accion_tomada,
            resuelto_por=resolvedor_info,
            notas_admin=report.notas_admin,
            reportado_reviews=reportado_reviews,
            reportante_reviews=reportante_reviews,
            conversation_history=conversation_info
        )
    finally:
        db.close()


@router.patch("/reports/{report_id}/status")
@require_admin
async def update_report_status(
    report_id: int,
    payload: ReportStatusUpdateRequest,
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Update report status.
    
    Requires admin role.
    Validates status transitions before updating.
    """
    db = SessionLocal()
    try:
        report = db.query(Reporte).filter(Reporte.id == report_id).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        
        # Validate status transition
        is_valid, error_message = validate_status_transition(report.estado, payload.status)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        # Update status
        old_status = report.estado
        report.estado = payload.status
        db.commit()
        
        # Log status change
        logger = logging.getLogger(__name__)
        logger.info(
            f"Report status changed: report_id={report_id}, "
            f"old_status={old_status}, new_status={payload.status}, "
            f"admin_id={current_user_id}, timestamp={datetime.utcnow().isoformat()}"
        )
        
        from app.schemas.reports import ReportResponse
        return ReportResponse(
            id=report.id,
            reportado_username=report.reportado_username_snapshot,
            motivo=report.motivo,
            descripcion=report.descripcion,
            estado=report.estado,
            fecha_creacion=report.fecha_creacion.isoformat(),
            fecha_resolucion=report.fecha_resolucion.isoformat() if report.fecha_resolucion else None,
            accion_tomada=report.accion_tomada
        )
    finally:
        db.close()


@router.patch("/reports/{report_id}/resolve")
@require_admin
async def resolve_report(
    report_id: int,
    payload: ReportResolveRequest,
    authorization: Annotated[str, Header()],
    background_tasks: BackgroundTasks,
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Resolve a report with an action.
    
    Requires admin role.
    Handles suspension/deletion integration and notifications.
    For suspension: suspends user and sends email.
    For deletion: suspends user first (with email), then deletes the account.
    """
    db = SessionLocal()
    try:
        report = db.query(Reporte).filter(Reporte.id == report_id).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        
        # Update report
        report.estado = 'resuelto'
        report.accion_tomada = payload.action
        report.resuelto_por = current_user_id
        report.fecha_resolucion = datetime.utcnow()
        if payload.notas_admin:
            report.notas_admin = payload.notas_admin
        
        # Handle actions
        if payload.action == 'suspension':
            if report.reportado_id:
                reported_user = db.query(Usuario).filter(Usuario.id == report.reportado_id).first()
                if reported_user:
                    # Suspend user
                    reported_user.is_suspended = True
                    
                    # Cancel active exchanges
                    active_exchanges = db.query(Intercambio).filter(
                        or_(
                            Intercambio.usuario_emisor_id == report.reportado_id,
                            Intercambio.usuario_receptor_id == report.reportado_id
                        ),
                        Intercambio.estado.in_(['pendiente', 'aceptado'])
                    ).all()
                    
                    affected_users = set()
                    for exchange in active_exchanges:
                        exchange.estado = 'cancelado'
                        other_user_id = exchange.usuario_receptor_id if exchange.usuario_emisor_id == report.reportado_id else exchange.usuario_emisor_id
                        affected_users.add(other_user_id)
                    
                    db.commit()
                    
                    logger = logging.getLogger(__name__)
                    logger.warning(
                        f"Report resolved with suspension: report_id={report_id}, "
                        f"user_id={report.reportado_id}, admin_id={current_user_id}, "
                        f"timestamp={datetime.utcnow().isoformat()}"
                    )
                    
                    # Send suspension email
                    if reported_user.email:
                        user_name = f"{reported_user.nombre} {reported_user.apellido}".strip() or reported_user.username
                        background_tasks.add_task(
                            send_notification_email,
                            subject="Tu cuenta ha sido suspendida - Habilio",
                            email_to=reported_user.email,
                            template_name="cuenta_suspendida.html",
                            context={"user_name": user_name, "frontend_url": settings.FRONTEND_URL}
                        )
                    
                    # Notify affected users
                    for affected_user_id in affected_users:
                        background_tasks.add_task(
                            push_notification,
                            affected_user_id,
                            {
                                "type": "exchange_cancelled",
                                "message": "Un intercambio ha sido cancelado debido a la suspensión de una cuenta"
                            }
                        )
                    
                    # Broadcast SSE event
                    background_tasks.add_task(
                        broadcast_admin_event,
                        {
                            "type": "user_suspended",
                            "user_id": report.reportado_id,
                            "report_id": report_id,
                            "message": f"Usuario {reported_user.username} ha sido suspendido"
                        }
                    )
        
        elif payload.action == 'eliminacion':
            if report.reportado_id:
                reported_user = db.query(Usuario).filter(Usuario.id == report.reportado_id).first()
                if reported_user:
                    # Step 1: Suspend user first
                    reported_user.is_suspended = True
                    
                    # Cancel active exchanges
                    active_exchanges = db.query(Intercambio).filter(
                        or_(
                            Intercambio.usuario_emisor_id == report.reportado_id,
                            Intercambio.usuario_receptor_id == report.reportado_id
                        ),
                        Intercambio.estado.in_(['pendiente', 'aceptado'])
                    ).all()
                    
                    for exchange in active_exchanges:
                        exchange.estado = 'cancelado'
                    
                    db.commit()
                    
                    # Send suspension email before deletion
                    if reported_user.email:
                        user_name = f"{reported_user.nombre} {reported_user.apellido}".strip() or reported_user.username
                        background_tasks.add_task(
                            send_notification_email,
                            subject="Tu cuenta ha sido suspendida - Habilio",
                            email_to=reported_user.email,
                            template_name="cuenta_suspendida.html",
                            context={"user_name": user_name, "frontend_url": settings.FRONTEND_URL}
                        )
                    
                    # Step 2: Delete user account
                    # Delete related data
                    db.query(Mensaje).filter(Mensaje.remitente_id == report.reportado_id).delete()
                    db.query(Conversacion).filter(
                        or_(
                            Conversacion.usuario_1_id == report.reportado_id,
                            Conversacion.usuario_2_id == report.reportado_id
                        )
                    ).delete()
                    db.query(UsuarioHabilidad).filter(UsuarioHabilidad.usuario_id == report.reportado_id).delete()
                    db.query(Reseña).filter(or_(Reseña.autor_id == report.reportado_id, Reseña.receptor_id == report.reportado_id)).delete()
                    db.query(IntercambioFinalizacion).filter(IntercambioFinalizacion.usuario_id == report.reportado_id).delete()
                    db.query(Intercambio).filter(
                        or_(
                            Intercambio.usuario_emisor_id == report.reportado_id,
                            Intercambio.usuario_receptor_id == report.reportado_id
                        )
                    ).delete()
                    
                    # Delete user
                    db.delete(reported_user)
                    db.commit()
                    
                    logger = logging.getLogger(__name__)
                    logger.warning(
                        f"Report resolved with deletion: report_id={report_id}, "
                        f"user_id={report.reportado_id}, admin_id={current_user_id}, "
                        f"timestamp={datetime.utcnow().isoformat()}"
                    )
                    
                    # Broadcast SSE event
                    background_tasks.add_task(
                        broadcast_admin_event,
                        {
                            "type": "user_deleted",
                            "user_id": report.reportado_id,
                            "report_id": report_id,
                            "message": f"Usuario ha sido eliminado"
                        }
                    )
        
        db.commit()
        
        # Send notifications
        if report.reportante_id:
            background_tasks.add_task(
                push_notification,
                report.reportante_id,
                {
                    "type": "report_resolved",
                    "message": "Tu reporte ha sido revisado y resuelto"
                }
            )
        
        # Only send notification to reported user if action is 'ninguna' (no suspension/deletion)
        if report.reportado_id and payload.action == 'ninguna':
            background_tasks.add_task(
                push_notification,
                report.reportado_id,
                {
                    "type": "report_action",
                    "message": "Se ha revisado un reporte sobre tu cuenta. No se tomó ninguna acción."
                }
            )
        
        # Broadcast report update
        background_tasks.add_task(
            broadcast_admin_event,
            {
                "type": "report_updated",
                "report_id": report_id,
                "message": f"Reporte #{report_id} ha sido resuelto"
            }
        )
        
        from app.schemas.reports import ReportResponse
        return ReportResponse(
            id=report.id,
            reportado_username=report.reportado_username_snapshot,
            motivo=report.motivo,
            descripcion=report.descripcion,
            estado=report.estado,
            fecha_creacion=report.fecha_creacion.isoformat(),
            fecha_resolucion=report.fecha_resolucion.isoformat() if report.fecha_resolucion else None,
            accion_tomada=report.accion_tomada
        )
    finally:
        db.close()



@router.get("/reports/stream")
@require_admin
async def reports_stream(
    authorization: Annotated[str, Header()],
    current_user_id: int = None,
    current_user_role: str = None
):
    """
    Server-Sent Events (SSE) endpoint for real-time report updates.
    
    Requires admin role.
    Streams events when reports are updated, users are suspended, or users are deleted.
    """
    async def event_generator():
        # Create a queue for this client
        queue = asyncio.Queue()
        admin_event_queues.append(queue)
        
        try:
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected', 'message': 'Conectado al stream de reportes'})}\n\n"
            
            # Keep connection alive and send events
            while True:
                try:
                    # Wait for events with timeout to send keepalive
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            # Client disconnected
            pass
        finally:
            # Remove queue when client disconnects
            if queue in admin_event_queues:
                admin_event_queues.remove(queue)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
