# Folio interface design

The primary user is a shopper choosing a book. On Home and Catalog, the first three things to notice are how to search, the available books and their prices and stock. A full-width editorial cover display and a filtered shelf were considered. The filtered shelf supports buying decisions and repeat visits, so Home uses a compact introduction with a small collection of actual covers and Catalog keeps controls adjacent to the results.

Book covers retain their proportions and sit on quiet, tinted shelves. Titles use a serif face, functional text uses a sans serif face and prices sit beside availability. Evergreen identifies primary actions, warm paper supports the reading theme, and burgundy identifies errors. CSS semantic tokens define text, surfaces, borders, focus, spacing and typography.

| Route | Primary task and completion |
| --- | --- |
| Home, Catalog, Book details | Locate a book, compare cover, title, author, price and stock, then open a detail page or add to cart. URL search state returns with Back. |
| Cart, checkout, confirmation | Review quantities and amounts, provide shipping details, confirm cash on delivery and receive an order reference. |
| Register, sign in, profile, orders | Access an account, save contact details and check the current fulfillment and payment state. |
| Admin dashboard, books, categories, orders | Find work requiring attention and manage records using comparison tables, edit forms and confirmation dialogs. |

The design follows the supplied Word brief. Native form labels, clear headings, URL-owned catalog state, pending and error feedback, native modal focus containment, reduced motion and labeled scrollable tables form the shared patterns. Narrow screens keep search and Apply visible above the results with additional filters in a native disclosure. Covers reserve space and load lazily outside the featured group. Verification and remaining device and performance checks are tracked in [testing.md](testing.md).

| Design rules | Implementation and evidence |
| --- | --- |
| 01–04, layout and hierarchy | Book details co-locate author, price and availability. Checkout places the address beside the reviewed amount. Admin uses tables, with dashboard metrics linked to the work queue. |
| 05–08, identity and tokens | Shared paper, surface, ink, action, control, danger and focus colors plus the CSS spacing scale. Treated cover backgrounds tie catalog tiles to the bookstore. |
| 09–11, access and feedback | Labels remain visible, server errors link to fields and feedback announces results. Native dialogs contain Tab, handle Escape and return focus even after a row is removed. Browser tests exercise dialog focus and check the catalog with axe. |
| 12–14, data and requests | Filters live in the URL, form drafts in their component and records in MongoDB. Search cancels older fetches. The browser test covers a failed read and checkout reconciliation after a lost response. |
| 15–18, reflow and media | Reflow scans at 320, 700 and 1280 px and 200% text checked. Local cover fallback and aspect-ratio boxes prevent broken layouts. Touch-keyboard and real-traffic performance could not be measured in this setup. |
