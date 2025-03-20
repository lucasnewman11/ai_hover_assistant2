document.addEventListener('DOMContentLoaded', async () => {
    // DOM elements
    const apiKeyForm = document.getElementById('api-key-form');
    const claudeKeyInput = document.getElementById('claude-key');
    const statusMessage = document.getElementById('status-message');
    const creditsCounter = document.getElementById('credits-counter');
    const openAssistantBtn = document.getElementById('open-assistant');
    const resetCreditsBtn = document.getElementById('reset-credits');
    
    // Load API key from storage
    await loadApiKey();
    
    // Update credits display
    await updateCreditsDisplay();
    
    // Form submission handler
    apiKeyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveApiKey();
    });
    
    // Open assistant button
    openAssistantBtn.addEventListener('click', async () => {
      await openAssistant();
    });
    
    // Reset credits button
    resetCreditsBtn.addEventListener('click', async () => {
      await resetCredits();
    });
    
    /**
     * Load API key from storage
     */
    async function loadApiKey() {
      try {
        const result = await chrome.storage.local.get(['claudeKey']);
        if (result.claudeKey) {
          claudeKeyInput.value = result.claudeKey;
        }
      } catch (error) {
        console.error('Error loading API key:', error);
      }
    }
    
    /**
     * Save API key to storage
     */
    async function saveApiKey() {
      try {
        const claudeKey = claudeKeyInput.value.trim();
        
        if (!claudeKey) {
          showError('Please enter a valid API key');
          return;
        }
        
        // Basic validation
        if (!isValidClaudeKey(claudeKey)) {
          showError('Invalid Claude API key format. Should start with sk-ant- or sk-');
          return;
        }
        
        // Save key
        await chrome.storage.local.set({ claudeKey });
        
        // Update key in background script
        await chrome.runtime.sendMessage({
          action: 'updateAPIKey',
          keyType: 'claude',
          key: claudeKey
        });
        
        showSuccess('API key saved successfully');
        
      } catch (error) {
        console.error('Error saving API key:', error);
        showError(`Error: ${error.message}`);
      }
    }
    
    /**
     * Basic API key format validation
     */
    function isValidClaudeKey(key) {
      return (
        key.startsWith('sk-ant-') || 
        (key.startsWith('sk-') && !key.startsWith('sk-ant-'))
      );
    }
    
    /**
     * Open the assistant in the current tab
     */
    async function openAssistant() {
      try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
          showError('No active tab found');
          return;
        }
        
        // Toggle the hover box
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleHoverBox' 
        });
        
        if (response.success) {
          window.close(); // Close popup
        } else {
          showError(response.error || 'Failed to open assistant');
        }
        
      } catch (error) {
        console.error('Error opening assistant:', error);
        showError(`Error: ${error.message}`);
      }
    }
    
    /**
     * Reset usage credits
     */
    async function resetCredits() {
      try {
        await chrome.storage.local.set({ 'ai_hover_usage': 0 });
        await updateCreditsDisplay();
        showSuccess('Credits reset successfully');
      } catch (error) {
        console.error('Error resetting credits:', error);
        showError(`Error: ${error.message}`);
      }
    }
    
    /**
     * Update the credits display
     */
    async function updateCreditsDisplay() {
      try {
        const result = await chrome.storage.local.get(['ai_hover_usage']);
        const usage = result.ai_hover_usage || 0;
        const remaining = Math.max(0, 25 - usage);
        
        creditsCounter.textContent = remaining;
        
      } catch (error) {
        console.error('Error updating credits display:', error);
        creditsCounter.textContent = '--';
      }
    }
    
    /**
     * Show a success message
     */
    function showSuccess(message) {
      statusMessage.textContent = message;
      statusMessage.className = 'status success';
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        statusMessage.className = 'status';
      }, 3000);
    }
    
    /**
     * Show an error message
     */
    function showError(message) {
      statusMessage.textContent = message;
      statusMessage.className = 'status error';
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        statusMessage.className = 'status';
      }, 5000);
    }
  });