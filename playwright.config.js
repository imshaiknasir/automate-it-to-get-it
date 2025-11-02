const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 60000, // 60 seconds timeout per action
  use: {
    headless: false, // Run in headed mode to see the automation
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
