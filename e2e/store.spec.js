import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
const pass = 'e2e-password-only';
test('E2E-04 page motion follows navigation and the reader’s motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    window.pageEntrances = [];
    const seen = new WeakSet();
    new MutationObserver(() => {
      for (const animation of document.querySelector('main')?.getAnimations() ?? []) {
        if (animation.id === 'folio-page-enter' && !seen.has(animation)) {
          seen.add(animation);
          window.pageEntrances.push(location.pathname);
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/catalog?q=How+to+Stop+Time');
  const book = page.getByRole('link', { name: 'How to Stop Time', exact: true });
  await book.focus();
  expect(await page.evaluate(() => window.pageEntrances)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to Stop Time');
  await expect(page.getByRole('main')).toBeFocused();
  const detailPath = new URL(page.url()).pathname;
  await page.goBack();
  await expect(book).toBeVisible();
  await expect(page.getByLabel('Search books')).toHaveValue('How to Stop Time');
  await page.getByLabel('Search books').fill('Matt Haig');
  await page.getByLabel('Search books').press('Enter');
  await expect(page).toHaveURL(/q=Matt\+Haig/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await book.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to Stop Time');
  expect(await page.evaluate(() => window.pageEntrances)).toEqual([detailPath, '/catalog']);
});
test('E2E-03 featured books, shelf navigation, recovery and responsive home', async ({ page }, info) => {
  await page.goto('/');
  const feature = page.getByRole('region', { name: 'Featured books' });
  await expect(feature.getByRole('heading', { level: 1 })).toHaveText('How to Stop Time');
  const advance = feature.getByRole('button', { name: 'Next featured book' });
  await advance.focus();
  await page.keyboard.press('Enter');
  await expect(feature.getByRole('heading')).toHaveText('A Wizard of Earthsea');
  await expect(advance).toBeFocused();
  const third = feature.getByRole('button', { name: 'Feature The ABC Murders', exact: true });
  await third.click();
  await expect(third).toHaveAttribute('aria-pressed', 'true');
  await expect(feature.getByRole('heading')).toHaveText('The ABC Murders');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await feature.getByRole('button', { name: 'Feature A Wizard of Earthsea', exact: true }).click();
  await expect(feature.locator('.cover')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await feature.getByRole('link', { name: 'View book' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Wizard of Earthsea');
  await page.goBack();

  const shelf = page.getByRole('region', { name: 'On the shelves' });
  await shelf.getByRole('link', { name: 'Cooking', exact: true }).click();
  await expect(page).toHaveURL(/shelf=cooking/);
  const first = shelf.locator('article a').first();
  const title = await first.innerText();
  await first.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await page.locator('main').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(shelf.getByRole('link', { name: 'Cooking', exact: true })).toHaveAttribute('aria-current', 'page');
  await shelf.getByRole('link', { name: 'View catalog' }).click();
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('cooking');
  await page.getByLabel('Search books').fill('Sushi Economy');
  await page.getByLabel('Search books').press('Enter');
  await expect(page.getByText('1 book for “Sushi Economy”')).toBeVisible();
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('cooking');

  await page.goto('/');
  await expect(shelf.locator('article')).toHaveCount(6);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations.map(item => item.id)).toEqual([]);
  for (const width of [320, 700, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    for (const size of ['100%', '200%']) {
      await page.evaluate(value => { document.documentElement.style.fontSize = value; }, size);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(size === '200%' ? '32px' : '16px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width === 320 && size === '200%') {
        const titleBox = await feature.getByRole('heading').boundingBox();
        const coverBox = await feature.locator('.cover').boundingBox();
        expect(coverBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
      }
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    if (width === 320) {
      await page.screenshot({ path: info.outputPath('home-320.png') });
      await page.getByLabel('Shelf category').selectOption('mystery');
      await page.reload();
      await expect(page.getByLabel('Shelf category')).toHaveValue('mystery');
      await expect(shelf.locator('article').first()).toBeVisible();
    }
  }
  const endpoint = '**/api/books/front-table';
  await page.route(endpoint, route => route.abort());
  await page.goto('/');
  await expect(page.getByText('Could not reach the bookstore.', { exact: false })).toBeVisible();
  await page.unroute(endpoint);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(feature.getByRole('heading')).toHaveText('How to Stop Time');
  await page.route(endpoint, route => route.fulfill({ json: [] }));
  await page.reload();
  await expect(shelf.getByRole('heading', { name: 'The shelves are empty' })).toBeVisible();
});
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(pass);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('E2E-01 administrator CRUD and customer purchase with reload and fulfillment', async ({ browser }, info) => {
  const admin = await browser.newPage();
  const buyer = await browser.newPage();
  const errors = [];
  for (const page of [admin, buyer]) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
    });
  }
  await login(admin, 'admin@example.test');
  await expect(admin.getByRole('heading', { name: 'Store dashboard' })).toBeVisible();
  await admin.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: 'Categories' }).click();
  await admin.getByRole('link', { name: 'Add category' }).click();
  await admin.getByLabel('Category name').fill('Browser category');
  await admin.getByRole('button', { name: 'Create category' }).click();
  await expect(admin.getByText('Category created.')).toBeVisible();
  await admin.getByLabel('Category name').fill('Browser category revised');
  await admin.getByRole('button', { name: 'Save category' }).click();
  await expect(admin.getByText('Category saved.')).toBeVisible();
  await admin.reload();
  await expect(admin.getByLabel('Category name')).toHaveValue('Browser category revised');

  await admin.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: 'Books' }).click();
  await admin.getByRole('link', { name: 'Add book' }).click();
  const title = 'Browser bookstore test with an unusually long title for layout verification';
  await admin.getByLabel('Title', { exact: true }).fill(title);
  await admin.getByLabel('Authors (optional)').fill('Browser Author');
  await admin.getByLabel('Category', { exact: true }).selectOption({ label: 'Browser category revised' });
  await admin.getByLabel('Price (₱)').fill('450.75');
  await admin.getByLabel('Stock').fill('0');
  await admin.getByRole('button', { name: 'Create book' }).click();
  await expect(admin.getByText('Book created.')).toBeVisible();
  const id = new URL(admin.url()).pathname.split('/').at(-1);
  await buyer.goto('/books/' + id);
  await expect(buyer.getByText('Cover unavailable')).toBeVisible();
  await expect(buyer.getByText('Out of stock')).toBeVisible();
  await buyer.setViewportSize({ width: 320, height: 800 });
  expect(await buyer.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await buyer.setViewportSize({ width: 1280, height: 800 });
  await admin.getByLabel('Stock').fill('5');
  await admin.getByRole('button', { name: 'Save book' }).click();
  await expect(admin.getByText('Book saved.')).toBeVisible();
  await admin.reload();
  await expect(admin.getByLabel('Stock')).toHaveValue('5');
  await admin.getByRole('link', { name: 'Back to books' }).click();
  await admin.getByLabel('Search books').fill(title);
  await admin.getByRole('button', { name: 'Search', exact: true }).click();
  await admin.getByRole('button', { name: 'Remove ' + title }).focus();
  await admin.keyboard.press('Enter');
  const dialog = admin.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await admin.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Confirm removal' })).toBeFocused();
  await admin.keyboard.press('Escape');
  await expect(admin.getByRole('button', { name: 'Remove ' + title })).toBeFocused();
  await admin.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Confirm removal' }).click();
  await expect(admin.getByText('Book removed.')).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Add book' })).toBeFocused();
  await admin.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: 'Categories' }).click();
  await admin.getByRole('button', { name: 'Remove Browser category revised' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Confirm removal' }).click();
  await expect(admin.getByText('Category removed.')).toBeVisible();

  await buyer.goto('/register');
  await buyer.getByLabel('Full name').fill('Browser Buyer');
  await buyer.getByLabel('Email').fill('buyer@example.test');
  await buyer.getByLabel('Password').fill(pass);
  await expect(buyer.getByRole('link', { name: 'Privacy notice' }).first()).toBeVisible();
  await buyer.getByRole('checkbox', { name: /I agree/ }).check();
  await buyer.getByRole('button', { name: 'Create account' }).click();
  await expect(buyer).toHaveURL('/');
  await expect(buyer.getByRole('heading', { name: 'How to Stop Time' })).toBeVisible();
  await buyer.reload();
  await buyer.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Profile' }).click();
  await buyer.getByLabel('Full name').fill('Browser Reader');
  await buyer.getByLabel('Phone (optional)').fill('invalid');
  await buyer.getByRole('button', { name: 'Save profile' }).click();
  await expect(buyer.getByLabel('Phone (optional)')).toHaveAttribute('aria-invalid', 'true');
  await expect(buyer.getByLabel('Full name')).toHaveValue('Browser Reader');
  await buyer.getByLabel('Phone (optional)').fill('09171234567');
  await buyer.getByRole('button', { name: 'Save profile' }).click();
  await expect(buyer.getByText('Profile saved.')).toBeVisible();
  await buyer.reload();
  await expect(buyer.getByLabel('Full name')).toHaveValue('Browser Reader');
  await buyer.getByRole('navigation', { name: 'Store' }).getByRole('link', { name: 'Catalog' }).click();
  await buyer.getByLabel('Search books').fill('How to Stop Time');
  await buyer.getByRole('button', { name: 'Submit book search' }).click();
  await buyer.getByRole('link', { name: 'How to Stop Time' }).click();
  await buyer.goBack();
  await expect(buyer.getByLabel('Search books')).toHaveValue('How to Stop Time');
  await buyer.getByRole('link', { name: 'How to Stop Time' }).click();
  await buyer.getByRole('button', { name: 'Add to cart' }).click();
  await expect(buyer.getByText('Added to your cart.')).toBeVisible();
  await buyer.getByRole('link', { name: 'View cart' }).click();
  await buyer.getByLabel('Quantity', { exact: true }).fill('2');
  await buyer.getByRole('button', { name: 'Update quantity' }).click();
  await expect(buyer.getByText('Quantity updated.')).toBeVisible();
  await buyer.reload();
  await expect(buyer.getByLabel('Quantity', { exact: true })).toHaveValue('2');
  await buyer.getByRole('link', { name: 'Continue to checkout' }).click();
  await buyer.getByLabel('Phone').fill('09171234567');
  await buyer.getByLabel('Delivery address').fill('42 Demo Street, Manila 1000');
  let submissions = 0;
  await buyer.route('**/api/orders', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    submissions++;
    if (submissions === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await buyer.getByRole('button', { name: 'Place order' }).evaluate(button => { button.click(); button.click(); });
  await expect(buyer.getByText('Could not reach the bookstore.', { exact: false })).toBeVisible();
  expect(submissions).toBe(1);
  await buyer.getByRole('button', { name: 'Place order' }).click();
  await expect(buyer.getByRole('heading', { name: 'Order received' })).toBeVisible();
  const orderId = new URL(buyer.url()).pathname.split('/')[2];
  await buyer.getByRole('navigation', { name: 'Store' }).getByRole('link', { name: 'Orders' }).click();
  await buyer.reload();
  await expect(buyer.getByRole('table', { name: 'Orders' }).locator('tbody tr')).toHaveCount(1);
  await admin.goto('/admin/orders/' + orderId);
  await admin.getByLabel('New fulfillment status').selectOption('Confirmed');
  await admin.getByRole('button', { name: 'Update status' }).click();
  await expect(admin.getByText('Order status updated.')).toBeVisible();
  await buyer.reload();
  await expect(buyer.getByText('Confirmed', { exact: true })).toBeVisible();
  await admin.screenshot({ path: info.outputPath('admin-order.png') });
  expect(errors).toEqual([]);
  await admin.close();
  await buyer.close();
});

test('E2E-02 catalog reflow, 200% text, accessibility scan, lost connection and empty states', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'On the shelves' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Featured books' }).locator('.cover img')).toBeVisible();
  await page.screenshot({ path: info.outputPath('home-desktop.png') });
  await page.goto('/catalog');
  await expect(page.getByText('193 books')).toBeVisible();
  for (const width of [320, 700, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 320) {
      await expect(page.getByLabel('Category', { exact: true })).not.toBeVisible();
      await page.screenshot({ path: info.outputPath('catalog-320.png') });
      await page.getByText('Filters', { exact: true }).click();
      await expect(page.getByLabel('Category', { exact: true })).toBeVisible();
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  await page.goto('/catalog');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map(item => [item.id, item.nodes.map(node => node.target)])).toEqual([]);
  await page.route('**/api/books?*', route => route.abort());
  await page.getByLabel('Search books').fill('no such book 557949');
  await page.getByRole('button', { name: 'Submit book search' }).click();
  await expect(page.getByText('Could not reach the bookstore.', { exact: false })).toBeVisible();
  await page.unroute('**/api/books?*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'No books match your search' })).toBeVisible();
  await page.route('**/api/books?*', route => route.fulfill({ json: { items: [], total: 0, page: 1, pages: 1 } }));
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'The catalog is empty' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Empty Cart');
  await page.getByLabel('Email').fill('empty@example.test');
  await page.getByLabel('Password').fill(pass);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/register');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Cart' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await page.context().addCookies([{ name: 'folio_session', value: 'expired-session', url: 'http://localhost:4175' }]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Store policies' }).getByRole('link', { name: 'Privacy notice' }).click();
  await expect(page.getByRole('heading', { name: 'Retention and your rights' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Store policies' }).getByRole('link', { name: 'Terms and conditions' }).click();
  await expect(page.getByRole('heading', { name: 'Cancellations, returns and complaints' })).toBeVisible();
});
