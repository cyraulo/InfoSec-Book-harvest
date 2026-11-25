import unittest

from scraper.data_processor import extract_isbn, volume_to_record


class DataProcessorTests(unittest.TestCase):
    def test_extract_isbn_prefers_isbn13(self):
        identifiers = [
            {"type": "ISBN_10", "identifier": "1234567890"},
            {"type": "ISBN_13", "identifier": "9781234567890"},
        ]
        self.assertEqual(extract_isbn(identifiers), "9781234567890")

    def test_extract_isbn_handles_missing_values(self):
        self.assertEqual(extract_isbn(None), "")

    def test_volume_to_record_handles_missing_metadata(self):
        record = volume_to_record(
            {"id": "abc123", "volumeInfo": {"title": "Sample"}},
            "fiction",
            "images/fiction/abc123.jpg",
            "https://example.test/cover.jpg",
        )
        self.assertEqual(record["book_id"], "abc123")
        self.assertEqual(record["title"], "Sample")
        self.assertEqual(record["authors"], "")
        self.assertEqual(record["price"], "")
        self.assertEqual(record["category"], "fiction")


if __name__ == "__main__":
    unittest.main()
