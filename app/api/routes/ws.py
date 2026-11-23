from datetime import datetime, timezone
import json
from typing import Any, Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["Real-Time WebSocket Streaming"])


class GridWebSocketManager:
    """Server-authoritative WebSocket connection manager for live grid telemetry & alerts."""

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        await websocket.send_json(
            {
                "type": "WELCOME",
                "payload": {
                    "serverTime": datetime.now(timezone.utc).isoformat(),
                    "connectedClients": len(self.active_connections),
                    "protocol": "gridguard-ws-v1",
                },
            }
        )

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        if not self.active_connections:
            return
        message = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        stale: Set[WebSocket] = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                stale.add(connection)
        for conn in stale:
            self.active_connections.discard(conn)


ws_manager = GridWebSocketManager()


@router.websocket("/ws/grid")
async def grid_realtime_stream(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                parsed = json.loads(raw)
                if parsed.get("type") == "PING":
                    await websocket.send_json(
                        {
                            "type": "PONG",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
            except Exception:
                # Ignore malformed client frames cleanly without crashing socket loop
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
