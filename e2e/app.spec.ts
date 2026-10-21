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
