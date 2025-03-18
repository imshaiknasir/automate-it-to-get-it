import { test } from '@playwright/test';
import { login, homepage, originalFunctions } from './index';

// Example test that uses the wrapped helper functions
test('Example of using helper functions with auto-delay', async ({ page }) => {
  // Navigate to the website
  await page.goto('https://yourwebsite.com');
  
  // Use the wrapped helper functions that automatically include a 2-second delay
  await login.clickOnLoginButton(page);
  await login.enterEmailAndPassword(page, 'test@example.com', 'password123');
  await login.clickOnLoginButtonOnDrawer(page);
  await login.waitForHomePage(page);
  
  // Go to profile page
  await homepage.gotoToProfilePage(page);
  
  // Logout
  await login.logout(page);
});

// If you need to use original functions without delay in some cases
test('Example of using original helper functions without delay', async ({ page }) => {
  // Use the original functions without delay
  await originalFunctions.login.clickOnLoginButton(page);
  
  // You can mix and match as needed
  await login.enterEmailAndPassword(page, 'test@example.com', 'password123');
}); 