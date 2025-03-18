import { Page } from "@playwright/test";

/**
 * A higher-order function that wraps an async Playwright helper function
 * and automatically adds a 2-second delay after the original function completes.
 * 
 * @param fn The original helper function to wrap
 * @returns A new function that calls the original function and then waits 2 seconds
 */
export function withDelay<T extends any[], R>(
  fn: (page: Page, ...args: T) => Promise<R>
): (page: Page, ...args: T) => Promise<R> {
  return async (page: Page, ...args: T): Promise<R> => {
    try {
      // Call the original function
      const result = await fn(page, ...args);
      
      // Add a 2-second delay after each action
      console.log(`✅ Action completed: ${fn.name}. Waiting 2 seconds...`);
      await page.waitForTimeout(2000);
      
      return result;
    } catch (error) {
      console.error(`❌ Error in ${fn.name}:`, error);
      throw error;
    }
  };
}

/**
 * A utility to wrap all exported functions from a module with the delay function.
 * 
 * @param module The module containing helper functions to wrap
 * @returns A new object with all the functions wrapped with delays
 */
export function wrapModuleWithDelay<T extends Record<string, any>>(module: T): T {
  const wrappedModule = {} as T;
  
  for (const key in module) {
    const value = module[key];
    if (typeof value === 'function') {
      wrappedModule[key] = withDelay(value) as any;
    } else {
      wrappedModule[key] = value;
    }
  }
  
  return wrappedModule;
} 