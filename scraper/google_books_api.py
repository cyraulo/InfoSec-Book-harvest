import time
import requests

from config import (
    API_URL, API_KEY, RESULTS_PER_REQUEST,
    REQUEST_DELAY_SECONDS, REQUEST_TIMEOUT_SECONDS, MAX_RETRIES,
)


class GoogleBooksClient:
    """Small client for the official Google Books Volumes API."""

    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "AcademicBookstoreMockDataCollector/1.0"
        })

    def _get(self, params):
        request_params = dict(params)
        if API_KEY:
            request_params["key"] = API_KEY

        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self.session.get(
                    API_URL,
                    params=request_params,
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                return response.json()
            except (requests.RequestException, ValueError) as exc:
                last_error = exc
                if attempt < MAX_RETRIES - 1:
                    time.sleep(2 ** attempt)

        raise RuntimeError(f"Google Books request failed after retries: {last_error}")

    def search_category(self, query, max_records):
        """Yield up to max_records API volume records; caller filters unusable covers."""
        if max_records <= 0:
            return

        start_index = 0
        yielded = 0

        while yielded < max_records:
            page_size = min(RESULTS_PER_REQUEST, max_records - yielded)
            payload = self._get({
                "q": query,
                "printType": "books",
                "maxResults": page_size,
                "startIndex": start_index,
                "orderBy": "relevance",
            })

            items = payload.get("items") or []
            if not items:
                break

            for item in items:
                yield item
                yielded += 1
                if yielded >= max_records:
                    break

            start_index += len(items)
            if len(items) < page_size:
                break

            time.sleep(REQUEST_DELAY_SECONDS)
