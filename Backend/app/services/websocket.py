import json
from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.connections_by_conversation: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, conversation_id: str, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections_by_conversation.setdefault(conversation_id, {})[user_id] = websocket

    def disconnect(self, conversation_id: str, user_id: str) -> None:
        conversation_connections = self.connections_by_conversation.get(conversation_id, {})
        conversation_connections.pop(user_id, None)
        if not conversation_connections:
            self.connections_by_conversation.pop(conversation_id, None)

    async def broadcast(self, conversation_id: str, payload: dict) -> None:
        conversation_connections = self.connections_by_conversation.get(conversation_id, {})
        to_remove: List[str] = []

        for user_id, websocket in conversation_connections.items():
            try:
                await websocket.send_text(json.dumps(payload))
            except Exception:
                to_remove.append(user_id)

        for user_id in to_remove:
            self.disconnect(conversation_id, user_id)


manager = ConnectionManager()
