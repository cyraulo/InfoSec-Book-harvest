from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
IMAGE_DIR = BASE_DIR / "images"
DATASET_DIR = BASE_DIR / "dataset"

API_URL = "https://www.googleapis.com/books/v1/volumes"
API_KEY = "AIzaSyCJnISUnF2HLTpzFFeQAfKUxf3iIUUpedI"  # Optional. Leave blank for public API requests when a key is not needed.

BOOK_LIMIT_PER_CATEGORY = 50
MAX_RECORDS_TO_SCAN_PER_CATEGORY = 250  # Scan extra records when some books have no usable cover.
RESULTS_PER_REQUEST = 40  # Google Books API maximum is 40.
REQUEST_DELAY_SECONDS = 0.25
REQUEST_TIMEOUT_SECONDS = 25
MAX_RETRIES = 3

CATEGORIES = {
    "fiction": "subject:Fiction",
    "fantasy": "subject:Fantasy",
    "romance": "subject:Romance",
    "mystery": "subject:Mystery",
    "science_fiction": "subject:Science Fiction",
    "self_help": "subject:Self-Help",
    "business": "subject:Business",
    "technology": "subject:Computers",
    "history": "subject:History",
    "cooking": "subject:Cooking",
}

CSV_FIELDS = [
    "book_id", "title", "subtitle", "authors", "publisher",
    "published_date", "category", "google_categories", "isbn",
    "description", "page_count", "language", "average_rating",
    "ratings_count", "price", "image_path", "cover_source_url",
    "google_books_url",
]
