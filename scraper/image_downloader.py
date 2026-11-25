import hashlib
from pathlib import Path

import requests
from PIL import Image, UnidentifiedImageError

from config import REQUEST_TIMEOUT_SECONDS

IMAGE_SIZE_KEYS = (
    "extraLarge", "large", "medium", "small",
    "thumbnail", "smallThumbnail",
)


def choose_cover_url(image_links):
    """Choose the largest available cover URL returned by Google Books."""
    image_links = image_links or {}
    for key in IMAGE_SIZE_KEYS:
        url = image_links.get(key)
        if url:
            return url.replace("http://", "https://", 1)
    return None


class ImageDownloader:
    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "AcademicBookstoreMockDataCollector/1.0"
        })

    def download(self, url, destination_dir, stable_id):
        if not url:
            return None

        destination_dir = Path(destination_dir)
        destination_dir.mkdir(parents=True, exist_ok=True)
        safe_id = "".join(
            char if char.isalnum() or char in "-_" else "_"
            for char in str(stable_id)
        )[:120] or "book"

        try:
            response = self.session.get(
                url, timeout=REQUEST_TIMEOUT_SECONDS
            )
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "").lower()
            if not content_type.startswith("image/"):
                return None

            content = response.content
            if not content:
                return None

            digest = hashlib.sha256(content).hexdigest()[:12]
            image = Image.open(__import__("io").BytesIO(content))
            image.verify()

            image_format = image.format
            extensions = {
                "JPEG": ".jpg", "PNG": ".png",
                "WEBP": ".webp", "GIF": ".gif",
            }
            extension = extensions.get(image_format)
            if not extension:
                return None

            filename = f"{safe_id}_{digest}{extension}"
            output_path = destination_dir / filename

            if not output_path.exists():
                output_path.write_bytes(content)

            return output_path

        except (requests.RequestException, UnidentifiedImageError, OSError, ValueError):
            return None
