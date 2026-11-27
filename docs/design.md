# Folio interface design

When a reader opens a different page, its main content fades from 72% opacity and settles upward by 5 px in 180 ms. The header stays in place so search and navigation remain easy to locate. Search and filter edits on the same page keep their position and keyboard focus. Reduced-motion mode skips the entrance and switches control colors immediately. The selected shelf uses dark plum on the existing lavender surface with an underline, and the catalog link uses the same plum. This adapts the listing-to-detail continuity used by Nykaa and the short entrance timings in IBM Carbon. [Commerce navigation case studies](https://developer.chrome.com/blog/view-transitions-case-studies) · [Carbon motion guidance](https://v10.carbondesignsystem.com/guidelines/motion/overview/)

The primary user is a shopper who either knows a title or wants to browse. On Home, the three priorities are the header search, a featured edition with its buying details, and the category shelf. Two layouts were considered. A search banner gave most of the first screen to an input. A bookshop front table shows an actual edition in that space and leaves search within reach across the storefront.

The front table pairs a spotlighted jacket with its title, author, peso price, stock and detail link. Each display position uses a different cloth color, moving from forest green to plum to ink blue. A warm foil accent marks the author and purchase path. Desktop readers can choose a miniature jacket or use the arrow controls. On phones the three edition numbers fit in one row. Changing editions eases the jacket into place over 480 ms. Reduced motion shows the next edition immediately. Shelf and detail covers share muted category backgrounds. Instrument Serif is reserved for the featured title. DM Sans handles catalog titles, labels and prices. Both fonts are served locally.

| Route | Primary task and completion |
| --- | --- |
| Home, Catalog, Book details | Locate a book, compare cover, title, author, price and stock, then open a detail page or add to cart. URL search state returns with Back. |
| Cart, checkout, confirmation | Review quantities and amounts, provide shipping details, confirm cash on delivery and receive an order reference. |
| Register, sign in, profile, orders | Access an account, save contact details and check the current fulfillment and payment state. |
| Admin dashboard, books, categories, orders | Find work requiring attention and manage records using comparison tables, edit forms and confirmation dialogs. |

Home shows up to three featured editions and a six-book shelf from the live catalog. The category links become a labeled select on narrow screens. A selected shelf travels in the URL and its catalog link opens the same category. Catalog search preserves applied filters. Narrow screens place the catalog filters and their actions inside a native disclosure. The featured cover loads eagerly and other jackets load on demand. Native labels, request feedback, modal focus containment and scrollable admin tables follow the supplied design brief. Verification is recorded in [testing.md](testing.md).

| Design rules | Implementation and evidence |
| --- | --- |
| 01–04, layout and hierarchy | Book details co-locate author, price and availability. Checkout places the address beside the reviewed amount. Admin uses tables, with dashboard metrics linked to the work queue. |
| 05–08, identity and tokens | Shared paper, surface, ink, action, control, danger and focus colors plus the CSS spacing scale. Treated cover backgrounds tie catalog tiles to the bookstore. |
| 09–11, access and feedback | Labels remain visible, server errors link to fields and feedback announces results. Native dialogs contain Tab, handle Escape and return focus even after a row is removed. Browser tests exercise dialog focus and check the catalog with axe. |
| 12–14, data and requests | Filters live in the URL, form drafts in their component and records in MongoDB. Search cancels older fetches. The browser test covers a failed read and checkout reconciliation after a lost response. |
| 15–18, reflow and media | Reflow scans at 320, 700 and 1280 px and 200% text checked. Local cover fallback and aspect-ratio boxes prevent broken layouts. Touch-keyboard and real-traffic performance could not be measured in this setup. |
