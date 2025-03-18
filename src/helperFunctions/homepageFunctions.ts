import { Page } from "@playwright/test";

// Goto to Profile page
export async function gotoToProfilePage(page: Page) {
    await page.locator("//div[@class='view-profile-wrapper']/a[@href='/mnjuser/profile']").click();
    console.log('✅ Clicked on View profile');
};
