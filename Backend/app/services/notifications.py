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
