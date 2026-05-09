import { test as setup } from '@playwright/test';
import fs from 'fs';
import { registerRecipient, recipientCredsFile, RECIPIENT_EMAIL, RECIPIENT_PASSWORD } from '../helpers';

setup('register recipient user', async ({ page }) => {
  await registerRecipient(page, RECIPIENT_EMAIL, RECIPIENT_PASSWORD);
  fs.writeFileSync(recipientCredsFile, JSON.stringify({ email: RECIPIENT_EMAIL, password: RECIPIENT_PASSWORD }));
});
