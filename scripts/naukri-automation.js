const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Enable stealth plugin to reduce automation fingerprints
chromium.use(stealth);

(async () => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  const proxyServer = process.env.PROXY_SERVER
    || (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD ? 'http://p.webshare.io:80' : null);

  const launchOptions = {
    headless: isCI,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  };

  if (proxyServer) {
    console.log(`Routing traffic through proxy: ${proxyServer}`);
    launchOptions.proxy = {
      server: proxyServer,
      username: process.env.PROXY_USERNAME || undefined,
      password: process.env.PROXY_PASSWORD || undefined
    };
  } else {
    console.log('No proxy configured; using direct connection.');
  }

  const browser = await chromium.launch(launchOptions);

  const videosDir = path.join(__dirname, '..', 'videos');
  await fs.promises.mkdir(videosDir, { recursive: true });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    recordVideo: { dir: videosDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to Naukri.com...');
    await page.goto('https://www.naukri.com/', { waitUntil: 'load', timeout: 60000 });
    console.log('Page loaded.');

    console.log('Waiting for Jobseeker Login button...');
    const loginButton = page.locator('a#login_Layer.nI-gNb-lg-rg__login[title="Jobseeker Login"]');
    await loginButton.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Clicking Jobseeker Login button...');
    await loginButton.click();
    console.log('Jobseeker Login button clicked.');

    console.log('Waiting for email and password fields...');
    const emailField = page.locator('form[name="login-form"] input[type="text"]');
    const passwordField = page.locator('form[name="login-form"] input[type="password"]');
    await Promise.all([
      emailField.waitFor({ state: 'visible', timeout: 30000 }),
      passwordField.waitFor({ state: 'visible', timeout: 30000 })
    ]);
    console.log('Email and password fields are visible.');
  } catch (error) {
    console.error('Failed to load Naukri.com:', error.message);
  } finally {
    const video = typeof page.video === 'function' ? page.video() : null;
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (closeError) {
      console.warn('Could not close page cleanly:', closeError.message);
    }
    try {
      await context.close();
    } catch (ctxError) {
      console.warn('Could not close context cleanly:', ctxError.message);
    }
    if (video) {
      try {
        const videoPath = await video.path();
        console.log(`Session video saved at: ${videoPath}`);
      } catch (videoError) {
        console.warn('Could not retrieve video path:', videoError.message);
      }
    }
    await browser.close();
  }
})();
