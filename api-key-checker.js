// api-key-checker.js
// Simple script to check and debug your Claude API key
// Run this in your browser's developer console

async function checkClaudeApiKey() {
    console.log('======= CLAUDE API KEY CHECKER =======');
    
    try {
      // Check Chrome storage for API key
      console.log('\nChecking Chrome storage for Claude API key:');
      const result = await chrome.storage.local.get(['claudeKey']);
      
      if (!result.claudeKey) {
        console.error('❌ No Claude API key found in storage');
        return;
      }
      
      const key = result.claudeKey;
      
      // Log key details (but mask most of it)
      const maskedKey = key.substring(0, 8) + '...' + key.substring(key.length - 4);
      console.log('✅ Found Claude API key:', maskedKey);
      console.log('Key length:', key.length);
      
      // Check format
      const isOldFormat = key.startsWith('sk-ant-');
      const isNewFormat = key.startsWith('sk-') && !key.startsWith('sk-ant-');
      
      if (isOldFormat) {
        console.log('✅ Key format: Old format (sk-ant-)');
      } else if (isNewFormat) {
        console.log('✅ Key format: New format (sk-)');
      } else {
        console.error('❌ Invalid key format. Should start with sk-ant- or sk-');
        return;
      }
      
      // Test the API key
      console.log('\nTesting API key with a basic request:');
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      
      // Use the right authentication method
      if (isNewFormat) {
        headers['Authorization'] = `Bearer ${key}`;
        console.log('Using Bearer token authentication');
      } else {
        headers['x-api-key'] = key;
        console.log('Using x-api-key authentication');
      }
      
      // Make a simple request
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          messages: [{
            role: 'user',
            content: 'Hello, this is a test message from the API key checker.'
          }],
          max_tokens: 10
        })
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API test successful! Response:', data);
      } else {
        const errorText = await response.text();
        console.error('❌ API test failed:', errorText);
        
        if (response.status === 401) {
          console.error('API key is invalid or expired. Please check your key and try again.');
        }
      }
      
    } catch (error) {
      console.error('Error checking API key:', error);
    }
    
    console.log('\n======= API KEY CHECK COMPLETE =======');
  }
  
  // Run checker
  checkClaudeApiKey();