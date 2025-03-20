// background.js

// Track tabs where scripts have been injected
const injectedTabs = new Set();

// Cache for API keys
let apiKeys = {
  claude: '',
};

/**
 * Helper function to load API keys
 */
async function loadApiKeys() {
  try {
    const storedKeys = await chrome.storage.local.get(['claudeKey']);
    
    if (storedKeys.claudeKey) {
      console.log('Found Claude API key in storage');
      apiKeys.claude = storedKeys.claudeKey.trim(); // Ensure no whitespace
      return true;
    }
    
    console.log('No Claude API key found in storage, checking .env file');
    
    // Try to load from .env file
    try {
      const envUrl = chrome.runtime.getURL('.env');
      const response = await fetch(envUrl);
      
      if (response.ok) {
        const envText = await response.text();
        const match = envText.match(/CLAUDE_API_KEY=["']([^"']+)["']/);
        
        if (match && match[1]) {
          apiKeys.claude = match[1].trim();
          console.log('Loaded Claude API key from .env file');
          
          // Save to storage for next time
          await chrome.storage.local.set({ claudeKey: apiKeys.claude });
          
          return true;
        }
      }
    } catch (envError) {
      console.warn('Failed to load .env file:', envError);
    }
    
    console.log('No API keys found');
    return false;
    
  } catch (error) {
    console.error('Error loading API keys:', error);
    return false;
  }
}

// Load API keys on startup
loadApiKeys();

/**
 * Handle API validation requests
 */
async function validateApiKey(key, type = 'claude') {
  console.log(`Validating ${type} API key`);
  
  if (!key) {
    return { valid: false, error: 'No API key provided' };
  }
  
  const trimmedKey = key.trim();
  
  if (type === 'claude') {
    // Check for valid Claude key formats
    const isValid = 
      trimmedKey.startsWith('sk-ant-') || 
      (trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('sk-ant-'));
    
    if (!isValid) {
      return { 
        valid: false, 
        error: 'Invalid Claude API key format. Should start with sk-ant- or sk-' 
      };
    }
    
    // Optional: make a small test request to verify
    return { valid: true };
  }
  
  return { valid: false, error: 'Unknown API type' };
}

/**
 * Handle Claude API requests
 */
async function handleClaudeRequest(message) {
  try {
    // Load API keys if needed
    if (!apiKeys.claude) {
      await loadApiKeys();
    }
    
    if (!apiKeys.claude) {
      throw new Error('Claude API key is not set. Please configure your API key in extension settings.');
    }
    
    // Prepare request body
    const requestBody = {
      model: "claude-3-sonnet-20240229",
      messages: [{
        role: "user",
        content: message.prompt
      }],
      max_tokens: 4096,
      temperature: 0.7
    };
    
    // Determine the right header format based on the key format
    const trimmedKey = apiKeys.claude.trim();
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };
    
    if (trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('sk-ant-')) {
      // New format keys use Bearer authentication
      console.log('Using Bearer authentication for Claude API');
      headers['Authorization'] = `Bearer ${trimmedKey}`;
    } else {
      // Old format keys use x-api-key
      console.log('Using x-api-key authentication for Claude API');
      headers['x-api-key'] = trimmedKey;
    }
    
    // Make the API request
    console.log('Sending request to Claude API');
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
        throw new Error('Authentication failed. Please check your API key.');
      } else {
        throw new Error(`Claude API Error (${response.status}): ${errorText}`);
      }
    }
    
    const data = await response.json();
    console.log('Successfully received Claude API response');
    
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    console.error('Claude API error:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Handle a direct API call from content script
 */
async function handleApiCall(message) {
  try {
    console.log('Handling API call', message.model);
    
    // Currently only supporting Claude
    if (message.model !== 'claude') {
      throw new Error('Only Claude API is supported in this version');
    }
    
    const response = await handleClaudeRequest(message);
    return response;
    
  } catch (error) {
    console.error('API call error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action);
  
  if (message.action === 'validateAPIKey') {
    // Validate an API key
    validateApiKey(apiKeys[message.model], message.model)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ 
        valid: false, 
        error: error.message 
      }));
    return true; // Keep the message channel open for the async response
  }
  
  if (message.action === 'updateAPIKey') {
    // Update an API key
    const keyType = message.keyType;
    const key = message.key;
    
    if (!keyType || !key) {
      sendResponse({ success: false, error: 'Missing key type or key' });
      return true;
    }
    
    // Store in memory
    apiKeys[keyType] = key.trim();
    
    // Store in storage
    chrome.storage.local.set({ [`${keyType}Key`]: key })
      .then(() => {
        console.log(`${keyType} API key updated`);
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error(`Failed to save ${keyType} API key:`, error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'callAPI') {
    // Make an API call
    handleApiCall(message)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true;
  }
  
  if (message.action === 'toggleHoverBox') {
    // Toggle the hover box in the content script
    handleToggleHoverBox(sender.tab.id)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true;
  }
  
  // Default response for unknown actions
  sendResponse({ 
    success: false, 
    error: `Unknown action: ${message.action}` 
  });
  return false;
});

/**
 * Handle injecting and toggling the hover box
 */
async function handleToggleHoverBox(tabId) {
  try {
    console.log('Handling toggle hover box for tab:', tabId);
    
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab) {
      throw new Error('Tab not found');
    }
    
    if (tab.url.startsWith('chrome://')) {
      throw new Error('Cannot inject into chrome:// URLs');
    }
    
    // Inject scripts if needed
    const needsInjection = !injectedTabs.has(tabId);
    
    if (needsInjection) {
      console.log('Injecting content scripts into tab:', tabId);
      
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'js/claude-service.js',
          'js/context-service.js',
          'js/hover-box.js',
          'js/content-script.js'
        ]
      });
      
      injectedTabs.add(tabId);
      console.log('Scripts injected successfully');
    }
    
    // Send toggle message to content script
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'toggleHoverBox',
      timestamp: Date.now()
    });
    
    return { success: true, response };
    
  } catch (error) {
    console.error('Toggle hover box error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Set up context menu
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'askAboutSelection',
    title: 'Ask About Selection',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'askAboutSelection') {
    try {
      // Inject scripts if needed
      if (!injectedTabs.has(tab.id)) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'js/claude-service.js',
            'js/context-service.js',
            'js/hover-box.js',
            'js/content-script.js'
          ]
        });
        
        injectedTabs.add(tab.id);
      }
      
      // Send selected text to content script
      await chrome.tabs.sendMessage(tab.id, {
        action: 'processSelection',
        selectedText: info.selectionText
      });
      
    } catch (error) {
      console.error('Error processing selection:', error);
    }
  }
});

/**
 * Clean up when tabs are closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});