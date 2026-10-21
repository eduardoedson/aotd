import { expect, test } from '@playwright/test';
import { mockAnilist } from './fixtures';

const today = () => new Date().toISOString().slice(0, 10);

test.beforeEach(async ({ page }) => {
  // Start every test with consent already decided so the banner stays out of the way.
  await page.addInitScript(() => {
    window.localStorage.setItem('aotd:consent', JSON.stringify({ analytics: false, decidedAt: 1 }));
    window.localStorage.setItem('aotd:timezone', JSON.stringify('utc'));
  });
});

test('redirects to today and loads more episodes while scrolling', async ({ page }) => {
  await mockAnilist(page);
  await page.goto('/');

  await expect(page).toHaveURL(new RegExp(`/${today()}$`));
  await expect(page.locator('.card-container:not([aria-hidden])')).toHaveCount(50);
  await expect(page.getByText('50+ episodes airing on this day')).toBeVisible();

  await page.getByRole('button', { name: 'Load more episodes' }).scrollIntoViewIfNeeded();
  await expect(page.getByText('62 episodes airing on this day')).toBeVisible();
  await expect(page.locator('article.card-container')).toHaveCount(62);
});

test('filters by favorites and search, stored in the URL', async ({ page }) => {
  await mockAnilist(page);
  await page.goto(`/${today()}`);

  await page.getByRole('button', { name: 'Favorite Mock Anime 01' }).click();
  await page.getByRole('button', { name: 'Favorite Mock Anime 03' }).click();
  await page.getByRole('button', { name: 'Only my favorites' }).click();

  await expect(page).toHaveURL(/fav=1/);
  await expect(page.locator('article.card-container')).toHaveCount(2);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('article.card-container').first()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search titles' }).fill('anime 1');
  await expect(page.getByText(/^10 of 62\+? episodes match your filters$/)).toBeVisible();
});

test('opens the details page and comes back', async ({ page }) => {
  await mockAnilist(page);
  await page.goto(`/${today()}`);

  await page.locator('.card-content').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sousou no Frieren' })).toBeVisible();
  await expect(page).toHaveTitle('Sousou no Frieren :: AOTD');
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();

  await page.getByRole('link', { name: /Back to schedule/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${today()}$`));
});

test('shows the week view with seven days', async ({ page }) => {
  await mockAnilist(page);
  await page.goto(`/${today()}?view=week`);

  await expect(page.locator('.week-column')).toHaveCount(7);
  await expect(page.getByText(/episodes this week$/)).toBeVisible();
  await expect(page.locator('.week-column.is-today')).toHaveCount(1);
});

test('moves between days with the keyboard', async ({ page }) => {
  await mockAnilist(page);
  await page.goto('/2026-10-21');
  await expect(page.locator('article.card-container').first()).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/2026-10-22$/);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/2026-10-20$/);
});

test('asks for cookie consent before loading analytics', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockAnilist(page);
  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('googletagmanager')) analyticsRequests.push(request.url());
  });

  await page.goto(`/${today()}`);
  await expect(page.getByRole('dialog', { name: 'Cookies and analytics' })).toBeVisible();
  expect(analyticsRequests).toHaveLength(0);

  await page.getByRole('button', { name: 'Accept analytics' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookies and analytics' })).toBeHidden();
  await expect.poll(() => analyticsRequests.length).toBeGreaterThan(0);
  await context.close();
});

test('week view shows one day at a time on phones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile layout only');
  await mockAnilist(page);
  await page.goto(`/${today()}?view=week`);

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(7);
  await expect(page.locator('.week-column:visible')).toHaveCount(1);

  await tabs.nth(0).click();
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.week-column:visible')).toHaveCount(1);
});

test('touch targets are at least 44px on phones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile layout only');
  await mockAnilist(page);
  await page.goto(`/${today()}`);
  await page.locator('article.card-container').first().waitFor();

  for (const selector of ['.card-favorite', '.filters-chip', '.calendar-view-toggle button']) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box?.height, selector).toBeGreaterThanOrEqual(44);
    expect(box?.width, selector).toBeGreaterThanOrEqual(44);
  }
});

test('active filters show as removable chips', async ({ page }) => {
  await mockAnilist(page);
  await page.goto(`/${today()}?genre=Action&status=RELEASING`);

  const chips = page.getByRole('list', { name: 'Active filters' });
  await expect(chips.getByRole('button', { name: 'Remove filter Action' })).toBeVisible();
  await chips.getByRole('button', { name: 'Remove filter Action' }).click();
  await expect(page).not.toHaveURL(/genre=/);
  await expect(page).toHaveURL(/status=RELEASING/);
});

test('title search finds anime from any day', async ({ page }) => {
  await mockAnilist(page);
  await page.goto(`/${today()}`);

  await page.getByRole('searchbox', { name: 'Search titles' }).fill('frieren');
  const results = page.getByRole('region', { name: 'Search results from every day' });
  await expect(results.getByText('Search Result for frieren')).toBeVisible();
  await expect(results.getByRole('link', { name: 'Go to day' })).toBeVisible();
});

test('library lists favorites with their next episode', async ({ page }) => {
  await mockAnilist(page);
  await page.goto(`/${today()}`);
  await page.getByRole('button', { name: 'Favorite Mock Anime 01' }).click();

  await page.getByRole('link', { name: /My library/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My library' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible();
  await expect(page.locator('.library-poster')).toHaveCount(1);
  await expect(page.locator('.library-poster').getByText(/^Ep 3 on /)).toBeVisible();
});

test('header stays at the top while scrolling', async ({ page }) => {
  await mockAnilist(page);
  await page.goto(`/${today()}`);
  await page.locator('article.card-container').first().waitFor();

  await page.mouse.wheel(0, 1500);
  await expect
    .poll(async () => (await page.locator('.infoBar-container').boundingBox())?.y)
    .toBe(0);
});
