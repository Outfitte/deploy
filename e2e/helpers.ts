import { Browser, Page, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export const adminCredsFile = path.join(__dirname, '.auth/admin-creds.json');
export const memberCredsFile = path.join(__dirname, '.auth/member-creds.json');
export const recipientCredsFile = path.join(__dirname, '.auth/recipient-creds.json');

export async function adminLogin(page: Page) {
  const { email, password } = JSON.parse(fs.readFileSync(adminCredsFile, 'utf-8'));
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);
}

export async function registerUser(browser: Browser): Promise<{ email: string; password: string }> {
  const email = `user-${Date.now()}@test.local`;
  const password = 'User1234!';
  const page = await browser.newPage();
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL((url) => !url.toString().includes('/register'));
  await page.close();
  return { email, password };
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export const RECIPIENT_EMAIL = 'recipient@example.com';
export const RECIPIENT_PASSWORD = 'recipient-password-123';

export async function registerRecipient(
  page: Page,
  email = RECIPIENT_EMAIL,
  password = RECIPIENT_PASSWORD,
): Promise<string> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);
  return email;
}

export async function recipientLogin(page: Page) {
  const { email, password } = JSON.parse(fs.readFileSync(recipientCredsFile, 'utf-8'));
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);
}

export async function switchUser(page: Page, email: string, password: string) {
  await logout(page);
  await loginAs(page, email, password);
}
