# MongoDB design and catalog import

Every collection has createdAt and updatedAt timestamps. References are ObjectIds. Prices and totals use integer centavos with PHP as the project currency assumption. The CSV does not carry a currency field.

| Collection | Core fields and validation | Indexes and access |
| --- | --- | --- |
| users | Name and normalized email required, optional phone, hidden scrypt password hash, customer or admin role | Unique normalized email |
| sessions | Hidden token hash, user reference and expiry | Unique hash and TTL on expiry |
| categories | Name, stable slug, optional description, internal relation version | Unique slug |
| books | Category reference, title, authors, string ISBN and publication date, optional descriptive fields, stock 0 to 1,000,000, price 0 to 10,000,000 centavos, archived flag | Sparse unique external ID. Active flag plus category/price, title, stock and ISBN support filtering and sorting. Title/author literal substring search scans the eligible catalog for predictable results at this scale. |
| carts | Unique customer reference, embedded list of up to 50 book references and quantities 1 to 99, revision | Unique customer and index on referenced book |
| orders | Customer reference, idempotency key, embedded title/price/quantity snapshots, delivery snapshot, fulfillment and payment enums, total and currency | Unique customer/key, customer/date and status/date indexes, embedded book reference index |

Categories are referenced so updates are visible across books. Carts use references for current product information and embedded lines because the cart is read and written together. Orders embed purchased details and delivery information because history must survive edits. Checkout protects all lines in a transaction, including on failure and race retries. Cancellation stock writes and the status update commit together. Delivered and cancelled orders are terminal.

Book removal archives a title when a cart or order references it. Archived books remain administratively editable, are hidden in the public catalog, and must be removed from affected carts. Unreferenced books can be physically removed. Categories with any books, including archived books, block deletion until the books are moved. Category relation writes serialize new assignments with deletion. There is no destructive order deletion.

| CSV fields | Mapping |
| --- | --- |
| book_id | Unique externalId. The app generates a separate ObjectId. |
| title, subtitle, publisher, description, language | Same text fields. Descriptions render as plain text. |
| authors, google_categories | Trim, split the dataset's comma-delimited lists and deduplicate. Missing values become empty arrays. |
| published_date | publishedDate string. Year/month/day precision stays intact. The single ISO timestamp maps to its existing UTC calendar date. |
| category | Category reference via a stable slug, with readable names for underscore-delimited keys. |
| isbn | Text ISBN normalized by removing spaces/hyphens. Empty means unavailable. |
| page_count, average_rating, ratings_count | Bounded optional numbers. The ratings are Google Books metadata, not Folio reviews. |
| price | Parsed from decimal text to integer centavos without floating-point money arithmetic. |
| image_path | Validated local path mapped from images/ to /covers/. Missing files use the app fallback. |
| cover_source_url, google_books_url | Source URL strings kept as metadata. |

The reviewed source has 193 rows and 10 categories. There are no duplicate external IDs or populated ISBNs. Two distinct pairs share a title, so each keeps its own record. All 193 cover references exist. Optional gaps include 108 subtitles, 3 author lists, 40 publishers, 8 source category lists, 60 ISBNs, 20 descriptions, 1 page count and 153 rating pairs. The date formats are 109 years, 11 year-months, 72 full dates and 1 timestamp. Test SEED-01 records accepted and rejected input during the actual import.

Run npm run seed or npm run seed -- path-to-compatible.csv. Quoted CSV input is parsed with csv-parse. Reports include imported, updated (always zero in this insert-only mode), skipped, invalid and missing covers. Existing external IDs are skipped so admin edits survive. Invalid rows are reported and cause a nonzero CLI exit. The importer never clears the database. New imports start with 12 demo copies per title. The supplied prices are sample store prices in PHP. The Python collector may regenerate the source with blank prices, which must be filled before using it as seed input.
