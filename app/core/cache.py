import asyncio
import time
from typing import Any, Dict, Optional, Tuple


class AsyncTTLCache:
    """
    Lightweight async-safe in-memory TTL response cache for read-heavy GIS
    endpoints (geography hierarchies, grid GeoJSON overlays, search queries).
    """

    def __init__(self, ttl_seconds: int = 60, max_entries: int = 512) -> None:
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._store: Dict[str, Tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, value = entry
            if time.monotonic() > expires_at:
                self._store.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._ttl_seconds
        async with self._lock:
            if len(self._store) >= self._max_entries:
                oldest_key = next(iter(self._store))
                self._store.pop(oldest_key, None)
            self._store[key] = (time.monotonic() + ttl, value)

    async def invalidate_prefix(self, prefix: str) -> None:
        async with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for key in keys:
                self._store.pop(key, None)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


gis_cache = AsyncTTLCache(ttl_seconds=60, max_entries=512)
