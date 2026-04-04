from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Base directory for email templates
TEMPLATE_FOLDER = Path(__file__).parent.parent / "templates"

def _clean_env_string(value: str) -> str:
    return (value or "").strip().strip('"').strip("'")


def _build_mail_client() -> Optional[FastMail]:
    try:
        conf = ConnectionConfig(
            MAIL_USERNAME=_clean_env_string(settings.MAIL_USERNAME),
            MAIL_PASSWORD=_clean_env_string(settings.MAIL_PASSWORD),
            MAIL_FROM=_clean_env_string(settings.MAIL_FROM),
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=_clean_env_string(settings.MAIL_SERVER),
            MAIL_FROM_NAME=_clean_env_string(settings.MAIL_FROM_NAME),
            MAIL_STARTTLS=settings.MAIL_STARTTLS,
            MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
            USE_CREDENTIALS=settings.USE_CREDENTIALS,
            VALIDATE_CERTS=settings.VALIDATE_CERTS,
            TEMPLATE_FOLDER=TEMPLATE_FOLDER,
        )
        return FastMail(conf)
    except Exception as exc:
        logger.warning("Email disabled due to invalid configuration: %s", exc)
        return None


fast_mail = _build_mail_client()

async def send_notification_email(
    subject: str,
    email_to: str,
    template_name: str,
    context: dict
) -> None:
    """
    Sends an automated email notification asynchronously using HTML templates.
    """
    if fast_mail is None:
        logger.warning("Email client disabled. Simulating email send.")
        logger.info(f"Simulated Email -> To: {email_to} | Subject: {subject} | Template: {template_name}")
        return

    if not _clean_env_string(settings.MAIL_USERNAME) or not _clean_env_string(settings.MAIL_PASSWORD):
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
