from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Base directory for email templates
TEMPLATE_FOLDER = Path(__file__).parent.parent / "templates"

# Configure fastapi-mail ConnectionConfig
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS,
    TEMPLATE_FOLDER=TEMPLATE_FOLDER,
)

fast_mail = FastMail(conf)

async def send_notification_email(
    subject: str,
    email_to: str,
    template_name: str,
    context: dict
) -> None:
    """
    Sends an automated email notification asynchronously using HTML templates.
    """
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning("Email configuration missing. Simulating email send in dev mode.")
        logger.info(f"Simulated Email -> To: {email_to} | Subject: {subject} | Template: {template_name}")
        return

    try:
        message = MessageSchema(
            subject=subject,
            recipients=[email_to],
            template_body=context,
            subtype=MessageType.html
        )
        
        await fast_mail.send_message(message, template_name=template_name)
        logger.info(f"Email successfully sent to {email_to}")
    except Exception as e:
        logger.error(f"Failed to send email to {email_to}: {e}")
