import { Page, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export const adminCredsFile = path.join(__dirname, '.auth/admin-creds.json');

export async function adminLogin(page: Page) {
  const { email, password } = JSON.parse(fs.readFileSync(adminCredsFile, 'utf-8'));
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);
}
