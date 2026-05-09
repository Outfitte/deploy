import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { registerRecipient } from '../helpers';

const recipientCredsFile = path.join(__dirname, '../.auth/recipient-creds.json');

const RECIPIENT_EMAIL = 'recipient@example.com';
const RECIPIENT_PASSWORD = 'recipient-password-123';

setup('register recipient user', async ({ page }) => {
  await registerRecipient(page, RECIPIENT_EMAIL, RECIPIENT_PASSWORD);
  fs.writeFileSync(recipientCredsFile, JSON.stringify({ email: RECIPIENT_EMAIL, password: RECIPIENT_PASSWORD }));
});
