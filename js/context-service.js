// context-service.js

class ContextService {
    constructor() {
      // Basic configuration
      this.lastCapture = null;
      this.cachedContext = null;
      this.captureInterval = 5000; // 5 seconds
    }
    
    async captureContext() {
      try {
        // Return cached context if recent
        if (this.lastCapture && (Date.now() - this.lastCapture) < this.captureInterval) {
          console.log('Using cached webpage context');
          return this.cachedContext;
        }
        
        console.log('Capturing new webpage context');
        
        // Basic context data
        const context = {
          url: window.location.href,
          title: document.title,
          text: '',
          selectedText: window.getSelection().toString(),
          timestamp: Date.now()
        };
        
        // First try to get the selected text if any
        if (context.selectedText) {
          console.log('Using selected text as context');
          context.text = context.selectedText;
        } else {
          // Otherwise capture visible content using a simplified approach
          context.text = await this.captureVisibleContent();
        }
        
        // Cache the results
        this.cachedContext = context;
        this.lastCapture = Date.now();
        
        console.log('Context captured successfully', {
          url: context.url,
          textLength: context.text?.length || 0
        });
        
        return context;
      } catch (error) {
        console.error('Error capturing context:', error);
        
        // Return basic context even on error
        return {
          url: window.location.href,
          title: document.title,
          text: 'Error capturing page content',
          timestamp: Date.now()
        };
      }
    }
    
    async captureVisibleContent() {
      try {
        // Try to find main content using common selectors
        const mainSelectors = [
          'main', 
          'article', 
          '[role="main"]', 
          '.content', 
          '.article-content',
          '#content',
          '.post-content'
        ];
        
        // Try each selector
        for (const selector of mainSelectors) {
          const element = document.querySelector(selector);
          if (element && this.isVisible(element)) {
            const text = this.getElementText(element);
            if (text && text.length > 100) {
              return this.cleanText(text);
            }
          }
        }
        
        // Fallback: get all paragraph content
        const paragraphs = Array.from(document.querySelectorAll('p'))
          .filter(p => this.isVisible(p))
          .map(p => p.textContent)
          .join('\n\n');
        
        if (paragraphs && paragraphs.length > 100) {
          return this.cleanText(paragraphs);
        }
        
        // Last resort: get all visible text
        return this.cleanText(document.body.innerText);
      } catch (error) {
        console.error('Error capturing visible content:', error);
        return '';
      }
    }
    
    isVisible(element) {
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      return !(
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0'
      );
    }
    
    getElementText(element) {
      if (!element) return '';
      
      // Extract text without scripts, styles
      const clone = element.cloneNode(true);
      
      // Remove script and style elements
      const scripts = clone.querySelectorAll('script, style, noscript');
      scripts.forEach(script => script.remove());
      
      return clone.textContent;
    }
    
    cleanText(text) {
      if (!text) return '';
      
      return text
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .trim()
        .slice(0, 5000);  // Limit to 5000 chars
    }
    
    clearCache() {
      this.cachedContext = null;
      this.lastCapture = null;
    }
  }
  
  window.ContextService = ContextService;