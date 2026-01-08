const API_BASE_URL = 'http://localhost:5000';
let retryCount = 0;
const MAX_RETRIES = 3;

const elements = {
    inputText: document.getElementById('inputText'),
    maxLength: document.getElementById('maxLength'),
    minLength: document.getElementById('minLength'),
    summarizeBtn: document.getElementById('summarizeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    copyBtn: document.getElementById('copyBtn'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    errorMessage: document.getElementById('errorMessage'),
    outputSection: document.getElementById('outputSection'),
    summaryText: document.getElementById('summaryText'),
    originalLength: document.getElementById('originalLength'),
    summaryLength: document.getElementById('summaryLength'),
    compressionRate: document.getElementById('compressionRate'),
    charCount: document.getElementById('charCount'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    connectionStatus: document.getElementById('connectionStatus'),
    warningNotification: document.getElementById('warningNotification')
};

// Event Listeners
elements.summarizeBtn.addEventListener('click', handleSummarize);
elements.clearBtn.addEventListener('click', handleClear);
elements.copyBtn.addEventListener('click', handleCopy);

// Allow Enter key with Ctrl to submit
elements.inputText.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        handleSummarize();
    }
});

// Network status listeners
window.addEventListener('online', handleNetworkOnline);
window.addEventListener('offline', handleNetworkOffline);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initEnhancements();
    checkHealth();
});

// Main summarization function
async function handleSummarize() {
    const text = elements.inputText.value.trim();
    
    if (!text) {
        showError('សូមបញ្ចូលអត្ថបទ (Please enter text)');
        elements.inputText.focus();
        return;
    }
    
    if (text.length < 10) {
        showError('អត្ថបទខ្លីពេក (Text is too short)');
        return;
    }
    
    const maxLength = parseInt(elements.maxLength.value);
    const minLength = parseInt(elements.minLength.value);
    
    if (minLength >= maxLength) {
        showError('ប្រវែងអប្បបរមាត្រូវតែតូចជាងប្រវែងអតិបរមា (Min length must be less than max length)');
        return;
    }
    
    if (maxLength > 1000) {
        showError('ប្រវែងអតិបរមាមិនគួរលើសពី ១០០០ (Max length should not exceed 1000)');
        return;
    }
    
    // Show loading
    elements.loadingSpinner.style.display = 'block';
    elements.outputSection.style.display = 'none';
    elements.errorMessage.style.display = 'none';
    elements.summarizeBtn.disabled = true;
    
    // Start progress bar
    startProgressBar();
    
    try {
        const data = await summarizeWithRetry(text, maxLength, minLength);
        displaySummary(data);
        retryCount = 0; // Reset retry count on success
    } catch (error) {
        console.error('Summarization failed:', error);
        showError(`កំហុស: ${error.message}`);
    } finally {
        elements.loadingSpinner.style.display = 'none';
        elements.summarizeBtn.disabled = false;
        stopProgressBar();
    }
}

// Summarize with retry logic
async function summarizeWithRetry(text, maxLength, minLength, currentRetry = 0) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
        
        const response = await fetch(`${API_BASE_URL}/api/summarize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                max_length: maxLength,
                min_length: minLength,
                timestamp: new Date().toISOString()
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('អស់ទាន់ពេលវេលា។ សូមព្យាយាមម្តងទៀត។ (Request timeout)');
        }
        
        if (currentRetry < MAX_RETRIES) {
            console.log(`Retry attempt ${currentRetry + 1}/${MAX_RETRIES}`);
            
            // Show retry notification
            showWarningNotification(`កំពុងព្យាយាមម្តងទៀត... (${currentRetry + 1}/${MAX_RETRIES})`, 2000);
            
            // Exponential backoff
            const delay = Math.pow(2, currentRetry) * 1000; // 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Check API health before retrying
            const isHealthy = await checkHealth();
            if (!isHealthy) {
                throw new Error('មិនអាចភ្ជាប់ទៅ server។ សូមពិនិត្យការតភ្ជាប់។');
            }
            
            return summarizeWithRetry(text, maxLength, minLength, currentRetry + 1);
        }
        
        // Check if it's a connection issue
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
            throw new Error('មិនអាចភ្ជាប់ទៅ server។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធើណេត។');
        }
        
        throw error;
    }
}

// Display summary results
function displaySummary(data) {
    elements.summaryText.textContent = data.summary;
    elements.originalLength.textContent = data.original_length;
    elements.summaryLength.textContent = data.summary_length;
    
    const compressionRate = ((1 - data.summary_length / data.original_length) * 100).toFixed(1);
    elements.compressionRate.textContent = `${compressionRate}%`;
    
    // Add animation class
    elements.outputSection.style.display = 'block';
    elements.outputSection.classList.add('show');
    
    // Scroll to output
    setTimeout(() => {
        elements.outputSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }, 100);
    
    // Show success notification
    showWarningNotification('✅ សង្ខេបអត្ថបទជោគជ័យ! (Summarization successful!)', 3000);
}

// Error handling
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        elements.errorMessage.style.display = 'none';
    }, 10000);
}

// Clear function
function handleClear() {
    elements.inputText.value = '';
    elements.outputSection.style.display = 'none';
    elements.outputSection.classList.remove('show');
    elements.errorMessage.style.display = 'none';
    elements.inputText.focus();
    
    // Reset character count
    if (elements.charCount) {
        elements.charCount.textContent = '0';
        elements.charCount.style.color = '';
    }
    
    // Show notification
    showWarningNotification('បានសម្អាតទាំងអស់ (All cleared)', 2000);
}

// Copy function
async function handleCopy() {
    const summaryText = elements.summaryText.textContent;
    
    if (!summaryText || summaryText.trim() === '') {
        showError('មិនមានអត្ថបទដើម្បីចម្លង (No text to copy)');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(summaryText);
        
        // Visual feedback
        const originalText = elements.copyBtn.innerHTML;
        const originalBackground = elements.copyBtn.style.background;
        const originalColor = elements.copyBtn.style.color;
        
        elements.copyBtn.innerHTML = '✅ ចម្លងរួចរាល់!';
        elements.copyBtn.style.background = '#10b981';
        elements.copyBtn.style.color = 'white';
        
        setTimeout(() => {
            elements.copyBtn.innerHTML = originalText;
            elements.copyBtn.style.background = originalBackground;
            elements.copyBtn.style.color = originalColor;
        }, 2000);
        
        // Show notification
        showWarningNotification('បានចម្លងទៅក្ដារតម្បៀតខ្ទាស់ (Copied to clipboard)', 2000);
    } catch (error) {
        console.error('Copy failed:', error);
        showError('មិនអាចចម្លងបាន (Failed to copy)');
    }
}

// API health check
async function checkHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_BASE_URL}/api/health`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ API Status:', data);
        
        // Update connection status
        updateConnectionStatus(true, 'API ភ្ជាប់បានជោគជ័យ');
        
        // Check model status
        if (!data.model_loaded && data.tokenizer_loaded) {
            console.warn('⚠️ Model weights not loaded, using extractive summarization');
            showWarningNotification('កំពុងប្រើវិធីសង្ខេបធម្មតា (Using basic summarization)', 5000);
        }
        
        return true;
    } catch (error) {
        console.error('❌ API not reachable:', error);
        
        let errorMessage = 'មិនអាចភ្ជាប់ទៅ server';
        if (error.name === 'AbortError') {
            errorMessage = 'សម័ភ័ទាន់ពេលវេលាក្នុងការភ្ជាប់ទៅ API';
        }
        
        updateConnectionStatus(false, errorMessage);
        return false;
    }
}

// Connection status display
function updateConnectionStatus(isConnected, message = '') {
    if (!elements.connectionStatus) return;
    
    if (isConnected) {
        elements.connectionStatus.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message || 'API ភ្ជាប់បានជោគជ័យ'}</span>
        `;
        elements.connectionStatus.className = 'connection-status connected';
    } else {
        elements.connectionStatus.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message || 'មិនអាចភ្ជាប់ទៅ API'}</span>
        `;
        elements.connectionStatus.className = 'connection-status disconnected';
    }
    
    // Auto-hide success status after 5 seconds
    if (isConnected) {
        setTimeout(() => {
            if (elements.connectionStatus.className.includes('connected')) {
                elements.connectionStatus.style.opacity = '0.7';
            }
        }, 5000);
    }
}

// Progress bar functions
function startProgressBar() {
    if (!elements.progressBar || !elements.progressFill) return;
    
    elements.progressBar.style.display = 'block';
    elements.progressFill.style.width = '0%';
    
    // Animate progress (will reach 90% max, completion sets to 100%)
    let progress = 0;
    const interval = setInterval(() => {
        if (!elements.loadingSpinner || elements.loadingSpinner.style.display !== 'block') {
            clearInterval(interval);
            return;
        }
        
        progress += 0.5;
        if (progress > 90) progress = 90;
        elements.progressFill.style.width = `${progress}%`;
    }, 100);
    
    // Store interval ID for cleanup
    elements.progressBar._interval = interval;
}

function stopProgressBar() {
    if (!elements.progressBar || !elements.progressFill) return;
    
    // Complete to 100%
    elements.progressFill.style.width = '100%';
    
    // Clear interval if exists
    if (elements.progressBar._interval) {
        clearInterval(elements.progressBar._interval);
        delete elements.progressBar._interval;
    }
    
    // Hide after delay
    setTimeout(() => {
        elements.progressBar.style.display = 'none';
        elements.progressFill.style.width = '0%';
    }, 500);
}

// Input validation setup
function setupInputValidation() {
    if (!elements.inputText) return;
    
    // Character counter
    elements.inputText.addEventListener('input', function() {
        const length = this.value.length;
        
        if (elements.charCount) {
            elements.charCount.textContent = length;
            
            // Color coding based on length
            if (length === 0) {
                elements.charCount.style.color = '';
            } else if (length < 50) {
                elements.charCount.style.color = '#e74c3c'; // Red
            } else if (length < 100) {
                elements.charCount.style.color = '#f39c12'; // Orange
            } else {
                elements.charCount.style.color = '#27ae60'; // Green
            }
        }
        
        // Auto-expand textarea
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Max length validation
    if (elements.maxLength) {
        elements.maxLength.addEventListener('change', function() {
            let value = parseInt(this.value);
            
            if (isNaN(value) || value < 50) {
                value = 50;
                this.value = value;
            }
            
            if (value > 1000) {
                value = 1000;
                this.value = value;
                showWarningNotification('ប្រវែងអតិបរមាត្រូវមានតិចជាង ១០០០ (Max length should be less than 1000)');
            }
            
            // Ensure min < max
            const minValue = parseInt(elements.minLength.value);
            if (minValue >= value) {
                elements.minLength.value = Math.floor(value * 0.3);
            }
        });
    }
    
    // Min length validation
    if (elements.minLength) {
        elements.minLength.addEventListener('change', function() {
            let value = parseInt(this.value);
            
            if (isNaN(value) || value < 10) {
                value = 10;
                this.value = value;
            }
            
            if (value > 500) {
                value = 500;
                this.value = value;
            }
            
            // Ensure min < max
            const maxValue = parseInt(elements.maxLength.value);
            if (value >= maxValue) {
                this.value = Math.floor(maxValue * 0.3);
            }
        });
    }
}

// Warning notification system
function showWarningNotification(message, duration = 3000) {
    if (!elements.warningNotification) return;
    
    // Create if doesn't exist
    if (!elements.warningNotification) {
        const warningEl = document.createElement('div');
        warningEl.id = 'warningNotification';
        warningEl.className = 'warning-notification';
        document.body.appendChild(warningEl);
        elements.warningNotification = warningEl;
    }
    
    elements.warningNotification.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>${message}</span>
    `;
    elements.warningNotification.style.display = 'flex';
    elements.warningNotification.style.opacity = '1';
    elements.warningNotification.style.alignItems = 'center';
    elements.warningNotification.style.gap = '10px';
    
    // Auto-hide
    setTimeout(() => {
        elements.warningNotification.style.opacity = '0';
        setTimeout(() => {
            elements.warningNotification.style.display = 'none';
        }, 500);
    }, duration);
}

// Network status handlers
function handleNetworkOnline() {
    console.log('Network connection restored');
    showWarningNotification('ការតភ្ជាប់អ៊ីនធើណេតត្រូវបានស្ដារ (Internet connection restored)', 3000);
    
    // Check API health
    setTimeout(() => {
        checkHealth();
    }, 1000);
}

function handleNetworkOffline() {
    console.log('Network connection lost');
    showError('អ្នកបានបញ្ឈប់ការតភ្ជាប់អ៊ីនធើណេត។ សូមពិនិត្យការតភ្ជាប់របស់អ្នក។');
    updateConnectionStatus(false, 'គ្មានការតភ្ជាប់អ៊ីនធើណេត (No internet connection)');
}

// Initialize enhancements
function initEnhancements() {
    setupInputValidation();
    
    // Add CSS styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .connection-status {
            padding: 10px 15px;
            border-radius: 6px;
            margin: 10px 0;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
        }
        .connection-status.connected {
            background: rgba(46, 204, 113, 0.1);
            color: #27ae60;
            border: 1px solid rgba(46, 204, 113, 0.2);
        }
        .connection-status.disconnected {
            background: rgba(231, 76, 60, 0.1);
            color: #c0392b;
            border: 1px solid rgba(231, 76, 60, 0.2);
        }
        .progress-bar {
            height: 4px;
            background: #e0e0e0;
            border-radius: 2px;
            margin: 10px 0 20px;
            overflow: hidden;
            display: none;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4a6bff, #6a8aff);
            width: 0%;
            transition: width 0.3s ease;
        }
        .warning-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff3cd;
            color: #856404;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #ffeaa7;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            max-width: 400px;
            display: none;
            opacity: 0;
            transition: opacity 0.5s ease;
        }
        .char-count {
            font-weight: 600;
            transition: color 0.3s ease;
        }
        .output-section {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .output-section.show {
            opacity: 1;
            transform: translateY(0);
        }
        @media (max-width: 768px) {
            .warning-notification {
                left: 20px;
                right: 20px;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize character count
    if (elements.charCount && elements.inputText) {
        elements.charCount.textContent = elements.inputText.value.length;
    }
}

// Export for module usage (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleSummarize,
        handleClear,
        handleCopy,
        checkHealth
    };
}