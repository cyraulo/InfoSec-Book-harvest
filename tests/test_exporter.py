import csv
import json
import tempfile
import unittest
from pathlib import Path

from scraper.dataset_exporter import export_dataset


class ExporterTests(unittest.TestCase):
    def test_exports_csv_and_json(self):
        record = {
            "book_id": "id1", "title": "A Book", "subtitle": "",
            "authors": "An Author", "publisher": "", "published_date": "",
            "category": "fiction", "google_categories": "", "isbn": "",
            "description": "", "page_count": "", "language": "",
            "average_rating": "", "ratings_count": "", "price": "",
            "image_path": "images/fiction/id1.jpg",
            "cover_source_url": "https://example.test/cover.jpg",
            "google_books_url": "https://books.google.test/id1",
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path, json_path = export_dataset([record], temp_dir)
            self.assertTrue(csv_path.exists())
            self.assertTrue(json_path.exists())

            with csv_path.open(encoding="utf-8-sig", newline="") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(rows[0]["title"], "A Book")

            with json_path.open(encoding="utf-8") as handle:
                data = json.load(handle)
            self.assertEqual(data[0]["book_id"], "id1")


if __name__ == "__main__":
    unittest.main()
