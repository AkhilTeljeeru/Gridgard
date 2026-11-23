import asyncio
import logging
from typing import Any, Dict, Optional

from app.ml.pipeline import run_ai_pipeline

logger = logging.getLogger("gridguard.ai.scheduler")


class AiBackgroundScheduler:
    """Periodic background scheduler for AI asset health scoring and model retraining."""

    def __init__(self, interval_seconds: int = 900) -> None:
        self.interval_seconds = interval_seconds
        self._task: Optional[asyncio.Task[None]] = None
        self._stop_event = asyncio.Event()
        self.latest_snapshot: Optional[Dict[str, Any]] = None

    async def _loop(self) -> None:
        logger.info("AI Intelligence background scheduler started (interval=%ss).", self.interval_seconds)
        while not self._stop_event.is_set():
            try:
                self.latest_snapshot = await asyncio.to_thread(
                    run_ai_pipeline, None, None, "SCHEDULED_BACKGROUND"
                )
                logger.info(
                    "Scheduled AI health/prediction run complete (%s assets scored, F1=%s).",
                    len(self.latest_snapshot.get("health_scores", [])),
                    self.latest_snapshot.get("model_metrics", {}).get("f1_score"),
                )
            except Exception as exc:  # pragma: no cover - defensive runtime guard
                logger.warning("Scheduled AI pipeline run failed: %s", exc)

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                continue

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._loop(), name="gridguard-ai-scheduler")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            logger.info("AI Intelligence background scheduler stopped cleanly.")


ai_scheduler = AiBackgroundScheduler(interval_seconds=900)
