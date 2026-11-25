def extract_isbn(identifiers):
    identifiers = identifiers or []
    for wanted_type in ("ISBN_13", "ISBN_10"):
        for item in identifiers:
            if item.get("type") == wanted_type:
                return item.get("identifier", "")
    return ""


def volume_to_record(item, category, image_path, cover_url):
    volume = item.get("volumeInfo") or {}
    authors = volume.get("authors") or []
    categories = volume.get("categories") or []

    return {
        "book_id": item.get("id", ""),
        "title": volume.get("title", "Untitled"),
        "subtitle": volume.get("subtitle", ""),
        "authors": ", ".join(authors),
        "publisher": volume.get("publisher", ""),
        "published_date": volume.get("publishedDate", ""),
        "category": category,
        "google_categories": ", ".join(categories),
        "isbn": extract_isbn(volume.get("industryIdentifiers")),
        "description": volume.get("description", ""),
        "page_count": volume.get("pageCount", ""),
        "language": volume.get("language", ""),
        "average_rating": volume.get("averageRating", ""),
        "ratings_count": volume.get("ratingsCount", ""),
        "price": "",
        "image_path": image_path,
        "cover_source_url": cover_url or "",
        "google_books_url": volume.get("infoLink", ""),
    }
