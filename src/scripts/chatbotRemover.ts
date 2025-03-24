import { Page } from 'playwright';

/**
 * Starts a background observer that monitors for and removes the chatbot drawer
 * @param page The Playwright page instance to monitor
 * @returns A function that can be called to stop the observer
 */
export async function startChatbotRemover(page: Page): Promise<() => void> {
  console.log('🤖 Starting chatbot remover...');
  
  // Set up a flag to control the observer
  let isObserving = true;
  
  // Start the observer in the background
  const observerInterval = setInterval(async () => {
    if (!isObserving) return;
    
    try {
      const removed = await page.evaluate(() => {
        const chatbotElement = document.evaluate(
          "//div[@class='chatbot_Drawer chatbot_right']/parent::div",
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue as HTMLDivElement;
        
        if (chatbotElement) {
          // @ts-ignore: Element.remove() exists in modern browsers
          chatbotElement.remove();
          return true;
        }
        return false;
      });
      
      if (removed) {
        console.log('✅ Chatbot drawer removed');
      }
    } catch (error) {
      console.error('❌ Error in chatbot remover:', error);
    }
  }, 1000); // Check every second
  
  // Return a function to stop the observer
  return () => {
    console.log('🛑 Stopping chatbot remover');
    isObserving = false;
    clearInterval(observerInterval);
  };
}

/**
 * Alternative implementation using MutationObserver for better performance
 * This is more efficient as it only runs when DOM changes occur
 */
export async function startChatbotRemoverWithMutationObserver(page: Page): Promise<() => void> {
  console.log('🤖 Starting chatbot remover with MutationObserver...');
  
  // Add the observer script to the page - fixed to avoid __name reference error
  await page.evaluate(() => {
    // Check if we already have an active remover to avoid duplicates
    if ((window as any).chatbotRemoverActive) return;
    (window as any).chatbotRemoverActive = true;
    
    console.log('🔍 Setting up MutationObserver for chatbot');
    
    // Create a function to check and remove the chatbot
    const removeChatbotIfExists = () => {
      const chatbotElement = document.evaluate(
        "//div[@class='chatbot_Drawer chatbot_right']/parent::div", 
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      ).singleNodeValue;
      
      if (chatbotElement) {
        console.log('🔍 Chatbot found - removing from DOM');
        // @ts-ignore: Element.remove() exists in modern browsers
        chatbotElement.remove();
        return true;
      }
      return false;
    };
    
    // Check immediately in case it's already there
    removeChatbotIfExists();
    
    // Set up the mutation observer to watch for DOM changes
    const observer = new MutationObserver(() => {
      removeChatbotIfExists();
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Store the observer so we can disconnect it later
    (window as any).chatbotRemoverObserver = observer;
  });
  
  // Return a function to stop the observer
  return async () => {
    console.log('🛑 Stopping chatbot remover');
    await page.evaluate(() => {
      if ((window as any).chatbotRemoverObserver) {
        (window as any).chatbotRemoverObserver.disconnect();
        (window as any).chatbotRemoverObserver = null;
        (window as any).chatbotRemoverActive = false;
        console.log('✅ Chatbot remover stopped');
      }
    });
  };
} 