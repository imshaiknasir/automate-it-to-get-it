import * as loginFunctions from './loginFunctions';
import * as homepageFunctions from './homepageFunctions';
import * as careerProfileFunctions from './profilePage/careerProfile';
import { wrapModuleWithDelay } from './utils';

// Import any additional helper function modules here

// Re-export all helper functions with the delay wrapper
export const login = wrapModuleWithDelay(loginFunctions);
export const homepage = wrapModuleWithDelay(homepageFunctions);
export const profilePage = {
  careerProfile: wrapModuleWithDelay(careerProfileFunctions)
};

// Add any additional modules here

// For cases where you need the original functions without delay
export const originalFunctions = {
  login: loginFunctions,
  homepage: homepageFunctions,
  profilePage: {
    careerProfile: careerProfileFunctions
  }
}; 