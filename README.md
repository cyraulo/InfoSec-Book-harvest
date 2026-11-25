# Google Books Collector

A beginner-friendly Python utility for an academic bookstore/e-commerce project.
It uses the official Google Books Volumes API to find books, downloads available
front-cover images, and exports book metadata to CSV and JSON.

## Requirements

- Windows 10/11 (also works on macOS/Linux)
- Python 3.9 or newer
- Internet connection

## Install

Open a terminal in this project folder:

```bash
python -m pip install -r requirements.txt
```

## Run

```bash
python main.py
```

The script searches each configured category and targets up to 50 successfully
downloaded covers per category. It can inspect up to 250 API records per category
to compensate for books without a usable cover. The theoretical maximum is 500 unique books.
The actual total can be lower if the API has fewer matching records, books have
no cover, or an image cannot be downloaded.

## Project structure

```text
google-books-collector/
├── main.py
├── config.py
├── requirements.txt
├── README.md
├── scraper/
│   ├── __init__.py
│   ├── google_books_api.py
│   ├── image_downloader.py
│   ├── data_processor.py
│   └── dataset_exporter.py
├── images/
│   ├── fiction/
│   ├── fantasy/
│   └── ...
├── dataset/
│   ├── books.csv
│   └── books.json
└── tests/
```

## Configure categories and limits

Edit `config.py`.

- `BOOK_LIMIT_PER_CATEGORY`: desired number of successfully downloaded books per category.
- `MAX_RECORDS_TO_SCAN_PER_CATEGORY`: maximum API records to inspect per category to allow for missing/unavailable covers.
- `CATEGORIES`: category names and Google Books search queries.
- `REQUEST_TIMEOUT_SECONDS`, `MAX_RETRIES`: network behavior.

The Google Books API key is optional for the public requests used here. If you
have a key, add it to `API_KEY` in `config.py`; do not commit private keys to
a public repository.

## Output

- Cover images: `images/<category>/`
- CSV: `dataset/books.csv`
- JSON: `dataset/books.json`

The `image_path` values in the dataset are relative to the project root, for
example `images/fantasy/volume-id_hash.jpg`.

The saved dataset includes mock `price` values in Philippine pesos (PHP) for
the academic bookstore. Store prices as numeric amounts without a currency
symbol: `399.00` means PHP 399.00. Category base prices are PHP 299 for fiction,
romance, and mystery; PHP 349 for fantasy and science fiction; PHP 399 for
self-help; PHP 449 for history; PHP 499 for business and cooking; and PHP 699
for technology. Each started 100 pages beyond 200 adds PHP 50, capped at
PHP 400 extra. Missing or zero page counts use the category base price.
These are sample prices for demonstration.

The collector still exports blank prices when run again. Reapply your store's
prices after collecting a new dataset.

## Using the data in a React project

The CSV or JSON can be imported into your backend/database as seed data.
Serve the `images/` directory as static assets or copy it into your backend's
static/public directory. Use each record's `image_path` as the product image
path. Keep the image aspect ratio and use CSS such as `object-fit: contain`
for book covers so they are not stretched.

Example:

```jsx
<img
  src={`/book-covers/${book.image_path.split("/").slice(1).join("/")}`}
  alt={book.title}
  style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "contain" }}
/>
```

Adjust the URL mapping to match how your backend serves static files.

## Tests

Run the included unit tests:

```bash
python -m unittest discover -s tests -v
```

Tests use mocked responses and do not require a live Google Books API connection.

## API and image rights notes

This program calls the Google Books Volumes API. It does not scrape Google
Search or any marketplace. API availability, rate limits, and returned fields
can change. The API may not provide a cover for every record.

A cover image being accessible through Google Books does not automatically
grant permission to redistribute it or use it commercially. Retain the source
links, review the applicable rights for each cover, and follow Google Books
API terms and any rights-holder requirements before public deployment.

Documentation:
https://developers.google.com/books/docs/v1/using

Terms:
https://developers.google.com/books/terms
