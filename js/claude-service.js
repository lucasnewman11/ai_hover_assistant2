// claude-service.js

class ClaudeService {
    constructor() {
      this.apiKey = null;
      this.initialized = false;
      this.initPromise = this.initialize();
      
      // Simple request queue to prevent race conditions
      this.requestQueue = Promise.resolve();
    }
    
    async initialize() {
      try {
        console.log('Initializing Claude Service...');
        
        // Try to load API key from storage
        const result = await chrome.storage.local.get(['claudeKey']);
        
        if (result.claudeKey) {
          console.log('Found Claude API key in storage');
          this.apiKey = this.sanitizeApiKey(result.claudeKey);
          this.initialized = true;
          return true;
        }
        
        console.log('No Claude API key in storage, checking .env file');
        
        // Try to load from .env file as fallback
        try {
          const envUrl = chrome.runtime.getURL('.env');
          const response = await fetch(envUrl, { cache: 'no-store' });
          
          if (response.ok) {
            const envText = await response.text();
            const match = envText.match(/CLAUDE_API_KEY=["']([^"']+)["']/);
            
            if (match && match[1]) {
              this.apiKey = this.sanitizeApiKey(match[1]);
              console.log('Loaded Claude API key from .env file');
              
              // Save to storage for next time
              await chrome.storage.local.set({ claudeKey: this.apiKey });
              console.log('Saved API key to storage');
              
              this.initialized = true;
              return true;
            }
          }
        } catch (envError) {
          console.warn('Failed to load .env file:', envError);
        }
        
        console.warn('No Claude API key found');
        return false;
      } catch (error) {
        console.error('Claude Service initialization error:', error);
        return false;
      }
    }
    
    sanitizeApiKey(key) {
      // Trim whitespace and ensure the key is valid
      if (!key) return null;
      
      const sanitized = key.trim();
      
      // Validate key format - accept both old and new formats
      const isValidOldFormat = sanitized.startsWith('sk-ant-');
      const isValidNewFormat = sanitized.startsWith('sk-') && !sanitized.startsWith('sk-ant-');
      
      if (!isValidOldFormat && !isValidNewFormat) {
        console.warn('API key has invalid format. Should start with sk-ant- or sk-');
        return null;
      }
      
      return sanitized;
    }
    
    determineAuthHeader(apiKey) {
      // Handle both authorization formats for Claude API
      if (!apiKey) return null;
      
      // Determine which authentication method to use based on key format
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      
      if (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-')) {
        // New format keys use Bearer authentication
        console.log('Using Authorization: Bearer header for newer sk- format key');
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        // Old format keys use x-api-key
        console.log('Using x-api-key header for sk-ant- format key');
        headers['x-api-key'] = apiKey;
      }
      
      return headers;
    }
    
    async updateApiKey(newKey) {
      const sanitized = this.sanitizeApiKey(newKey);
      
      if (!sanitized) {
        console.error('Cannot update API key: Invalid format');
        return false;
      }
      
      // Store in memory
      this.apiKey = sanitized;
      
      // Store in storage
      try {
        await chrome.storage.local.set({ claudeKey: sanitized });
        console.log('API key updated successfully');
        return true;
      } catch (error) {
        console.error('Failed to update API key in storage:', error);
        return false;
      }
    }
    
    async query(prompt, context = null) {
      // Add to request queue to prevent race conditions
      return new Promise((resolve, reject) => {
        this.requestQueue = this.requestQueue.then(async () => {
          try {
            const result = await this._executeQuery(prompt, context);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    async _executeQuery(prompt, context = null) {
      try {
        // Ensure service is initialized
        if (!this.initialized) {
          await this.initPromise;
        }
        
        // Check for API key
        if (!this.apiKey) {
          throw new Error('Claude API key is not set. Please configure your API key in the extension settings.');
        }
        
        console.log('Preparing Claude API request...');
        
        // Prepare complete prompt with context if provided
        let fullPrompt = prompt;
        
        if (context) {
          fullPrompt = `Current webpage content:
  ${context.text}
  
  URL: ${context.url || 'Not provided'}
  Title: ${context.title || 'Not provided'}
  
  User question: ${prompt}`;
        }
        
        // Build request body
        const requestBody = {
          model: "claude-3-sonnet-20240229",
          messages: [{
            role: "user",
            content: fullPrompt
          }],
          max_tokens: 4096,
          temperature: 0.7
        };
        
        // Get appropriate headers
        const headers = this.determineAuthHeader(this.apiKey);
        
        if (!headers) {
          throw new Error('Failed to determine API authentication method');
        }
        
        console.log('Sending request to Claude API...');
        
        // Make the API request
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody)
        });
        
        console.log(`Claude API response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Claude API error: ${errorText}`);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please check your API key and try again.');
          } else {
            throw new Error(`Claude API Error (${response.status}): ${errorText}`);
          }
        }
        
        const data = await response.json();
        console.log('Successfully received Claude API response');
        
        const responseText = data.content[0].text;
        
        return {
          text: responseText,
          rawResponse: data
        };
      } catch (error) {
        console.error('Claude query error:', error);
        throw error;
      }
    }
    
    // Verify API key is valid by making a minimal request
    async verifyApiKey(apiKey) {
      try {
        const sanitized = this.sanitizeApiKey(apiKey);
        
        if (!sanitized) {
          return { valid: false, error: 'Invalid API key format' };
        }
        
        const headers = this.determineAuthHeader(sanitized);
        
        if (!headers) {
          return { valid: false, error: 'Failed to determine API authentication method' };
        }
        
        // Small test query
        const testBody = {
          model: "claude-3-sonnet-20240229",
          messages: [{
            role: "user",
            content: "Hello, this is an API key validation test."
          }],
          max_tokens: 20
        };
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(testBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          return { 
            valid: false, 
            status: response.status,
            error: `API Error (${response.status}): ${errorText}`
          };
        }
        
        return { valid: true };
      } catch (error) {
        console.error('API key verification error:', error);
        return { valid: false, error: error.message };
      }
    }
  }
  
  window.ClaudeService = ClaudeService;