const path = require('node:path');
const { chromium, devices } = require('playwright');
const dotenv = require('dotenv');
const {
	loadStorageStatePath,
	saveStorageState,
	STORAGE_FILE,
} = require('./utils/storage-state');

const ENV_PATH = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: ENV_PATH });

const HOME_URL = 'https://www.naukri.com/';
const REGISTER_URL_MATCHER = /registration\/createAccount/i;
const LOGIN_URL_MATCHER = /nlogin\/login/i;

const PREFERRED_LOCATION = process.env.NAUKRI_TOGGLE_CITY || 'Kolkata';

const HEADLESS = process.env.HEADLESS === 'true';

function requireCredentials() {
	const email = process.env.USER_EMAIL;
	const password = process.env.USER_PASSWORD;

	if (!email || !password) {
		throw new Error('Missing USER_EMAIL or USER_PASSWORD in environment variables.');
	}

	return { email, password };
}

async function navigateToRegister(page) {
	await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
	const registerLink = page.locator('#register_Layer');
	await registerLink.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForNavigation({ url: REGISTER_URL_MATCHER, timeout: 15000 }),
		registerLink.click({ trial: false }),
	]);
}

async function openLoginFromRegister(page) {
	const loginLink = page.locator('a[href="https://www.naukri.com/nlogin/login"]');
	await loginLink.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForNavigation({ url: LOGIN_URL_MATCHER, timeout: 15000 }),
		loginLink.click(),
	]);
}

async function performLogin(page, credentials) {
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
}

async function confirmLogin(page) {
	try {
		await page.waitForURL(/naukri.com\/(mnjuser|myhomepage)/i, { timeout: 20000 });
	} catch (error) {
		throw new Error('Login might have failed or took too long.');
	}
}

async function openProfileAndTogglePreferredLocation(page, cityName = 'Kolkata') {
	const profileLink = page.locator('.view-profile-wrapper a[href="/mnjuser/profile"]');
	await profileLink.waitFor({ state: 'visible', timeout: 30000 });
	console.log('Login confirmed. Opening profile page...');
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

	const locationChip = preferencesModal.locator(`.selectedChips .chip:has-text("${cityName}")`);
	if (await locationChip.count() > 0) {
		console.log(`${cityName} already present. Removing to toggle off.`);
		const removeIcon = locationChip.locator('.fn-chips-cross');
		await removeIcon.first().waitFor({ state: 'visible', timeout: 10000 });
		await removeIcon.first().click();
		// Wait for any matching chip to disappear from selected chips
		await preferencesModal
			.locator(`.selectedChips .chip:has-text("${cityName}")`)
			.first()
			.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {
				console.warn(`Timed out waiting for ${cityName} chip to be detached; continuing.`);
			});
	} else {
		console.log(`${cityName} not present. Adding to toggle on.`);
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
		console.log(`${cityName} added to preferred locations.`);
	}

	console.log('Saving career preferences...');
	await preferencesModal.locator('button#submit-btn.btn-blue:has-text("Save")').click();
	await preferencesModal.waitFor({ state: 'hidden', timeout: 20000 });
	console.log('Career preferences saved.');
}

async function main() {
	const desktopChrome = devices['Desktop Chrome'];
	const storageState = await loadStorageStatePath();
	const contextOptions = {
		viewport: desktopChrome.viewport,
		userAgent: desktopChrome.userAgent,
		locale: 'en-US',
		colorScheme: 'light',
	};

	if (storageState) {
		contextOptions.storageState = storageState;
	}

	const browser = await chromium.launch({ headless: HEADLESS, slowMo: 50 });
	const context = await browser.newContext(contextOptions);
	const page = await context.newPage();
	let sessionActive = false;

	try {
		if (storageState) {
			await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
			if (!LOGIN_URL_MATCHER.test(page.url())) {
				sessionActive = true;
				console.log(`Reusing storage state from ${STORAGE_FILE}`);
			} else {
				console.warn('Stored session appears expired. Performing fresh login.');
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
			console.log(`Login successful. Storage state saved to ${STORAGE_FILE}`);
		}

		// After we have a valid session, open profile and toggle preferred location.
		await openProfileAndTogglePreferredLocation(page, PREFERRED_LOCATION);
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
