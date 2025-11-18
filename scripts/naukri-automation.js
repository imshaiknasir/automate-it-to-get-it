const path = require('node:path');
const fs = require('fs').promises;
const { chromium, devices } = require('playwright');
const dotenv = require('dotenv');
const {
	loadStorageStatePath,
	saveStorageState,
	STORAGE_FILE,
} = require('./utils/storage-state');
const { logger, logExecution, generateExecutionId, formatDuration } = require('./utils/logger');

const ENV_PATH = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: ENV_PATH });

const HOME_URL = 'https://www.naukri.com/';
const REGISTER_URL_MATCHER = /registration\/createAccount/i;
const LOGIN_URL_MATCHER = /nlogin\/login/i;

const PREFERRED_LOCATION = process.env.NAUKRI_TOGGLE_CITY || 'Kolkata';
const HEADLESS = process.env.HEADLESS === 'true';
const EXECUTION_ID = process.env.EXECUTION_ID || generateExecutionId();
const VIDEOS_DIR = path.join(__dirname, '..', 'videos');

function requireCredentials() {
	const email = process.env.USER_EMAIL;
	const password = process.env.USER_PASSWORD;

	if (!email || !password) {
		throw new Error('Missing USER_EMAIL or USER_PASSWORD in environment variables.');
	}

	return { email, password };
}

async function navigateToRegister(page) {
	logger.info('Navigating to registration page', { executionId: EXECUTION_ID });
	await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
	const registerLink = page.locator('#register_Layer');
	await registerLink.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForNavigation({ url: REGISTER_URL_MATCHER, timeout: 15000 }),
		registerLink.click({ trial: false }),
	]);
	logger.info('Registration page loaded', { executionId: EXECUTION_ID });
}

async function openLoginFromRegister(page) {
	logger.info('Opening login page', { executionId: EXECUTION_ID });
	const loginLink = page.locator('a[href="https://www.naukri.com/nlogin/login"]');
	await loginLink.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForNavigation({ url: LOGIN_URL_MATCHER, timeout: 15000 }),
		loginLink.click(),
	]);
	logger.info('Login page loaded', { executionId: EXECUTION_ID });
}

async function performLogin(page, credentials) {
	logger.info('Performing login', { executionId: EXECUTION_ID, email: credentials.email });
	const emailField = page.locator('#usernameField');
	const passwordField = page.locator('#passwordField');
	const submitButton = page.getByRole('button', { name: 'Login', exact: true });

	await emailField.waitFor({ state: 'visible', timeout: 15000 });
	await emailField.fill(credentials.email);

	await passwordField.waitFor({ state: 'visible', timeout: 15000 });
	await passwordField.fill(credentials.password);

	await submitButton.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForLoadState('domcontentloaded'),
		submitButton.click(),
	]);
	logger.info('Login form submitted', { executionId: EXECUTION_ID });
}

async function confirmLogin(page) {
	try {
		await page.waitForURL(/naukri.com\/(mnjuser|myhomepage)/i, { timeout: 20000 });
		logger.info('Login confirmed successfully', { executionId: EXECUTION_ID, url: page.url() });
	} catch (error) {
		logger.error('Login confirmation failed', { executionId: EXECUTION_ID, error: error.message });
		throw new Error('Login might have failed or took too long.');
	}
}

async function openProfileAndTogglePreferredLocation(page, cityName = 'Kolkata') {
	const profileLink = page.locator('.view-profile-wrapper a[href="/mnjuser/profile"]');
	await profileLink.waitFor({ state: 'visible', timeout: 30000 });
	logger.info('Opening profile page', { executionId: EXECUTION_ID });
	await profileLink.click();
	await page.waitForLoadState('domcontentloaded');

	const careerPreferencesHeading = page.locator('h1.section-heading:has-text("Your career preferences")');
	await careerPreferencesHeading.waitFor({ state: 'visible', timeout: 30000 });
	logger.info('Career preferences section visible', { executionId: EXECUTION_ID });

	logger.info('Opening career preferences editor', { executionId: EXECUTION_ID });
	await careerPreferencesHeading.locator('.new-pencil').first().click();

	const preferencesModal = page.locator('.styles_modal__gNwvD[role="dialog"]');
	await preferencesModal.waitFor({ state: 'visible', timeout: 20000 });
	await preferencesModal.locator('h1.title:has-text("Career preferences")').waitFor({ state: 'visible', timeout: 10000 });
	logger.info('Career preferences modal opened', { executionId: EXECUTION_ID });

	const locationChip = preferencesModal.locator(`.selectedChips .chip:has-text("${cityName}")`);
	let action = '';
	
	if (await locationChip.count() > 0) {
		logger.info('Location already present, removing to toggle off', { executionId: EXECUTION_ID, location: cityName });
		action = 'removed';
		const removeIcon = locationChip.locator('.fn-chips-cross');
		await removeIcon.first().waitFor({ state: 'visible', timeout: 10000 });
		await removeIcon.first().click();
		// Wait for any matching chip to disappear from selected chips
		await preferencesModal
			.locator(`.selectedChips .chip:has-text("${cityName}")`)
			.first()
			.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {
				logger.warn('Timeout waiting for location chip to be detached', { executionId: EXECUTION_ID, location: cityName });
			});
	} else {
		logger.info('Location not present, adding to toggle on', { executionId: EXECUTION_ID, location: cityName });
		action = 'added';
		const locationInput = preferencesModal.locator('#location');
		await locationInput.click();
		await locationInput.fill('');

		const targetCity = cityName;
		await locationInput.type(targetCity, { delay: 120 });
		await page.waitForTimeout(800);

		const suggestion = preferencesModal.locator(`.sugItemWrapper:has-text("${cityName}")`).first();
		await suggestion.waitFor({ state: 'visible', timeout: 10000 });
		await suggestion.click();
		await preferencesModal.locator(`.selectedChips .chip:has-text("${cityName}")`).waitFor({ state: 'visible', timeout: 10000 });
		logger.info('Location added to preferred locations', { executionId: EXECUTION_ID, location: cityName });
	}

	logger.info('Saving career preferences', { executionId: EXECUTION_ID, action, location: cityName });
	await preferencesModal.locator('button#submit-btn.btn-blue:has-text("Save")').click();
	await preferencesModal.waitFor({ state: 'hidden', timeout: 20000 });
	logger.info('Career preferences saved successfully', { executionId: EXECUTION_ID, action, location: cityName });
	
	return action;
}

async function main() {
	const startTime = Date.now();
	let videoPath = null;
	
	logger.info('Starting Naukri automation', {
		executionId: EXECUTION_ID,
		headless: HEADLESS,
		preferredLocation: PREFERRED_LOCATION,
		timestamp: new Date().toISOString(),
	});

	// Ensure videos directory exists
	await fs.mkdir(VIDEOS_DIR, { recursive: true });

	const desktopChrome = devices['Desktop Chrome'];
	const storageState = await loadStorageStatePath();
	const contextOptions = {
		viewport: desktopChrome.viewport,
		userAgent: desktopChrome.userAgent,
		locale: 'en-US',
		colorScheme: 'light',
		// Enable video recording for ALL runs
		recordVideo: {
			dir: VIDEOS_DIR,
			size: { width: 1280, height: 720 },
		},
	};

	if (storageState) {
		contextOptions.storageState = storageState;
	}

	const browser = await chromium.launch({ headless: HEADLESS, slowMo: 50 });
	const context = await browser.newContext(contextOptions);
	const page = await context.newPage();
	let sessionActive = false;
	let action = '';
	let success = false;

	try {
		if (storageState) {
			await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
			if (!LOGIN_URL_MATCHER.test(page.url())) {
				sessionActive = true;
				logger.info('Reusing stored session', { executionId: EXECUTION_ID, storageFile: STORAGE_FILE });
			} else {
				logger.warn('Stored session expired, performing fresh login', { executionId: EXECUTION_ID });
			}
		}

		if (!sessionActive) {
			const credentials = requireCredentials();
			await navigateToRegister(page);
			await openLoginFromRegister(page);
			await performLogin(page, credentials);
			await confirmLogin(page);
			await saveStorageState(context);
			sessionActive = true;
			logger.info('Login successful, storage state saved', { executionId: EXECUTION_ID, storageFile: STORAGE_FILE });
		}

		// After we have a valid session, open profile and toggle preferred location.
		action = await openProfileAndTogglePreferredLocation(page, PREFERRED_LOCATION);
		success = true;

		const duration = Date.now() - startTime;
		
		// Log execution summary
		const summary = {
			executionId: EXECUTION_ID,
			success: true,
			action,
			location: PREFERRED_LOCATION,
			duration: formatDuration(duration),
			durationMs: duration,
			timestamp: new Date().toISOString(),
			sessionReused: sessionActive && storageState !== null,
		};

		logExecution(summary);
		logger.info('Automation completed successfully', summary);
	} catch (error) {
		success = false;
		const duration = Date.now() - startTime;
		
		const errorSummary = {
			executionId: EXECUTION_ID,
			success: false,
			action,
			location: PREFERRED_LOCATION,
			duration: formatDuration(duration),
			durationMs: duration,
			timestamp: new Date().toISOString(),
			error: error.message,
			stack: error.stack,
		};

		logExecution(errorSummary);
		logger.error('Automation failed', errorSummary);
		throw error;
	} finally {
		// Get video path before closing context
		try {
			videoPath = await page.video()?.path();
		} catch (e) {
			logger.warn('Could not get video path', { executionId: EXECUTION_ID, error: e.message });
		}

		await browser.close();

		// Log video recording info
		if (videoPath) {
			logger.info('Video recording saved', {
				executionId: EXECUTION_ID,
				videoPath,
				success,
			});
		}
	}
}

main().catch((error) => {
	logger.error('Unhandled error in main', {
		executionId: EXECUTION_ID,
		error: error.message,
		stack: error.stack,
	});
	process.exitCode = 1;
});
