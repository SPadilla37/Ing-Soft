import asyncio
import json
from typing import Dict

class NotificationManager:
    def __init__(self):
        # Maps user_id to an asyncio.Queue of messages
        self.queues: Dict[int, asyncio.Queue] = {}

    async def get_queue(self, user_id: int) -> asyncio.Queue:
        if user_id not in self.queues:
            self.queues[user_id] = asyncio.Queue()
        return self.queues[user_id]

    async def notify(self, user_id: int, message: dict):
        if user_id in self.queues:
            await self.queues[user_id].put(message)

notification_manager = NotificationManager()

async def push_notification(user_id: int, message: dict):
    """Helper to be used in background_tasks or async routes."""
    await notification_manager.notify(user_id, message)


# ============================================================================
# REPORT NOTIFICATION FUNCTIONS
# ============================================================================

from datetime import datetime
import logging

logger = logging.getLogger(__name__)


async def notify_reporter_resolution(
    reporter_id: int,
    report_id: int,
    action_taken: str,
    admin_notes: str = None
):
    """
    Send notification to reporter when their report is resolved.
    
    Args:
        reporter_id: ID of the user who created the report
        report_id: ID of the report
        action_taken: Action taken (ninguna, advertencia, suspension, eliminacion)
        admin_notes: Optional admin notes
    """
    try:
        message = {
            "type": "report_resolved",
            "report_id": report_id,
            "action": action_taken,
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"Tu reporte ha sido revisado. Acción tomada: {action_taken}"
        }
        
        if admin_notes:
            message["notes"] = admin_notes
        
        await push_notification(reporter_id, message)
        
        logger.info(
            f"Reporter notification sent: reporter_id={reporter_id}, "
            f"report_id={report_id}, action={action_taken}"
        )
    except Exception as e:
        logger.error(
            f"Error sending reporter notification: reporter_id={reporter_id}, "
            f"report_id={report_id}, error={str(e)}"
        )


async def notify_reported_user_action(
    reported_user_id: int,
    action_taken: str,
    reason: str = None
):
    """
    Send notification to reported user about action taken (without revealing reporter).
    
    Args:
        reported_user_id: ID of the user being reported
        action_taken: Action taken (ninguna, advertencia, suspension, eliminacion)
        reason: Optional reason for the action
    """
    try:
        # Map action to user-friendly message
        action_messages = {
            "ninguna": "Se ha revisado tu reporte. No se tomó acción.",
            "advertencia": "Has recibido una advertencia por violar nuestros términos de servicio.",
            "suspension": "Tu cuenta ha sido suspendida por violar nuestros términos de servicio.",
            "eliminacion": "Tu cuenta ha sido eliminada por violar nuestros términos de servicio."
        }
        
        message = {
            "type": "report_action",
            "action": action_taken,
            "timestamp": datetime.utcnow().isoformat(),
            "message": action_messages.get(action_taken, "Se ha tomado una acción en tu cuenta.")
        }
        
        if reason:
            message["reason"] = reason
        
        # IMPORTANT: Do NOT include reporter_id or any identifying information
        # This maintains privacy of the reporter
        
        await push_notification(reported_user_id, message)
        
        logger.info(
            f"Reported user notification sent: user_id={reported_user_id}, "
            f"action={action_taken}"
        )
    except Exception as e:
        logger.error(
            f"Error sending reported user notification: user_id={reported_user_id}, "
            f"action={action_taken}, error={str(e)}"
        )


async def send_report_notification_email(
    email_to: str,
    user_name: str,
    notification_type: str,
    action_taken: str = None,
    frontend_url: str = None
):
    """
    Send email notification for report-related events.
    
    Args:
        email_to: Email address to send to
        user_name: Name of the user
        notification_type: Type of notification (report_resolved, report_action)
        action_taken: Action taken (for report_action type)
        frontend_url: Frontend URL for links
    """
    try:
        # This would integrate with the existing email service
        # For now, we'll log it as a placeholder
        logger.info(
            f"Report email notification queued: email={email_to}, "
            f"type={notification_type}, action={action_taken}"
        )
    except Exception as e:
        logger.error(
            f"Error queuing report email notification: email={email_to}, "
            f"error={str(e)}"
        )
