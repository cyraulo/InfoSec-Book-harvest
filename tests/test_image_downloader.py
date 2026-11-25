import unittest

from scraper.image_downloader import choose_cover_url


class ImageSelectionTests(unittest.TestCase):
    def test_prefers_largest_cover(self):
        links = {
            "thumbnail": "http://example.test/small.jpg",
            "large": "http://example.test/large.jpg",
            "extraLarge": "http://example.test/xl.jpg",
        }
        self.assertEqual(
            choose_cover_url(links),
            "https://example.test/xl.jpg",
        )

    def test_returns_none_when_no_cover(self):
        self.assertIsNone(choose_cover_url({}))


if __name__ == "__main__":
    unittest.main()
