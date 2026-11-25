import time

from config import (
    CATEGORIES, BOOK_LIMIT_PER_CATEGORY, MAX_RECORDS_TO_SCAN_PER_CATEGORY,
    IMAGE_DIR, DATASET_DIR,
)
from scraper.google_books_api import GoogleBooksClient
from scraper.image_downloader import ImageDownloader, choose_cover_url
from scraper.data_processor import volume_to_record
from scraper.dataset_exporter import export_dataset


def collect_books():
    client = GoogleBooksClient()
    downloader = ImageDownloader()

    all_records = []
    seen_ids = set()
    category_counts = {}

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    DATASET_DIR.mkdir(parents=True, exist_ok=True)

    print("Google Books collector")
    print(f"Target: up to {BOOK_LIMIT_PER_CATEGORY} books per category")
    print("Only books with successfully downloaded cover images are exported.\n")

    for category, query in CATEGORIES.items():
        print(f"\n[{category}] Searching: {query}")
        collected_for_category = 0

        try:
            for item in client.search_category(query, MAX_RECORDS_TO_SCAN_PER_CATEGORY):
                book_id = item.get("id", "")
                if not book_id or book_id in seen_ids:
                    continue

                volume = item.get("volumeInfo") or {}
                cover_url = choose_cover_url(volume.get("imageLinks"))
                if not cover_url:
                    continue

                image_path = downloader.download(
                    cover_url,
                    IMAGE_DIR / category,
                    book_id,
                )
                if not image_path:
                    print(f"  Skipped (cover unavailable/invalid): {book_id}")
                    continue

                relative_image_path = image_path.relative_to(IMAGE_DIR.parent).as_posix()
                record = volume_to_record(
                    item, category, relative_image_path, cover_url
                )

                seen_ids.add(book_id)
                all_records.append(record)
                collected_for_category += 1
                print(f"  Saved: {record['title']}")

                if collected_for_category >= BOOK_LIMIT_PER_CATEGORY:
                    break

        except Exception as error:
            print(f"  Category collection encountered an error: {error}")

        category_counts[category] = collected_for_category
        print(f"[{category}] Collected: {collected_for_category}")

        time.sleep(0.2)

    csv_path, json_path = export_dataset(all_records, DATASET_DIR)

    print("\n========== COLLECTION SUMMARY ==========")
    for category, count in category_counts.items():
        print(f"{category}: {count}")
    print(f"\nTotal unique books: {len(all_records)}")
    print(f"CSV: {csv_path}")
    print(f"JSON: {json_path}")
    print(f"Images: {IMAGE_DIR}")

    return all_records


if __name__ == "__main__":
    collect_books()
