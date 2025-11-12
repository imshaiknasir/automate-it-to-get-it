const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Enable stealth plugin to reduce automation fingerprints
chromium.use(stealth);

/**
 * Fetches proxy list from WebShare.io API
 * @returns {Promise<Array<string>>} Array of proxy URLs
 */
async function fetchProxyList() {
  const proxyListUrl = process.env.PROXY_LIST_URL;
  
  if (!proxyListUrl) {
    console.log('No PROXY_LIST_URL configured.');
    return [];
  }

  try {
    console.log('Fetching proxy list from WebShare.io...');
    const response = await fetch(proxyListUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch proxy list: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Parse proxy list
    // Format can be either:
    // - IP:PORT (direct mode)
    // - IP:PORT:username:password (username mode)
    const proxies = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(proxy => {
        // If proxy already has protocol, return as-is
        if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
          return proxy;
        }
        
        // Parse the format: IP:PORT or IP:PORT:username:password
        const parts = proxy.split(':');
        
        if (parts.length >= 4) {
          // Format: IP:PORT:username:password
          const [ip, port, username, password] = parts;
          return `http://${username}:${password}@${ip}:${port}`;
        } else if (parts.length === 2) {
          // Format: IP:PORT (direct)
          return `http://${proxy}`;
        } else {
          console.warn(`Skipping invalid proxy format: ${proxy}`);
          return null;
        }
      })
      .filter(proxy => proxy !== null);
    
    console.log(`✅ Loaded ${proxies.length} proxies from WebShare.io`);
    return proxies;
  } catch (error) {
    console.error('❌ Failed to fetch proxy list:', error.message);
    return [];
  }
}

/**
 * Gets a cached proxy list or fetches new one
 * Cache expires after 24 hours
 * @returns {Promise<Array<string>>} Array of proxy URLs
 */
async function getProxyList() {
  const cacheFile = path.join(__dirname, '..', '.proxy-cache.json');
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  try {
    // Check if cache exists and is valid
    if (fs.existsSync(cacheFile)) {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const age = Date.now() - cache.timestamp;
      
      if (age < CACHE_DURATION && cache.proxies && cache.proxies.length > 0) {
        console.log(`📦 Using cached proxy list (${cache.proxies.length} proxies, age: ${Math.round(age / 1000 / 60)}m)`);
        return cache.proxies;
      }
    }
  } catch (error) {
    console.warn('Cache read failed, fetching fresh proxy list...');
  }

  // Fetch fresh proxy list
  const proxies = await fetchProxyList();
  
  if (proxies.length > 0) {
    // Save to cache
    try {
      fs.writeFileSync(cacheFile, JSON.stringify({
        timestamp: Date.now(),
        proxies: proxies
      }));
      console.log('💾 Proxy list cached for 24 hours');
    } catch (error) {
      console.warn('Failed to cache proxy list:', error.message);
    }
  }
  
  return proxies;
}

/**
 * Selects a random proxy from the list
 * @param {Array<string>} proxies Array of proxy URLs
 * @returns {string|null} Random proxy URL or null
 */
function selectRandomProxy(proxies) {
  if (!proxies || proxies.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * proxies.length);
  return proxies[randomIndex];
}

(async () => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  // Determine proxy configuration
  let proxyConfig = null;
  
  if (process.env.PROXY_LIST_URL) {
    // New method: Download proxy list and select random one
    const proxies = await getProxyList();
    const proxyUrl = selectRandomProxy(proxies);
    
    if (proxyUrl) {
      console.log(`🎲 Selected random proxy: ${proxyUrl}`);
      
      // Parse proxy URL to extract credentials if present
      // Format: http://username:password@IP:PORT or http://IP:PORT
      try {
        const url = new URL(proxyUrl);
        const server = `${url.protocol}//${url.hostname}:${url.port}`;
        
        proxyConfig = { server };
        
        // Add credentials if present
        if (url.username && url.password) {
          proxyConfig.username = url.username;
          proxyConfig.password = url.password;
          console.log(`🔐 Using authenticated proxy: ${server} (user: ${url.username})`);
        } else {
          console.log(`🌐 Using direct proxy: ${server}`);
        }
      } catch (error) {
        console.error(`❌ Failed to parse proxy URL: ${error.message}`);
        proxyConfig = null;
      }
    } else {
      console.log('⚠️  No proxies available, using direct connection.');
    }
  } else if (process.env.PROXY_SERVER) {
    // Fallback: Use static proxy server
    const proxyUrl = process.env.PROXY_SERVER;
    console.log(`🔧 Using static proxy: ${proxyUrl}`);
    
    try {
      const url = new URL(proxyUrl);
      const server = `${url.protocol}//${url.hostname}:${url.port}`;
      
      proxyConfig = { server };
      
      if (url.username && url.password) {
        proxyConfig.username = url.username;
        proxyConfig.password = url.password;
      }
    } catch (error) {
      proxyConfig = { server: proxyUrl };
    }
  }

  const launchOptions = {
    headless: isCI,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  };

  if (proxyConfig) {
    launchOptions.proxy = proxyConfig;
    console.log(`✅ Proxy configured successfully`);
  } else {
    console.log('🌐 No proxy configured; using direct connection.');
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
    await page.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: isCI ? 90000 : 60000 });
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
