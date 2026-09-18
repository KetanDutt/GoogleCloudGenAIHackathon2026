"""A bounded single-process safety net, not a substitute for gateway rate limits."""

import hashlib
import math
import threading
import time
from collections import OrderedDict, deque

from fastapi import HTTPException


class RateLimiter:
    def __init__(self, max_keys: int = 10_000):
        self.max_keys = max_keys
        self._buckets: OrderedDict[str, deque[float]] = OrderedDict()
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window: int = 60):
        # Avoid retaining email addresses in memory keys.
        key = hashlib.sha256(key.encode()).hexdigest()
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.setdefault(key, deque())
            self._buckets.move_to_end(key)
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                retry = max(1, math.ceil(window - (now - bucket[0])))
                raise HTTPException(
                    429,
                    "Too many requests. Please try again shortly.",
                    headers={"Retry-After": str(retry)},
                )
            bucket.append(now)
            while len(self._buckets) > self.max_keys:
                self._buckets.popitem(last=False)
