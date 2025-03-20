// hover-box.js

class HoverBox {
    constructor() {
      // Core state
      this.isVisible = false;
      this.isInitialized = false;
      this.position = { x: 20, y: 20 };
      this.dragOffset = { x: 0, y: 0 };
      
      // DOM elements
      this.rootElement = null;
      this.shadowRoot = null;
      this.box = null;
      
      // Services
      this.claudeService = null;
      this.contextService = null;
      this.usageTracker = null;
      
      // Bound methods to maintain context
      this._boundResizeHandler = this._handleResize.bind(this);
      this._boundUnloadHandler = this.cleanup.bind(this);
      
      // Initialize
      this.initPromise = this._initialize();
    }
    
    async _initialize() {
      try {
        console.log('Initializing HoverBox...');
        
        // Initialize required services
        await this._initializeServices();
        
        // Create and set up UI elements
        this._createUI();
        
        // Load saved position
        await this._loadSavedPosition();
        
        // Add event listeners
        this._attachEventListeners();
        
        this.isInitialized = true;
        console.log('HoverBox initialized successfully');
        
        return true;
      } catch (error) {
        console.error('HoverBox initialization failed:', error);
        this.cleanup();
        throw error;
      }
    }
    
    async _initializeServices() {
      console.log('Initializing services...');
      
      // Create Claude Service
      this.claudeService = new window.ClaudeService();
      await this.claudeService.initPromise;
      console.log('Claude Service initialized');
      
      // Create Context Service
      this.contextService = new window.ContextService();
      console.log('Context Service initialized');
      
      // Create Usage Tracker (simplified)
      this.usageTracker = {
        async incrementUsage() {
          const key = 'ai_hover_usage';
          const result = await chrome.storage.local.get([key]);
          const usage = (result[key] || 0) + 1;
          await chrome.storage.local.set({ [key]: usage });
          return { usage, remaining: Math.max(0, 25 - usage) };
        },
        
        async getUsage() {
          const key = 'ai_hover_usage';
          const result = await chrome.storage.local.get([key]);
          const usage = result[key] || 0;
          return { usage, remaining: Math.max(0, 25 - usage) };
        }
      };
      console.log('Usage Tracker initialized');
    }
    
    _createUI() {
      console.log('Creating UI elements...');
      
      // Create root element
      this.rootElement = document.createElement('div');
      this.rootElement.id = 'ai-hover-assistant';
      
      // Apply reset styles
      this.rootElement.style.all = 'initial';
      this.rootElement.style.position = 'fixed';
      this.rootElement.style.zIndex = '2147483647';
      
      // Create shadow DOM
      this.shadowRoot = this.rootElement.attachShadow({ mode: 'closed' });
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = this._getStyles();
      this.shadowRoot.appendChild(style);
      
      // Create hover box
      this.box = document.createElement('div');
      this.box.className = 'hover-box';
      this.shadowRoot.appendChild(this.box);
      
      // Set up box content
      this._createBoxContent();
      
      // Add to document
      document.body.appendChild(this.rootElement);
    }
    
    _getStyles() {
      return `
        .hover-box {
          position: fixed;
          width: 380px;
          height: 450px;
          background: rgba(30, 30, 30, 0.9);
          color: white;
          border-radius: 10px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: none;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .hover-box.visible {
          display: flex;
        }
        
        .hover-box-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          background: rgba(20, 20, 20, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          cursor: move;
          user-select: none;
        }
        
        .header-title {
          font-size: 14px;
          font-weight: 500;
        }
        
        .close-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .chat-container {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .message {
          max-width: 85%;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 14px;
          line-height: 1.4;
          animation: fadeIn 0.2s;
        }
        
        .message.user {
          background: rgba(43, 92, 155, 0.6);
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        
        .message.assistant {
          background: rgba(56, 56, 56, 0.6);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        
        .message.error {
          background: rgba(107, 27, 27, 0.6);
          align-self: center;
          text-align: center;
        }
        
        .input-container {
          padding: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        textarea {
          width: 100%;
          padding: 10px;
          background: rgba(45, 45, 45, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: white;
          font-family: inherit;
          font-size: 14px;
          resize: none;
          outline: none;
          margin-bottom: 10px;
          box-sizing: border-box;
          min-height: 80px;
        }
        
        textarea:focus {
          border-color: #4a90e2;
        }
        
        .send-btn {
          width: 100%;
          padding: 8px;
          background: #4a90e2;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .send-btn:hover {
          background: #3a7bc8;
        }
        
        .send-btn:disabled {
          background: rgba(74, 144, 226, 0.5);
          cursor: not-allowed;
        }
        
        .credits-display {
          padding: 5px 10px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
    }
    
    _createBoxContent() {
      this.box.innerHTML = `
        <div class="hover-box-header">
          <div class="header-title">AI Assistant</div>
          <button class="close-btn" aria-label="Close">×</button>
        </div>
        <div class="chat-container" role="log" aria-live="polite"></div>
        <div class="input-container">
          <textarea 
            placeholder="Ask anything about this page..." 
            rows="3" 
            aria-label="Message input"
          ></textarea>
          <button class="send-btn" aria-label="Send message">Send</button>
        </div>
        <div class="credits-display">Credits: -- / 25</div>
      `;
    }
    
    async _loadSavedPosition() {
      try {
        const result = await chrome.storage.local.get(['hover_box_position']);
        if (result.hover_box_position) {
          this.position = result.hover_box_position;
          this._applyPosition();
        } else {
          this._setDefaultPosition();
        }
      } catch (error) {
        console.warn('Error loading saved position:', error);
        this._setDefaultPosition();
      }
    }
    
    _setDefaultPosition() {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      this.position = {
        x: Math.max(10, viewportWidth - 400),
        y: 50
      };
      
      this._applyPosition();
    }
    
    _applyPosition() {
      this.box.style.left = `${this.position.x}px`;
      this.box.style.top = `${this.position.y}px`;
    }
    
    _attachEventListeners() {
      // Window events
      window.addEventListener('resize', this._boundResizeHandler);
      window.addEventListener('unload', this._boundUnloadHandler);
      
      // Header drag functionality
      const header = this.box.querySelector('.hover-box-header');
      this._makeDraggable(header);
      
      // Close button
      const closeBtn = this.box.querySelector('.close-btn');
      closeBtn.addEventListener('click', () => this.toggle(false));
      
      // Send button
      const sendBtn = this.box.querySelector('.send-btn');
      sendBtn.addEventListener('click', () => this._sendMessage());
      
      // Textarea
      const textarea = this.box.querySelector('textarea');
      textarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._sendMessage();
        }
      });
      
      // Update credits display
      this._updateCreditsDisplay();
    }
    
    _makeDraggable(headerElement) {
      headerElement.addEventListener('mousedown', (e) => {
        // Skip if clicking buttons
        if (e.target.tagName === 'BUTTON') return;
        
        e.preventDefault();
        
        // Calculate offset
        const rect = this.box.getBoundingClientRect();
        this.dragOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        // Add move and up handlers
        const moveHandler = (e) => {
          e.preventDefault();
          
          // Calculate new position
          this.position = {
            x: e.clientX - this.dragOffset.x,
            y: e.clientY - this.dragOffset.y
          };
          
          // Ensure box stays in viewport
          this._constrainToViewport();
          this._applyPosition();
        };
        
        const upHandler = () => {
          document.removeEventListener('mousemove', moveHandler);
          document.removeEventListener('mouseup', upHandler);
          this._savePosition();
        };
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
      });
    }
    
    _constrainToViewport() {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Get box dimensions
      const boxWidth = this.box.offsetWidth;
      const boxHeight = this.box.offsetHeight;
      
      // Constrain to viewport
      this.position.x = Math.max(0, Math.min(viewportWidth - boxWidth, this.position.x));
      this.position.y = Math.max(0, Math.min(viewportHeight - boxHeight, this.position.y));
    }
    
    _handleResize() {
      this._constrainToViewport();
      this._applyPosition();
    }
    
    async _savePosition() {
      try {
        await chrome.storage.local.set({
          hover_box_position: this.position
        });
      } catch (error) {
        console.warn('Error saving position:', error);
      }
    }
    
    toggle(forceState) {
      // If forceState is defined, use it, otherwise toggle
      const shouldBeVisible = forceState !== undefined ? forceState : !this.isVisible;
      
      if (shouldBeVisible === this.isVisible) return;
      
      if (shouldBeVisible) {
        // Show
        this.box.classList.add('visible');
        this.isVisible = true;
        this._updateCreditsDisplay();
      } else {
        // Hide
        this.box.classList.remove('visible');
        this.isVisible = false;
      }
    }
    
    async _sendMessage() {
      const textarea = this.box.querySelector('textarea');
      const message = textarea.value.trim();
      
      if (!message) return;
      
      try {
        // Add message to chat
        this._addMessage(message, 'user');
        
        // Clear input
        textarea.value = '';
        
        // Disable controls
        const sendBtn = this.box.querySelector('.send-btn');
        textarea.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        
        // Capture context
        const context = await this.contextService.captureContext();
        
        // Send to Claude API
        const response = await this.claudeService.query(message, context);
        
        // Update usage counter
        await this.usageTracker.incrementUsage();
        this._updateCreditsDisplay();
        
        // Add response to chat
        this._addMessage(response.text, 'assistant');
        
      } catch (error) {
        console.error('Error sending message:', error);
        this._addMessage(`Error: ${error.message}`, 'error');
      } finally {
        // Re-enable controls
        const sendBtn = this.box.querySelector('.send-btn');
        const textarea = this.box.querySelector('textarea');
        
        textarea.disabled = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
        
        textarea.focus();
      }
    }
    
    _addMessage(text, type) {
      if (!text) return;
      
      const chatContainer = this.box.querySelector('.chat-container');
      
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${type}`;
      messageDiv.textContent = text;
      
      chatContainer.appendChild(messageDiv);
      
      // Scroll to bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    async _updateCreditsDisplay() {
      try {
        const usageInfo = await this.usageTracker.getUsage();
        const creditsDisplay = this.box.querySelector('.credits-display');
        
        if (creditsDisplay) {
          creditsDisplay.textContent = `Credits: ${25 - usageInfo.usage} / 25`;
          
          // Update styling if low on credits
          if (usageInfo.remaining <= 5) {
            creditsDisplay.style.color = '#ff9800';
          } else if (usageInfo.remaining <= 0) {
            creditsDisplay.style.color = '#f44336';
          } else {
            creditsDisplay.style.color = 'rgba(255, 255, 255, 0.7)';
          }
        }
      } catch (error) {
        console.warn('Error updating credits display:', error);
      }
    }
    
    async cleanup() {
      // Remove event listeners
      window.removeEventListener('resize', this._boundResizeHandler);
      window.removeEventListener('unload', this._boundUnloadHandler);
      
      // Remove DOM elements
      if (this.rootElement) {
        this.rootElement.remove();
        this.rootElement = null;
        this.shadowRoot = null;
        this.box = null;
      }
      
      // Cleanup services if needed
      this.claudeService = null;
      this.contextService = null;
      this.usageTracker = null;
      
      console.log('HoverBox cleanup complete');
    }
  }
  
  window.HoverBox = HoverBox;