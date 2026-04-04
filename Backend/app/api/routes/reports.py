"""
API routes for user reports system.

Handles report creation and user-facing report management endpoints.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Query, Header
from typing import Annotated

from app.db.database import SessionLocal
from app.db.models.entities import Reporte, Usuario
from app.schemas.reports import (
    ReportCreateRequest,
    ReportResponse,
    ReportListResponse,
    PaginationMeta
)
from app.services.reports import (
    validate_report_creation,
    sanitize_text_input,
    get_reported_user_snapshot
)
from app.core.security import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


def get_user_from_token(authorization: str) -> int:
    """
    Extract and validate user ID from JWT token.
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        User ID from token
        
    Raises:
        HTTPException: If token is invalid or missing
    """
    if not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=401,
            detail="Token no proporcionado"
        )
    
    token = authorization.replace('Bearer ', '')
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Token inválido o expirado"
        )
    
    user_id = payload.get('sub')
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Token inválido"
        )

    try:
        return int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Token inválido"
        )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ReportResponse)
async def create_report(
    request: ReportCreateRequest,
    authorization: Annotated[str, Header(alias="Authorization")]
):
    """
    Create a new report about another user.
    
    Validates:
    - User is authenticated
    - User is not reporting themselves
    - No active duplicate report exists
    - User hasn't exceeded daily rate limit (3 reports/day)
    - Description doesn't exceed 500 characters
    
    Returns:
        201 Created with report data
        400 Bad Request for validation errors
        429 Too Many Requests if rate limit exceeded
    """
    # Get current user from token
    current_user_id = get_user_from_token(authorization)
    
    db = SessionLocal()
    try:
        # Validate all business rules
        is_valid, error_message = validate_report_creation(
            db,
            current_user_id,
            request.reportado_id,
            rate_limit=3
        )
        
        if not is_valid:
            logger.warning(
                f"Report validation failed for user {current_user_id}: {error_message}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        
        # Check if reported user exists
        reported_user = db.query(Usuario).filter(
            Usuario.id == request.reportado_id
        ).first()
        
        if not reported_user:
            logger.warning(
                f"Report creation failed: reported user {request.reportado_id} not found"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario reportado no existe"
            )
        
        # Sanitize inputs
        motivo = sanitize_text_input(request.motivo)
        descripcion = sanitize_text_input(request.descripcion) if request.descripcion else None
        
        # Create report
        reporte = Reporte(
            reportante_id=current_user_id,
            reportado_id=request.reportado_id,
            reportado_username_snapshot=reported_user.username,
            motivo=motivo,
            descripcion=descripcion,
            estado='pendiente',
            fecha_creacion=datetime.utcnow()
        )
        
        db.add(reporte)
        db.commit()
        db.refresh(reporte)
        
        # Log report creation
        logger.info(
            f"Report created: id={reporte.id}, "
            f"reporter={current_user_id}, "
            f"reported={request.reportado_id}, "
            f"reason={motivo}"
        )
        
        return ReportResponse(
            id=reporte.id,
            reportado_username=reporte.reportado_username_snapshot,
            motivo=reporte.motivo,
            descripcion=reporte.descripcion,
            estado=reporte.estado,
            fecha_creacion=reporte.fecha_creacion.isoformat(),
            fecha_resolucion=None,
            accion_tomada=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating report: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear el reporte"
        )
    finally:
        db.close()


@router.get("/my-reports", response_model=ReportListResponse)
async def get_my_reports(
    authorization: Annotated[str, Header(alias="Authorization")],
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page")
):
    """
    Get reports created by the current user.
    
    Returns paginated list of reports with status information.
    """
    # Get current user from token
    current_user_id = get_user_from_token(authorization)
    
    db = SessionLocal()
    try:
        # Calculate offset
        offset = (page - 1) * limit
        
        # Query reports created by current user
        query = db.query(Reporte).filter(
            Reporte.reportante_id == current_user_id
        ).order_by(Reporte.fecha_creacion.desc())
        
        # Get total count
        total = query.count()
        
        # Get paginated results
        reports = query.offset(offset).limit(limit).all()
        
        # Convert to response format
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
            pagination=PaginationMeta(
                page=page,
                limit=limit,
                total=total,
                pages=total_pages
            )
        )
        
    except Exception as e:
        logger.error(f"Error fetching user reports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener reportes"
        )
    finally:
        db.close()
