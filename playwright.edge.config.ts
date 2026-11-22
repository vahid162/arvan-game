import { defineConfig } from '@playwright/test';
import browser from './playwright.config';

const baseURL = 'http://127.0.0.1:4174';

export default defineConfig({
  ...browser,
  use: { ...browser.use, baseURL },
  webServer: {
    command: 'npm run preview:edge',
    url: baseURL,
    reuseExistingServer: false,
  },
});
