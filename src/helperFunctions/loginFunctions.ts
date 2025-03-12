import { expect, Page } from "@playwright/test";

// Click on login button present on the header
export async function clickOnLoginButton(page: Page) {
    await page.locator('#login_Layer').click();
};

// Check if drawer is open
export async function isDrawerOpen(page: Page) {
    const drawer = page.locator('.drawer-wrapper');
    return await drawer.isVisible();
};

// Enter email and password
export async function enterEmailAndPassword(page: Page, email: string, password: string) {
    await page.getByRole('textbox', { name: 'Enter your active Email ID /' }).pressSequentially(email, { delay: 100 });
    await page.getByRole('textbox', { name: 'Enter your password' }).pressSequentially(password, { delay: 100 });
    await page.getByText('Show', { exact: true }).click();
};

// Click on login button present on the drawer
export async function clickOnLoginButtonOnDrawer(page: Page) {
    await page.getByRole('button', { name: 'Login', exact: true }).click();
};

// Wait until the page URL is mnjuser/homepage
export async function waitForHomePage(page: Page): Promise<boolean> {
    const startTime = Date.now();
    const timeout = 10000;

    while (Date.now() - startTime < timeout) {
        const currentUrl = page.url();
        if (currentUrl.includes('mnjuser/homepage')) {
            await page.getByRole('link', { name: 'View profile' }).waitFor({ state: 'visible' });
            return true;
        }
        await page.waitForTimeout(500); // Wait 500ms before checking again
    }
    return false;
};

// Logout from the application
export async function logout(page: Page) {
    await page.locator('.nI-gNb-drawer__bars').click();
    await page.getByText('Logout').click();
    await expect(page.locator('h1')).toContainText('Find your dream job now');  
};

