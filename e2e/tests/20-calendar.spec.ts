import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

const OUTFIT_NAME = 'Calendar-E2E-Outfit';
const OUTFIT_NAME_2 = 'Calendar-E2E-Outfit-2';

// ─── Date helpers ─────────────────────────────────────────────────────────────

// Returns yyyy-MM-dd for a specific target day of the current month, capped at today.
function currentMonthDayInput(wantedDay: number): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const today = d.getUTCDate();
  const day = Math.min(wantedDay, today);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Returns yyyy-MM-dd for the 15th of the previous month.
function prevMonthDayInput(): string {
  const d = new Date();
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15));
  const year = prev.getUTCFullYear();
  const month = prev.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}-15`;
}

// Returns 'MMMM yyyy' label (e.g. 'May 2026') in UTC — matches date-fns on a UTC system.
function monthYearLabel(d: Date): string {
  const month = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${month} ${d.getUTCFullYear()}`;
}

function currentMonthLabel(): string {
  return monthYearLabel(new Date());
}

function prevMonthLabel(): string {
  const d = new Date();
  return monthYearLabel(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
}

// Returns the label for N months ahead of the current month.
function futureMonthLabel(n: number): string {
  const d = new Date();
  return monthYearLabel(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

// Extracts day-of-month integer from a yyyy-MM-dd string.
function dayOfMonth(dateStr: string): number {
  return parseInt(dateStr.split('-')[2], 10);
}

// Finds the in-month calendar day cell for a given day number.
function calendarDayCell(page: Page, day: number) {
  return page.locator('[data-testid="calendar-day"]').filter({
    has: page.locator('span').filter({ hasText: new RegExp('^' + day + '$') }),
  });
}

// ─── Fixed test dates ─────────────────────────────────────────────────────────
// Evaluated once at module scope — safe because these helpers use Date.now() internally
// (not a Playwright re-evaluated describe-block, just plain TS at import time).

const DATE_1 = currentMonthDayInput(1); // 1st of current month
const DATE_2 = currentMonthDayInput(8); // 8th of current month (or today if today < 8)
const DATE_3 = currentMonthDayInput(31); // today
const DATE_PREV = prevMonthDayInput(); // 15th of previous month

const DAY_1 = dayOfMonth(DATE_1);
const DAY_2 = dayOfMonth(DATE_2);
const DAY_3 = dayOfMonth(DATE_3);

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('calendar — setup', () => {
  test('create outfits and log wears across current and previous month', async ({ page }) => {
    // Create main outfit
    await page.goto('/outfits/new');
    await page.getByLabel('Name').fill(OUTFIT_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);

    // Log 3 wears in current month
    for (const date of [DATE_1, DATE_2, DATE_3]) {
      await page.getByRole('button', { name: 'Log wear' }).click();
      await page.getByLabel('Date').fill(date);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();
    }

    // Log 1 wear in previous month
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill(DATE_PREV);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();

    // Create second outfit (used for multi-log same-day edge case)
    await page.goto('/outfits/new');
    await page.getByLabel('Name').fill(OUTFIT_NAME_2);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

test.describe('calendar — happy path', () => {
  test('calendar page renders and defaults to current month', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByTestId('calendar-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(currentMonthLabel());
  });

  test('3 current-month logs appear in correct day cells; prev-month log absent', async ({
    page,
  }) => {
    await page.goto('/calendar');
    await expect(page.getByTestId('calendar-page')).toBeVisible();

    // Each logged date should have a button in its cell
    await expect(calendarDayCell(page, DAY_1).getByRole('button', { name: OUTFIT_NAME })).toBeVisible();
    await expect(calendarDayCell(page, DAY_2).getByRole('button', { name: OUTFIT_NAME })).toBeVisible();
    await expect(calendarDayCell(page, DAY_3).getByRole('button', { name: OUTFIT_NAME })).toBeVisible();

    // Total log buttons in current month = 3 (prev-month log is not fetched)
    await expect(page.getByRole('button', { name: OUTFIT_NAME })).toHaveCount(3);
  });

  test('Previous month: header updates, prev-month log appears, current-month logs gone', async ({
    page,
  }) => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(prevMonthLabel());
    // Previous-month log on the 15th is now visible
    await expect(calendarDayCell(page, 15).getByRole('button', { name: OUTFIT_NAME })).toBeVisible();
    // Only 1 log visible (the current-month logs are out of range)
    await expect(page.getByRole('button', { name: OUTFIT_NAME })).toHaveCount(1);
  });

  test('Next month twice from prev: header advances, cells empty', async ({ page }) => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(futureMonthLabel(1));
    await expect(page.getByRole('button', { name: OUTFIT_NAME })).toHaveCount(0);
  });

  test('Today button: returns to current month with 3 logs', async ({ page }) => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(currentMonthLabel());
    await expect(page.getByRole('button', { name: OUTFIT_NAME })).toHaveCount(3);
  });

  test('clicking a log entry navigates to the outfit detail page', async ({ page }) => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: OUTFIT_NAME }).first().click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test.describe('calendar — edge cases', () => {
  test('days outside current month are rendered (muted)', async ({ page }) => {
    await page.goto('/calendar');
    // The grid always pads to full weeks so outside-month cells exist
    await expect(page.locator('[data-testid="calendar-day-outside"]').first()).toBeVisible();
  });

  test('multiple outfit logs on the same day all render in the same cell', async ({ page }) => {
    // Log OUTFIT_NAME_2 on the same day as DATE_1
    await page.goto('/outfits');
    await page.getByRole('link', { name: 'View ' + OUTFIT_NAME_2, exact: true }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill(DATE_1);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();

    await page.goto('/calendar');
    // Both outfit buttons appear in the same day cell
    await expect(calendarDayCell(page, DAY_1).getByRole('button', { name: OUTFIT_NAME, exact: true })).toBeVisible();
    await expect(calendarDayCell(page, DAY_1).getByRole('button', { name: OUTFIT_NAME_2, exact: true })).toBeVisible();
  });

  test('year boundary: navigating back from January reaches December of previous year', async ({
    page,
  }) => {
    await page.goto('/calendar');
    // Navigate back to January of current year
    const monthsToJan = new Date().getUTCMonth(); // 0 = Jan, so N months back
    for (let i = 0; i < monthsToJan; i++) {
      await page.getByRole('button', { name: 'Previous month' }).click();
    }
    const currentYear = new Date().getUTCFullYear();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`January ${currentYear}`);
    // One more click crosses the year boundary
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`December ${currentYear - 1}`);
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

test.describe('calendar — cleanup', () => {
  test('delete test outfits', async ({ page }) => {
    for (const name of [OUTFIT_NAME, OUTFIT_NAME_2]) {
      await page.goto('/outfits');
      const card = page.getByTestId('outfit-card').filter({ hasText: name });
      if ((await card.count()) === 0) continue;
      await page.getByRole('link', { name: 'View ' + name, exact: true }).click();
      await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/outfits$/);
    }
  });
});
