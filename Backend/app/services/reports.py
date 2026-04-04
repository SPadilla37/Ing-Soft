"""
Report service layer for user reports system.

Handles validation, business logic, and operations related to user reports.
"""

import re
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.db.models.entities import Reporte, Usuario


def sanitize_text_input(text: str) -> str:
    """
    Sanitize text input to prevent XSS and injection attacks.
    
    Args:
        text: Raw text input from user
        
    Returns:
        Sanitized text safe for storage
    """
    if not text:
        return text
    
    # Remove potentially dangerous HTML/script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<iframe[^>]*>.*?</iframe>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    text = re.sub(r'on\w+\s*=', '', text, flags=re.IGNORECASE)
    
    # Escape HTML special characters
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#x27;')
    
    return text


def check_self_report(reportante_id: int, reportado_id: int) -> Tuple[bool, Optional[str]]:
    """
    Check if a user is trying to report themselves.
    
    Args:
        reportante_id: ID of the user creating the report
        reportado_id: ID of the user being reported
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if reportante_id == reportado_id:
        return False, "No puedes reportarte a ti mismo"
    return True, None


def check_duplicate_active_report(
    db: Session,
    reportante_id: int,
    reportado_id: int
) -> Tuple[bool, Optional[str]]:
    """
    Check if there's already an active report between these users.
    
    Args:
        db: Database session
        reportante_id: ID of the user creating the report
        reportado_id: ID of the user being reported
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    existing_report = db.query(Reporte).filter(
        and_(
            Reporte.reportante_id == reportante_id,
            Reporte.reportado_id == reportado_id,
            Reporte.estado.in_(['pendiente', 'en_revision'])
        )
    ).first()
    
    if existing_report:
        return False, "Ya existe un reporte activo entre estos usuarios"
    return True, None


def check_rate_limit(
    db: Session,
    reportante_id: int,
    limit: int = 3
) -> Tuple[bool, Optional[str]]:
    """
    Check if user has exceeded daily report limit.
    
    Args:
        db: Database session
        reportante_id: ID of the user creating the report
        limit: Maximum reports per day (default: 3)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    report_count = db.query(func.count(Reporte.id)).filter(
        and_(
            Reporte.reportante_id == reportante_id,
            Reporte.fecha_creacion >= today_start,
            Reporte.fecha_creacion < today_end
        )
    ).scalar()
    
    if report_count >= limit:
        return False, f"Has alcanzado el límite de {limit} reportes por día. Intenta mañana."
    return True, None


def validate_report_creation(
    db: Session,
    reportante_id: int,
    reportado_id: int,
    rate_limit: int = 3
) -> Tuple[bool, Optional[str]]:
    """
    Perform all validations for report creation.
    
    Args:
        db: Database session
        reportante_id: ID of the user creating the report
        reportado_id: ID of the user being reported
        rate_limit: Maximum reports per day
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check self-report
    is_valid, error = check_self_report(reportante_id, reportado_id)
    if not is_valid:
        return is_valid, error
    
    # Check duplicate active report
    is_valid, error = check_duplicate_active_report(db, reportante_id, reportado_id)
    if not is_valid:
        return is_valid, error
    
    # Check rate limit
    is_valid, error = check_rate_limit(db, reportante_id, rate_limit)
    if not is_valid:
        return is_valid, error
    
    return True, None


def get_reported_user_snapshot(db: Session, reportado_id: int) -> Optional[str]:
    """
    Get the username snapshot of the reported user.
    
    Args:
        db: Database session
        reportado_id: ID of the user being reported
        
    Returns:
        Username of the reported user, or None if user doesn't exist
    """
    usuario = db.query(Usuario).filter(Usuario.id == reportado_id).first()
    if usuario:
        return usuario.username
    return None


def validate_status_transition(current_status: str, new_status: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that a status transition is allowed.
    
    Valid transitions:
    - pendiente → en_revision, descartado
    - en_revision → resuelto, descartado
    - resuelto → (no transitions allowed)
    - descartado → (no transitions allowed)
    
    Args:
        current_status: Current status of the report
        new_status: Desired new status
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    valid_transitions = {
        'pendiente': ['en_revision', 'descartado'],
        'en_revision': ['resuelto', 'descartado'],
        'resuelto': [],
        'descartado': []
    }
    
    if current_status not in valid_transitions:
        return False, f"Estado actual inválido: {current_status}"
    
    if new_status not in valid_transitions[current_status]:
        return False, f"Transición no permitida: {current_status} → {new_status}"
    
    return True, None
