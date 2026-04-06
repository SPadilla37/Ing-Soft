"""
Support contact endpoint - sends emails to support team
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from sqlalchemy import select
from app.db.database import SessionLocal
from app.db.models.entities import Usuario
from app.services.email import send_notification_email
from app.core.config import settings
from app.core.text_moderation import moderate_text
import logging
import asyncio
import hashlib

router = APIRouter()
logger = logging.getLogger(__name__)

# Rate limiting cache (simple in-memory, resets on restart)
# Structure: {key: [timestamp1, timestamp2, ...]}
# Keys format: "ip:192.168.1.1" or "email:user@example.com"
_rate_limit_cache = {}


class SupportContactRequest(BaseModel):
    email: EmailStr
    subject: str = Field(..., min_length=5, max_length=200)
    message: str = Field(..., min_length=20, max_length=2000)
    category: str = Field(default='other')
    honeypot: Optional[str] = None  # Honeypot field for bot detection

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        allowed = ['login', 'technical', 'account', 'other']
        if v not in allowed:
            raise ValueError(f'Category must be one of: {", ".join(allowed)}')
        return v

    @field_validator('subject', 'message')
    @classmethod
    def validate_no_spam(cls, v):
        # Basic spam keywords check
        spam_keywords = ['viagra', 'casino', 'lottery', 'prize', 'click here', 'winner']
        v_lower = v.lower()
        if any(keyword in v_lower for keyword in spam_keywords):
            raise ValueError('Message contains prohibited content')
        return v.strip()


class SupportContactResponse(BaseModel):
    success: bool
    reference_id: str
    message: str


def check_rate_limit(ip_address: str, email: str) -> tuple[bool, str]:
    """
    Check if IP or email has exceeded rate limits.
    Limits apply to BOTH IP and email independently.
    Returns (can_send, error_message)
    """
    now = datetime.now(timezone.utc)
    
    # Clean old entries (older than 1 hour)
    to_delete = [key for key, timestamps in _rate_limit_cache.items() 
                 if all((now - ts).total_seconds() > 3600 for ts in timestamps)]
    for key in to_delete:
        del _rate_limit_cache[key]
    
    # Check both IP and email
    ip_key = f"ip:{ip_address}"
    email_key = f"email:{email.lower()}"
    
    for key, identifier in [(ip_key, "IP"), (email_key, "correo")]:
        if key not in _rate_limit_cache:
            _rate_limit_cache[key] = []
        
        # Filter timestamps from last hour
        recent = [ts for ts in _rate_limit_cache[key] 
                  if (now - ts).total_seconds() < 3600]
        _rate_limit_cache[key] = recent
        
        # Check limits (3 messages per hour)
        if len(recent) >= 3:
            minutes_until_reset = 60 - int((now - recent[0]).total_seconds() / 60)
            return False, f'Has alcanzado el límite de mensajes por {identifier}. Intenta en {minutes_until_reset} minutos.'
        
        # Check cooldown (15 minutes between messages)
        if recent and (now - recent[-1]).total_seconds() < 900:
            minutes_remaining = 15 - int((now - recent[-1]).total_seconds() / 60)
            return False, f'Espera {minutes_remaining} minutos antes de enviar otro mensaje.'
    
    return True, ''


def update_rate_limit(ip_address: str, email: str) -> None:
    """Update rate limit cache for both IP and email"""
    now = datetime.now(timezone.utc)
    ip_key = f"ip:{ip_address}"
    email_key = f"email:{email.lower()}"
    
    _rate_limit_cache[ip_key].append(now)
    _rate_limit_cache[email_key].append(now)


def generate_reference_id(email: str, timestamp: str) -> str:
    """Generate a unique reference ID for the support request"""
    data = f"{email}{timestamp}".encode()
    return hashlib.sha256(data).hexdigest()[:12].upper()


def validate_email_registered(email: str, category: str) -> tuple[bool, str]:
    """
    Validate that email is registered in DB for account/login categories.
    Returns (is_valid, error_message)
    """
    # Only validate for account and login categories
    if category not in ['account', 'login']:
        return True, ''
    
    with SessionLocal() as session:
        user = session.execute(
            select(Usuario).where(Usuario.email == email.lower())
        ).scalars().first()
        
        if not user:
            return False, 'Para problemas de cuenta o acceso, debes usar un correo registrado en el sistema.'
    
    return True, ''


@router.post("/support/contact", response_model=SupportContactResponse)
async def contact_support(payload: SupportContactRequest, request: Request):
    """
    Send a support message via email to the support team.
    Includes rate limiting, spam protection, and text moderation.
    No database storage - direct email only.
    """
    # 1. Check honeypot (bot trap)
    if payload.honeypot:
        logger.warning(f"Honeypot triggered from IP: {request.client.host}")
        raise HTTPException(status_code=400, detail="Invalid request")
    
    # 2. Rate limiting (by IP and email)
    ip_address = request.client.host
    can_send, error_msg = check_rate_limit(ip_address, payload.email)
    if not can_send:
        raise HTTPException(status_code=429, detail=error_msg)
    
    # 3. Validate email is registered for account/login categories
    email_valid, email_error = validate_email_registered(payload.email, payload.category)
    if not email_valid:
        raise HTTPException(status_code=400, detail=email_error)
    
    # 4. Text moderation (hate speech, spam, toxic content)
    subject_moderation = moderate_text(payload.subject)
    if subject_moderation:
        logger.warning(f"Subject moderation failed from {payload.email}: {subject_moderation}")
        raise HTTPException(status_code=400, detail=f"Asunto: {subject_moderation}")
    
    message_moderation = moderate_text(payload.message)
    if message_moderation:
        logger.warning(f"Message moderation failed from {payload.email}: {message_moderation}")
        raise HTTPException(status_code=400, detail=f"Mensaje: {message_moderation}")
    
    # 5. Generate reference ID
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    reference_id = generate_reference_id(payload.email, timestamp)
    
    # 6. Send email to support team
    try:
        category_labels = {
            'login': '🔐 Problema de Acceso',
            'technical': '🐛 Problema Técnico',
            'account': '👤 Cuenta',
            'other': '💬 Consulta General'
        }
        
        context = {
            'reference_id': reference_id,
            'user_email': payload.email,
            'category': category_labels.get(payload.category, 'Consulta'),
            'subject': payload.subject,
            'message': payload.message,
            'ip_address': ip_address,
            'timestamp': timestamp
        }
        
        # Send email asynchronously
        asyncio.create_task(
            send_notification_email(
                subject=f"[Soporte {reference_id}] {payload.subject}",
                email_to=settings.MAIL_FROM,  # Send to support email
                template_name="soporte_contacto.html",
                context=context
            )
        )
        
        # Update rate limit cache for both IP and email
        update_rate_limit(ip_address, payload.email)
        
        logger.info(f"Support request {reference_id} sent from {payload.email} (IP: {ip_address})")
        
    except Exception as e:
        logger.error(f"Failed to send support email {reference_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar el mensaje. Intenta nuevamente.")
    
    return SupportContactResponse(
        success=True,
        reference_id=reference_id,
        message="Tu mensaje ha sido enviado. Te responderemos pronto al correo proporcionado."
    )
