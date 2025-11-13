const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function fillWithFallback(page, selectors, value, fieldLabel) {
  if (!value) {
    throw new Error(`Missing value for ${fieldLabel}. Check environment configuration.`);
  }

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      
      // More human-like behavior: move mouse, click, and type naturally
      await locator.hover();
      await page.waitForTimeout(200 + Math.random() * 400);
      await locator.click();
      await page.waitForTimeout(300 + Math.random() * 500);
      
      // Clear field first
      await locator.fill('');
      await page.waitForTimeout(100 + Math.random() * 200);
      
      // Type with more realistic human-like behavior
      // Humans don't type at constant speed - they have bursts and pauses
      let charCount = 0;
      for (const char of value) {
        // Variable typing speed - faster for common sequences, slower for special chars
        let baseDelay = 80;
        
        // Slower for special characters
        if (!/[a-zA-Z0-9]/.test(char)) {
          baseDelay = 150;
        }
        
        // Add natural variation
        const delay = baseDelay + Math.random() * 120;
        
        await locator.type(char, { delay });
        charCount++;
        
        // Occasional longer pauses (like humans thinking/reading)
        if (charCount % 8 === 0 && Math.random() > 0.5) {
          await page.waitForTimeout(300 + Math.random() * 500);
        }
        
        // Very rarely, simulate a typo and correction (10% chance)
        if (Math.random() < 0.1 && charCount < value.length - 1) {
          // Type a wrong character
          const wrongChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
          await locator.type(wrongChar, { delay: 100 });
          await page.waitForTimeout(200 + Math.random() * 300);
          // Delete it
          await locator.press('Backspace');
          await page.waitForTimeout(150 + Math.random() * 200);
        }
      }
      
      // Pause after finishing typing (like humans reviewing what they typed)
      await page.waitForTimeout(400 + Math.random() * 600);
      
      console.log(`Filled ${fieldLabel} using selector: ${selector}`);
      return;
    } catch (error) {
      console.log(`Selector ${selector} failed for ${fieldLabel}: ${error.message}`);
    }
  }

  throw new Error(`Could not locate ${fieldLabel} input on the page.`);
}

async function simulateHumanMouseMovement(page, targetX, targetY) {
  // Simulate curved mouse movement to target
  const steps = 10 + Math.floor(Math.random() * 10);
  const currentMouse = { x: 0, y: 0 };
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Add some curve to the movement
    const curveOffset = Math.sin(progress * Math.PI) * (50 + Math.random() * 50);
    const x = currentMouse.x + (targetX - currentMouse.x) * progress + curveOffset;
    const y = currentMouse.y + (targetY - currentMouse.y) * progress;
    
    await page.mouse.move(x, y);
    await page.waitForTimeout(10 + Math.random() * 20);
  }
}

async function clickWithFallback(page, selectors, description) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300 + Math.random() * 500);
      
      // Get element position for realistic mouse movement
      const box = await locator.boundingBox();
      if (box) {
        const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
        const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * 10;
        
        // Simulate human-like mouse movement
        await simulateHumanMouseMovement(page, targetX, targetY);
      }
      
      // Human-like behavior: hover before clicking
      await locator.hover();
      await page.waitForTimeout(400 + Math.random() * 600);
      
      // Sometimes double-check before clicking (move away slightly and come back)
      if (Math.random() > 0.7) {
        await page.mouse.move(
          (await locator.boundingBox()).x - 20,
          (await locator.boundingBox()).y - 20
        );
        await page.waitForTimeout(200);
        await locator.hover();
        await page.waitForTimeout(200);
      }
      
      await locator.click();
      await page.waitForTimeout(500 + Math.random() * 800);
      
      console.log(`Clicked ${description} using selector: ${selector}`);
      return;
    } catch (error) {
      console.log(`Selector ${selector} failed for ${description}: ${error.message}`);
    }
  }

  throw new Error(`Could not click ${description}; no selectors matched.`);
}

/**
 * Decodes base64-encoded CV files from environment variables and saves them temporarily
 * @returns {Array<{path: string, ext: string}>} Array of decoded CV file paths
 */
function decodeAndSaveCVs() {
  const cvFiles = [];
  const tempDir = path.join(__dirname, '..', 'temp-cvs');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Check for CV files in environment (CV_FILE_1_BASE64, CV_FILE_2_BASE64, etc.)
  for (let i = 1; i <= 10; i++) {
    const base64Key = `CV_FILE_${i}_BASE64`;
    const extKey = `CV_FILE_${i}_EXT`;
    
    const base64Content = process.env[base64Key];
    const fileExt = process.env[extKey] || 'pdf';
    
    if (base64Content) {
      try {
        const buffer = Buffer.from(base64Content, 'base64');
        const filePath = path.join(tempDir, `resume-${i}.${fileExt}`);
        fs.writeFileSync(filePath, buffer);
        cvFiles.push({ path: filePath, ext: fileExt });
        console.log(`Decoded CV ${i}: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.warn(`Failed to decode ${base64Key}: ${error.message}`);
      }
    }
  }
  
  return cvFiles;
}

/**
 * Selects a random CV from the available decoded CVs
 * @param {Array<{path: string, ext: string}>} cvFiles Array of CV file objects
 * @returns {{path: string, ext: string}|null} Randomly selected CV or null if none available
 */
function selectRandomCV(cvFiles) {
  if (cvFiles.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * cvFiles.length);
  const selected = cvFiles[randomIndex];
  console.log(`Selected CV ${randomIndex + 1} of ${cvFiles.length}: ${path.basename(selected.path)}`);
  return selected;
}

/**
 * Cleans up temporary CV files after upload
 * @param {string} tempDir Directory containing temporary CV files
 */
function cleanupTempFiles(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
      console.log('Temporary CV files cleaned up.');
    }
  } catch (error) {
    console.warn(`Failed to cleanup temp files: ${error.message}`);
  }
}

(async () => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const hasDisplay = !!process.env.DISPLAY; // Check if DISPLAY is set (Xvfb or local X11)

  // Auto-detect: Use headless in CI unless DISPLAY is available (Xvfb setup)
  // Locally: Use headed mode (DISPLAY usually set, or headless works on macOS)
  const shouldUseHeadless = isCI && !hasDisplay;
  
  console.log(`Running in ${shouldUseHeadless ? 'headless' : 'headed'} mode`);
  console.log(`Environment: ${isCI ? 'CI' : 'Local'}${hasDisplay ? ` (DISPLAY=${process.env.DISPLAY})` : ''}`);

  const launchOptions = {
    headless: shouldUseHeadless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-infobars',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--no-first-run',
      '--enable-automation=false',
      '--password-store=basic',
      '--use-mock-keychain',
      '--lang=en-IN',
      '--window-size=1920,1080',
      // Additional stealth arguments
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    // Important: Use a persistent context with user data to appear more like a real browser
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled']
  };

  const browser = await chromium.launch(launchOptions);

  const videosDir = path.join(__dirname, '..', 'videos');
  await fs.promises.mkdir(videosDir, { recursive: true });

  // Add viewport randomization for more natural appearance
  const viewportWidth = 1920 + Math.floor(Math.random() * 100);
  const viewportHeight = 1080 + Math.floor(Math.random() * 100);

  // Randomize Chrome version for more realistic fingerprint
  const chromeVersions = ['120.0.0.0', '119.0.0.0', '121.0.0.0', '118.0.0.0'];
  const chromeVersion = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
  
  // More realistic user agents pool
  const userAgents = [
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 Edg/120.0.0.0`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  ];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    geolocation: { longitude: 88.3639, latitude: 22.5726 },
    permissions: ['geolocation'],
    hasTouch: false,
    isMobile: false,
    colorScheme: 'light',
    // Add extra HTTP headers that real browsers send
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9,en-US;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': `"Not_A Brand";v="8", "Chromium";v="${chromeVersion.split('.')[0]}", "Google Chrome";v="${chromeVersion.split('.')[0]}"`,
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    },
    recordVideo: { dir: videosDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  
  // Inject comprehensive scripts to mask automation detection
  await page.addInitScript(() => {
    // Overwrite the `navigator.webdriver` property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Remove automation-related properties
    delete navigator.__proto__.webdriver;

    // Realistic plugins array with proper Plugin objects
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
        // Make it behave like PluginArray
        plugins.item = (i) => plugins[i];
        plugins.namedItem = (name) => plugins.find(p => p.name === name);
        return plugins;
      },
    });

    // Overwrite the `languages` property
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'en-IN'],
    });

    // Add chrome runtime object with realistic properties
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };

    // Mock permissions with realistic behavior
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Override hardwareConcurrency to realistic value
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    // Mock device memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // Add connection information
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false
      }),
    });

    // WebGL fingerprinting countermeasures
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      // Mask vendor and renderer
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter.apply(this, arguments);
    };

    // Canvas fingerprinting countermeasures
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      // Add minimal noise to canvas fingerprinting
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = imageData.data[i] ^ Math.floor(Math.random() * 2);
        }
        context.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.apply(this, arguments);
    };

    // AudioContext fingerprinting countermeasures
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const originalCreateOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function() {
        const oscillator = originalCreateOscillator.apply(this, arguments);
        const originalStart = oscillator.start;
        oscillator.start = function() {
          // Add slight variation to audio fingerprint
          oscillator.frequency.value = oscillator.frequency.value + Math.random() * 0.0001;
          return originalStart.apply(this, arguments);
        };
        return oscillator;
      };
    }

    // Battery API masking
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      });
    }

    // Mask screen properties to look like real device
    Object.defineProperties(screen, {
      availWidth: { get: () => window.innerWidth },
      availHeight: { get: () => window.innerHeight },
      colorDepth: { get: () => 24 },
      pixelDepth: { get: () => 24 }
    });

    // Add realistic Date implementation (timezone consistency)
    const originalDate = Date;
    Date = class extends originalDate {
      constructor(...args) {
        if (args.length === 0) {
          super();
        } else {
          super(...args);
        }
      }
      
      getTimezoneOffset() {
        return -330; // IST offset
      }
    };
    Date.prototype = originalDate.prototype;
    Date.now = originalDate.now;
    Date.parse = originalDate.parse;
    Date.UTC = originalDate.UTC;

    // Remove Playwright-specific properties
    delete window.playwright;
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;
  });
  
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  await ensureDir(screenshotsDir);

  try {
    console.log('Navigating to Naukri.com...');
    await page.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: isCI ? 90000 : 60000 });
    await page.waitForTimeout(2000 + Math.random() * 3000);
    console.log('Page loaded.');

    // Simulate human browsing behavior - scroll a bit, move mouse around
    console.log('Simulating natural browsing behavior...');
    
    // Random scrolling like a human checking the page
    await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
    await page.waitForTimeout(800 + Math.random() * 1200);
    
    await page.evaluate(() => {
      window.scrollBy(0, 100 + Math.random() * 300);
    });
    await page.waitForTimeout(1000 + Math.random() * 1500);
    
    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500 + Math.random() * 1000);
    
    // Move mouse to random positions (simulating reading/looking around)
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(
        200 + Math.random() * 800,
        200 + Math.random() * 400
      );
      await page.waitForTimeout(500 + Math.random() * 1000);
    }

    console.log('Waiting for Jobseeker Login button...');
    const loginButton = page.locator('a#login_Layer.nI-gNb-lg-rg__login[title="Jobseeker Login"]');
    await loginButton.waitFor({ state: 'visible', timeout: 30000 });
    
    // Move mouse near the login button before clicking (like a human would)
    const loginBox = await loginButton.boundingBox();
    if (loginBox) {
      await page.mouse.move(
        loginBox.x - 50 + Math.random() * 100,
        loginBox.y + loginBox.height / 2
      );
      await page.waitForTimeout(500 + Math.random() * 800);
    }
    
    console.log('Clicking Jobseeker Login button...');
    await loginButton.hover();
    await page.waitForTimeout(400 + Math.random() * 600);
    await loginButton.click();
    await page.waitForTimeout(1000 + Math.random() * 1500);
    console.log('Jobseeker Login button clicked.');

    console.log('Waiting for email and password fields...');
    const emailField = page.locator('form[name="login-form"] input[type="text"]');
    const passwordField = page.locator('form[name="login-form"] input[type="password"]');
    await Promise.all([
      emailField.waitFor({ state: 'visible', timeout: 30000 }),
      passwordField.waitFor({ state: 'visible', timeout: 30000 })
    ]);
    console.log('Email and password fields are visible.');

    const emailSelectors = [
      '#usernameField',
      'input[type="text"][placeholder*="Email"]',
      'input[type="text"][placeholder*="email"]',
      'form[name="login-form"] input[type="text"]'
    ];
    const passwordSelectors = [
      '#passwordField',
      'form[name="login-form"] input[type="password"]',
      'input[type="password"][placeholder*="Password"]'
    ];

    console.log('Entering credentials...');
    await fillWithFallback(page, emailSelectors, process.env.USER_EMAIL, 'email');
    
    // Pause between fields (humans don't immediately jump to next field)
    await page.waitForTimeout(800 + Math.random() * 1200);
    
    await fillWithFallback(page, passwordSelectors, process.env.USER_PASSWORD, 'password');

    // Human-like pause after entering credentials (reviewing what was typed)
    await page.waitForTimeout(1500 + Math.random() * 2000);
    
    // Move mouse around a bit before clicking login
    await page.mouse.move(
      400 + Math.random() * 400,
      400 + Math.random() * 200
    );
    await page.waitForTimeout(500 + Math.random() * 800);

    console.log('Clicking sign-in button...');
    const loginButtonSelectors = [
      'form[name="login-form"] button[type="submit"]',
      'button:has-text("Login")',
      'input[type="submit"]',
      'button.btn-primary[type="submit"]'
    ];
    await clickWithFallback(page, loginButtonSelectors, 'login button');

    console.log('Waiting for login navigation...');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {
      console.log('Network idle wait timed out; continuing with URL checks.');
    });

    try {
      await page.waitForURL('**/mnjuser/homepage', { timeout: 30000 });
    } catch {
      console.log('Homepage redirect not detected; verifying via profile link.');
    }

    const profileLink = page.locator('.view-profile-wrapper a[href="/mnjuser/profile"]');
    await profileLink.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Login successful.');

    console.log('Opening profile page...');
    await profileLink.click();
    await page.waitForLoadState('domcontentloaded');

    const careerPreferencesHeading = page.locator('h1.section-heading:has-text("Your career preferences")');
    await careerPreferencesHeading.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Career preferences section is visible.');

    console.log('Opening career preferences editor...');
    await careerPreferencesHeading.locator('.new-pencil').first().click();

    const preferencesModal = page.locator('.styles_modal__gNwvD[role="dialog"]');
    await preferencesModal.waitFor({ state: 'visible', timeout: 20000 });
    await preferencesModal.locator('h1.title:has-text("Career preferences")').waitFor({ state: 'visible', timeout: 10000 });
    console.log('Career preferences modal open.');

    const kolkataChip = preferencesModal.locator('.selectedChips .chip:has-text("Kolkata")');
    if (await kolkataChip.count() > 0) {
      console.log('Kolkata already present. Removing to refresh.');
      await kolkataChip.locator('.fn-chips-cross').click();
      await kolkataChip.waitFor({ state: 'hidden', timeout: 10000 });
    }

    const locationInput = preferencesModal.locator('#location');
    await locationInput.click();
    await locationInput.fill('');

    const targetCity = 'Kolkata';
    for (const char of targetCity) {
      await locationInput.type(char, { delay: 150 });
    }
    await page.waitForTimeout(800);

    const suggestion = preferencesModal.locator('.sugItemWrapper:has-text("Kolkata")').first();
    await suggestion.waitFor({ state: 'visible', timeout: 10000 });
    await suggestion.click();
    await preferencesModal.locator('.selectedChips .chip:has-text("Kolkata")').waitFor({ state: 'visible', timeout: 10000 });
    console.log('Kolkata added to preferred locations.');

    console.log('Saving career preferences...');
    await preferencesModal.locator('button#submit-btn.btn-blue:has-text("Save")').click();
    await preferencesModal.waitFor({ state: 'hidden', timeout: 20000 });
    console.log('Career preferences saved.');

    // === CV Upload Flow ===
    let uploadedCV = false;
    const tempDir = path.join(__dirname, '..', 'temp-cvs');
    
    try {
      console.log('\n--- Starting CV Upload Process ---');
      
      // Decode all available CVs from environment variables
      const cvFiles = decodeAndSaveCVs();
      
      if (cvFiles.length === 0) {
        console.log('No CV files found in environment variables. Skipping CV upload.');
        console.log('To enable CV uploads, add CV_FILE_1_BASE64 (and optionally CV_FILE_1_EXT) to your secrets.');
      } else {
        // Select a random CV
        const selectedCV = selectRandomCV(cvFiles);
        
        if (selectedCV) {
          console.log(`\nUploading resume: ${path.basename(selectedCV.path)}`);
          
          // Scroll to resume section
          const resumeContainer = page.locator('.resume-upload-container').first();
          await resumeContainer.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          
          // Click the "Update resume" button
          const updateResumeButton = resumeContainer.locator('button.upload-button:has-text("Update resume")');
          await updateResumeButton.waitFor({ state: 'visible', timeout: 15000 });
          console.log('Update resume button found.');
          
          // Get the file input and upload the CV
          const fileInput = resumeContainer.locator('input[type="file"].upload-input');
          await fileInput.setInputFiles(selectedCV.path);
          console.log('CV file uploaded to input.');
          
          // Wait for progress bar to appear
          console.log('Waiting for upload progress...');
          const progressBar = page.locator('.resume-upload-container .progressbar');
          await progressBar.waitFor({ state: 'visible', timeout: 10000 });
          console.log('Upload started - progress bar visible.');
          
          // Wait for progress bar to reach 100% and disappear
          await progressBar.waitFor({ state: 'hidden', timeout: 30000 });
          console.log('Upload complete - progress bar hidden.');
          
          // Additional verification: wait a bit for any post-upload processing
          await page.waitForTimeout(2000);
          
          uploadedCV = true;
          console.log('✅ CV uploaded successfully!');
        }
      }
    } catch (error) {
      console.error('CV upload failed:', error.message);
      console.error('This is non-critical; continuing with logout.');
      
      // Capture screenshot of CV upload failure
      try {
        const timestamp = Date.now();
        const screenshotPath = path.join(screenshotsDir, `cv-upload-error-${timestamp}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`CV upload error screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error('Unable to capture CV upload error screenshot.');
      }
    } finally {
      // Always cleanup temporary CV files
      cleanupTempFiles(tempDir);
      console.log('--- CV Upload Process Completed ---\n');
    }

    console.log('Opening user menu for logout...');
    const menuIcon = page.locator('.nI-gNb-drawer__icon');
    await menuIcon.click();
    await page.waitForTimeout(500);

    console.log('Clicking logout...');
    const logoutLink = page.locator('a.nI-gNb-list-cta[title="Logout"]');
    await logoutLink.waitFor({ state: 'visible', timeout: 15000 });
    await logoutLink.click();

    await page.locator('a#login_Layer.nI-gNb-lg-rg__login:has-text("Login")').waitFor({ state: 'visible', timeout: 30000 });
    console.log('Logout successful.');
  } catch (error) {
    console.error('Automation failed:', error.message);
    const timestamp = Date.now();
    try {
      const screenshotPath = path.join(screenshotsDir, `error-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`Error screenshot saved: ${screenshotPath}`);
    } catch (screenshotError) {
      console.error(`Unable to capture error screenshot: ${screenshotError.message}`);
    }

    try {
      const htmlPath = path.join(screenshotsDir, `error-${timestamp}.html`);
      const htmlContent = await page.content();
      await fs.promises.writeFile(htmlPath, htmlContent);
      console.error(`Error HTML saved: ${htmlPath}`);
    } catch (htmlError) {
      console.error(`Unable to capture error HTML: ${htmlError.message}`);
    }
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
