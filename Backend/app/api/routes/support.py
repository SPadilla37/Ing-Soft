"""
Support contact endpoint - sends emails to support team
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from app.services.email import send_notification_email
from app.core.config import settings
import logging
import asyncio
import hashlib

router = APIRouter()
logger = logging.getLogger(__name__)

# Rate limiting cache (simple in-memory, resets on restart)
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
        spam_keywords = ['viagra', 'casino', 'lottery', 'prize', 'click here', 'winner']
        v_lower = v.lower()
        if any(keyword in v_lower for keyword in spam_keywords):
            raise ValueError('Message contains prohibited content')
        return v.strip()


class SupportContactResponse(BaseModel):
    success: bool
    reference_id: str
    message: str


def check_rate_limit(ip_address: str) -> tuple[bool, str]:
    """
    Check if IP has exceeded rate limits.
    Returns (can_send, error_message)
    """
    now = datetime.now(timezone.utc)
    
    # Clean old entries
    to_delete = [ip for ip, timestamps in _rate_limit_cache.items() 
                 if all((now - ts).total_seconds() > 3600 for ts in timestamps)]
    for ip in to_delete:
        del _rate_limit_cache[ip]
    
    if ip_address not in _rate_limit_cache:
        _rate_limit_cache[ip_address] = []
    
    # Filter timestamps from last hour
    recent = [ts for ts in _rate_limit_cache[ip_address] 
              if (now - ts).total_seconds() < 3600]
    _rate_limit_cache[ip_address] = recent
    
    # Check limits
    if len(recent) >= 3:
        minutes_until_reset = 60 - int((now - recent[0]).total_seconds() / 60)
        return False, f'Has alcanzado el límite de mensajes. Intenta en {minutes_until_reset} minutos.'
    
    # Check cooldown (15 minutes between messages)
    if recent and (now - recent[-1]).total_seconds() < 900:
        minutes_remaining = 15 - int((now - recent[-1]).total_seconds() / 60)
        return False, f'Espera {minutes_remaining} minutos antes de enviar otro mensaje.'
    
    return True, ''


def generate_reference_id(email: str, timestamp: str) -> str:
    """Generate a unique reference ID for the support request"""
    data = f"{email}{timestamp}".encode()
    return hashlib.sha256(data).hexdigest()[:12].upper()


@router.post("/support/contact", response_model=SupportContactResponse)
async def contact_support(payload: SupportContactRequest, request: Request):
    """
    Send a support message via email to the support team.
    Includes rate limiting and spam protection.
    No database storage - direct email only.
    """
    # 1. Check honeypot (bot trap)
    if payload.honeypot:
        logger.warning(f"Honeypot triggered from IP: {request.client.host}")
        raise HTTPException(status_code=400, detail="Invalid request")
    
    # 2. Rate limiting
    ip_address = request.client.host
    can_send, error_msg = check_rate_limit(ip_address)
    if not can_send:
        raise HTTPException(status_code=429, detail=error_msg)
    
    # 3. Generate reference ID
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    reference_id = generate_reference_id(payload.email, timestamp)
    
    # 4. Send email to support team
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
        
        # Update rate limit cache
        _rate_limit_cache[ip_address].append(datetime.now(timezone.utc))
        
        logger.info(f"Support request {reference_id} sent from {payload.email}")
        
    except Exception as e:
        logger.error(f"Failed to send support email {reference_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar el mensaje. Intenta nuevamente.")
    
    return SupportContactResponse(
        success=True,
        reference_id=reference_id,
        message="Tu mensaje ha sido enviado. Te responderemos pronto al correo proporcionado."
    )
