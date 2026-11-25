# Folio API reference

The browser uses same-origin /api. JSON mutations must send Content-Type: application/json. Success responses are JSON unless listed as 204. IDs are 24-character MongoDB ObjectIds. Monetary amounts are integer PHP centavos.

| Method and path (under /api) | Access | Request and result |
| --- | --- | --- |
| GET /health | Public | Readiness indicator |
| POST /auth/register | Public | name, email, password. Returns public user and session cookie (201). |
| POST /auth/login | Public | email, password. Returns public user and rotates session cookie. |
| POST /auth/logout | Public | Empty JSON object. Deletes current session and clears cookie (204). |
| GET /profile | Signed in | Public fields for the current user |
| PATCH /profile | Signed in | name, phone. Returns saved user. Email and role are not accepted. |
| GET /categories | Public | Category records |
| GET /books | Public | Paginated active books |
| GET /books/:id | Public | Active book details and populated category |
| GET /cart | Customer | Populated items, revision and calculated total |
| POST /cart/items | Customer | book ID and quantity to add. Returns current cart. |
| PATCH /cart/items/:id | Customer | quantity to set for the given book ID. Returns current cart. |
| DELETE /cart/items/:id | Customer | Removes that book ID and returns the cart. |
| DELETE /cart | Customer | Clears all lines and returns the cart. |
| GET /orders | Customer | Current customer's order history |
| POST /orders | Customer | Reviewed cart revision and total, delivery details and UUID checkout key. Returns saved order (201) or original receipt (200) for a replay. |
| GET /orders/checkout/:key | Customer | Returns the receipt ID for this customer's previous attempt. |
| GET /orders/:id | Owning customer | Order and historical line snapshots |
| GET /admin/dashboard | Admin | Pending count, up to eight low-stock books and five recent orders |
| GET, POST /admin/books | Admin | Paginated inventory (including archives) or validated new book (201) |
| GET, PUT, DELETE /admin/books/:id | Admin | Details, controlled metadata update, or removal result (deleted or archived) |
| GET, POST /admin/categories | Admin | List records or create category using name and description (201) |
| GET, PUT, DELETE /admin/categories/:id | Admin | Read, update or delete unused category (204) |
| GET /admin/orders | Admin | Paginated orders. Supports status and page. |
| GET /admin/orders/:id | Admin | Order and available status transitions |
| PATCH /admin/orders/:id/status | Admin | status. Returns saved order with subsequent transitions. |

Catalog query example: GET /api/books?q=Matt%20Haig&category=fiction&min=29900&max=49900&availability=in&sort=price-asc&page=1. Availability is in or out. Sort is title, price-asc, price-desc, or recent. List responses have items, total, page and pages.

Example book payload:

    {"title":"Test Title","authors":["Example Writer"],"category":"0123456789abcdef01234567","priceCents":34950,"stock":12,"isbn":"9780525522881"}

Optional book input fields are subtitle, publisher, publishedDate, description, pageCount, language and coverPath. The admin cannot write source identifiers, ratings, internal relationship fields or the archive flag directly.

Example checkout payload:

    {"checkoutKey":"cafe5e9d-fb57-42e0-bd58-3bd5aa5a280b","revision":2,"expectedTotalCents":69900,"delivery":{"name":"Example Reader","phone":"09171234567","address":"42 Demo Street, Manila 1000"}}

Example cart response for a new account:

    {"items":[],"revision":0,"totalCents":0}

Example validation response:

    {"error":{"message":"Check the highlighted values and try again.","fields":{"stock":"Too small: expected number to be >=0"}}}

400 indicates invalid values/IDs. 401 indicates missing or expired sessions or failed login. 403 indicates an untrusted origin or prohibited role. 404 covers missing records, inaccessible customer orders and unmatched checkout keys. 409 covers duplicates, prohibited deletes and concurrent changes to prices, stock or cart contents. 413/415 reject oversize or unsupported input, 429 is throttling, and 500 is an unexpected server error.
