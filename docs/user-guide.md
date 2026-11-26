# Using Folio

## Customer

1. On Home, use **View book** to inspect the featured edition or choose a category under **On the shelves**. On a phone, use **Shelf category**. **View catalog** opens more titles in that category. For a specific title, author or ISBN, enter it in the header search and press Enter. In the catalog, open **Filters** to set price limits, availability or sorting, then choose **Apply filters**. Use Back from a book to return to the same results.
2. Sign in or create an account. In Profile, edit your name or phone and save. Sign out from the account navigation.
3. Open an in-stock book, select a quantity and add it to your cart. Use Update quantity, Remove or Clear cart where needed. The cart is saved to the signed-in account.
4. At checkout, verify the amount, enter the recipient, phone, and a complete delivery address. Place the order once. It starts Pending and Unpaid with Cash on delivery as payment.
5. Open Orders to find the receipt again or check fulfillment. If the connection drops after placing an order, retry the same checkout. Folio uses the original attempt to recover its receipt.

An item can become unavailable after you add it. Update or remove the affected line before retrying. If the quoted amount changes, review the refreshed total and confirm it again. If the session expires, sign back in to reopen account features.

## Administrator

1. Sign in with the account created by npm run admin. The dashboard shows pending orders, recent orders and active titles with five or fewer copies.
2. In Categories, add a name and optional description. Open the category to edit it. Move books out of a used category before deleting it.
3. In Books, add a title, select a category, enter the peso price and integer stock, and save. Search the inventory to find a title and adjust its metadata or stock. The removal confirmation explains archiving for referenced books.
4. In Orders, filter by status and open an order. Pending can move to Confirmed or Cancelled. Confirmed can move to Shipped or Cancelled. Shipped can move to Delivered. Confirming cancellation once returns stock. Marking a COD delivery as Delivered also records its payment as Paid.

If a change fails, read the displayed message, correct the relevant fields and retry. Category removal needs all referencing books reassigned. Archived titles remain available to administrators so they can manage relationships.
