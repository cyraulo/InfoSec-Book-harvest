# Bookstore requirements and acceptance

Folio serves one academic bookstore. Guests discover books. Customers manage their account and cart, submit a cash-on-delivery order, and view their own history. Administrators manage books, categories, stock and fulfillment in separate screens. Payments are collected outside the application. Live gateways, seller accounts, recommendations and chat are outside scope.

| Role | User story and acceptance |
| --- | --- |
| Guest | I can search by title, author and ISBN, combine filters and sort, page through results and open details. Refresh and Back retain catalog criteria. |
| Customer | I can register, sign in and out, and change my name and phone. Guests and other customers cannot read my private records. |
| Customer | I can add, change, remove and clear cart lines. After reload the same cart is available. Checkout records my delivery details, agrees with the reviewed total and leaves an order I can reopen. |
| Administrator | I can create, read and edit catalog records, safely remove unreferenced books, archive referenced books and delete unused categories. A used category reports why deletion failed. |
| Administrator | I can use the dashboard to find low stock and pending orders and move orders through the allowed fulfillment stages. |

Stock and cart quantities are integers. Money uses integer centavos. Checkout checks current stock, cart revision and total and commits its writes together. Replays use a customer scoped key. Cancelling before shipment restores stock once. Order snapshots retain the purchased title, unit price and delivery details.

| Evaluation | Required evidence |
| --- | --- |
| Functionality | Customer purchase and administrator CRUD through the browser and API |
| UI and UX | Catalog reading order, clear form feedback, keyboard/focus tests and reflow checks |
| Database integration | Real replica set, seed replay, durable records, checkout concurrency and stock restoration |
| Testing and debugging | Automated API and browser tests, lint, production build, defect and execution log |
| Documentation | Reproducible configuration, commands, schema and API references and user instructions |

Implementation stages are repository and data review, schema and seed, authentication, catalog and admin, checkout and orders, accessible UI refinement, and verification. Actual results are recorded in [testing.md](testing.md).
