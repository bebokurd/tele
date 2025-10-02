/**
 * DoodStream File Uploader - JavaScript Implementation
 * Built by 01 dev for advanced AI coding research
 * 
 * Features:
 * - Local file upload to DoodAPI
 * - Drag & drop support
 * - Progress tracking
 * - Rate limiting compliance
 * - Error handling
 */

class DoodUploader {
    constructor() {
        this.apiKey = '';
        this.selectedFiles = new Map();
        this.uploadQueue = [];
        this.uploadResults = [];
        this.failedUploads = [];
        this.isUploading = false;
        this.rateLimit = 100; // 100ms between requests to stay under 10/second
        this.maxRetries = 3;
        this.maxConcurrentUploads = 2; // Batch processing optimization
        this.uploadQueue = new Map(); // Track upload status
        this.corsProxy = ''; // CORS proxy for browser testing
        this.useCorsProxy = false; // Flag to enable CORS proxy
        this.analytics = {
            totalFiles: 0,
            successCount: 0,
            errorCount: 0,
            retryCount: 0,
            startTime: null,
            endTime: null
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadApiKey();
        this.checkCorsPreference(); // Check if CORS proxy was used before
        this.initializeKeyboardShortcuts();
    }

    initializeElements() {
        this.elements = {
            apiKey: document.getElementById('apiKey'),
            toggleKey: document.getElementById('toggleKey'),
            clearKey: document.getElementById('clearKey'),
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            fileList: document.getElementById('fileList'),
            uploadBtn: document.getElementById('uploadBtn'),
            clearBtn: document.getElementById('clearBtn'),
            statusDisplay: document.getElementById('statusDisplay'),
            resultsList: document.getElementById('resultsList'),
            copyAllLinks: document.getElementById('copyAllLinks'),
            copyAllEmbeds: document.getElementById('copyAllEmbeds'),
            exportResults: document.getElementById('exportResults'),
            retryBtn: document.getElementById('retryBtn'),
            analyticsDisplay: document.getElementById('analyticsDisplay'),
            progressOverlay: document.getElementById('progressOverlay'),
            progressText: document.getElementById('progressText'),
            progressDetail: document.getElementById('progressDetail')
        };
    }

    bindEvents() {
        // API Key management
        this.elements.apiKey.addEventListener('input', (e) => {
            this.apiKey = e.target.value.trim();
            this.saveApiKey();
            this.updateUploadButton();
        });

        this.elements.toggleKey.addEventListener('click', () => {
            const input = this.elements.apiKey;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            this.elements.toggleKey.textContent = isPassword ? '🙈' : '👁️';
        });

        // Clear API key button
        if (this.elements.clearKey) {
            this.elements.clearKey.addEventListener('click', () => {
                const confirmed = confirm('🖾 Clear Saved API Key\n\nThis will remove the saved API key from your browser. You\'ll need to re-enter it next time.\n\nContinue?');
                
                if (confirmed) {
                    this.elements.apiKey.value = '';
                    this.apiKey = '';
                    this.clearSavedApiKey();
                    this.updateUploadButton();
                    this.showToast('🖾 API key cleared successfully', 'success');
                }
            });
        }

        // File selection
        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Drag and drop
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('dragover');
        });

        this.elements.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
            this.handleFileSelection(e.dataTransfer.files);
        });

        // Control buttons
        this.elements.uploadBtn.addEventListener('click', () => {
            this.handleUploadClick();
        });

        this.elements.clearBtn.addEventListener('click', () => {
            this.clearAllFiles();
        });

        // Results management
        this.elements.copyAllLinks.addEventListener('click', () => {
            this.copyAllLinks();
        });

        this.elements.copyAllEmbeds.addEventListener('click', () => {
            this.copyAllEmbeds();
        });

        this.elements.exportResults.addEventListener('click', () => {
            this.exportResults();
        });

        // Retry functionality
        if (this.elements.retryBtn) {
            this.elements.retryBtn.addEventListener('click', () => {
                this.retryFailedUploads();
            });
        }

        // CORS fix button
        const corsBtn = document.getElementById('corsBtn');
        if (corsBtn) {
            corsBtn.addEventListener('click', () => {
                this.enableCorsProxy();
            });
        }
        
        // Add test button for CORS (development only)
        const testBtn = document.createElement('button');
        testBtn.innerHTML = '🧪 Test API';
        testBtn.className = 'test-btn';
        testBtn.style.cssText = 'margin-left: 10px; padding: 8px 12px; background: #fbbf24; border: none; border-radius: 6px; cursor: pointer;';
        testBtn.addEventListener('click', () => {
            this.testApiConnection();
        });
        
        // Add test button next to CORS button
        if (corsBtn && corsBtn.parentNode) {
            corsBtn.parentNode.appendChild(testBtn);
        }

        // File validation on selection
        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });
    }

    loadApiKey() {
        try {
            const savedKey = localStorage.getItem('doodapi_key');
            const keyTimestamp = localStorage.getItem('doodapi_key_timestamp');
            
            if (savedKey && keyTimestamp) {
                // Check if key is older than 30 days (optional security measure)
                const keyAge = Date.now() - parseInt(keyTimestamp);
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                
                if (keyAge > thirtyDays) {
                    this.showToast('🔐 Saved API key expired (30+ days old). Please re-enter.', 'warning');
                    this.clearSavedApiKey();
                    return;
                }
                
                this.elements.apiKey.value = savedKey;
                this.apiKey = savedKey;
                this.updateStatus('🔑 API key loaded from secure storage', 'success');
                this.showToast('🔑 API key loaded successfully', 'success');
            } else {
                this.updateStatus('💾 No saved API key found - enter your key above', 'info');
            }
        } catch (error) {
            console.error('Error loading API key:', error);
            this.updateStatus('⚠️ Error loading saved API key', 'error');
        }
        
        this.updateUploadButton();
    }

    saveApiKey() {
        try {
            if (this.apiKey && this.apiKey.length > 0) {
                // Validate API key format
                if (this.validateApiKeyFormat(this.apiKey)) {
                    localStorage.setItem('doodapi_key', this.apiKey);
                    localStorage.setItem('doodapi_key_timestamp', Date.now().toString());
                    
                    // Save key metadata for research analytics
                    const keyMetadata = {
                        savedBy: '01 dev',
                        savedAt: new Date().toISOString(),
                        keyLength: this.apiKey.length,
                        browserInfo: navigator.userAgent.substring(0, 50)
                    };
                    localStorage.setItem('doodapi_metadata', JSON.stringify(keyMetadata));
                    
                    this.updateStatus('💾 API key saved securely to browser storage', 'success');
                    this.showToast('💾 API key saved successfully!', 'success');
                    
                    // Update UI to show saved state
                    this.elements.apiKey.classList.add('saved');
                    setTimeout(() => {
                        this.elements.apiKey.classList.remove('saved');
                    }, 2000);
                } else {
                    this.updateStatus('⚠️ Invalid API key format - not saved', 'error');
                    this.showToast('⚠️ Invalid API key format', 'error');
                }
            } else {
                // Clear saved key if input is empty
                this.clearSavedApiKey();
                this.updateStatus('🖾 API key cleared from storage', 'info');
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            this.updateStatus('❌ Failed to save API key', 'error');
            this.showToast('❌ Failed to save API key', 'error');
        }
    }

    handleFileSelection(files) {
        const validFiles = this.validateFiles(files);
        
        validFiles.forEach(file => {
            if (!this.selectedFiles.has(file.name)) {
                this.selectedFiles.set(file.name, file);
                this.addFileToList(file);
            }
        });
        
        this.updateUploadButton();
        this.elements.fileInput.value = ''; // Reset input
        this.updateAnalytics();
    }

    addFileToList(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span>📄</span>
                <span>${file.name}</span>
                <span class="file-size">(${this.formatFileSize(file.size)})</span>
            </div>
            <button class="remove-file" onclick="uploader.removeFile('${file.name}')">✖️</button>
        `;
        this.elements.fileList.appendChild(fileItem);
    }

    removeFile(fileName) {
        this.selectedFiles.delete(fileName);
        this.updateFileList();
        this.updateUploadButton();
    }

    clearAllFiles() {
        this.selectedFiles.clear();
        this.uploadResults = [];
        this.updateFileList();
        this.updateUploadButton();
        this.updateStatus('Ready to upload files...');
        this.elements.resultsList.innerHTML = '';
    }

    updateFileList() {
        this.elements.fileList.innerHTML = '';
        this.selectedFiles.forEach(file => {
            this.addFileToList(file);
        });
    }

    updateUploadButton() {
        const hasFiles = this.selectedFiles.size > 0;
        const hasApiKey = this.apiKey.length > 0;
        const canUpload = hasFiles && hasApiKey && !this.isUploading;
        
        // Ensure button exists
        if (!this.elements.uploadBtn) {
            console.warn('Upload button element not found');
            return;
        }
        
        this.elements.uploadBtn.disabled = !canUpload;
        
        // Reset all CSS classes first
        this.elements.uploadBtn.classList.remove('uploading', 'warning', 'ready', 'starting');
        
        // Dynamic button text and styling
        if (this.isUploading) {
            this.elements.uploadBtn.innerHTML = '⏳ Uploading... <span class="upload-counter">' + 
                this.analytics.successCount + '/' + this.analytics.totalFiles + '</span>';
            this.elements.uploadBtn.classList.add('uploading');
        } else if (!hasApiKey) {
            this.elements.uploadBtn.innerHTML = '🔑 Enter API Key First';
            this.elements.uploadBtn.classList.add('warning');
        } else if (!hasFiles) {
            this.elements.uploadBtn.innerHTML = '📁 Select Files to Upload';
        } else {
            this.elements.uploadBtn.innerHTML = `🚀 Upload ${this.selectedFiles.size} File${this.selectedFiles.size > 1 ? 's' : ''}`;
            this.elements.uploadBtn.classList.add('ready');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateStatus(message, type = 'info') {
        const statusHtml = `
            <div class="status-message ${type}">
                <strong>${new Date().toLocaleTimeString()}</strong>: ${message}
            </div>
        `;
        this.elements.statusDisplay.innerHTML = statusHtml + this.elements.statusDisplay.innerHTML;
    }

    async startUpload() {
        if (this.isUploading) return;
        
        this.isUploading = true;
        this.analytics.startTime = new Date();
        this.analytics.totalFiles = this.selectedFiles.size;
        this.failedUploads = [];
        this.updateUploadButton();
        this.showProgressOverlay();
        
        try {
            this.updateProgressText('Initializing upload...', 'Validating connection and API key');
            
            // Validate network connection first
            if (!navigator.onLine) {
                throw new Error('No internet connection detected');
            }
            
            // Test API key validity by getting upload server
            this.updateProgressText('Validating API credentials...', 'Testing API key with DoodStream');
            const serverInfo = await this.getUploadServerWithRetry();
            if (!serverInfo) {
                throw new Error('Failed to get upload server after retries - Check API key and connection');
            }
            
            // Upload files with enhanced batch processing
            const fileEntries = Array.from(this.selectedFiles.entries());
            let completedFiles = 0;
            
            // Process files in batches for better performance and reliability
            for (let i = 0; i < fileEntries.length; i += this.maxConcurrentUploads) {
                const batch = fileEntries.slice(i, i + this.maxConcurrentUploads);
                
                this.updateProgressText(
                    `Processing batch ${Math.ceil((i + 1) / this.maxConcurrentUploads)}/${Math.ceil(fileEntries.length / this.maxConcurrentUploads)}`,
                    `Uploading ${batch.length} files...`
                );
                
                // Upload files in current batch with individual error handling
                const batchPromises = batch.map(async ([fileName, file]) => {
                    try {
                        await this.uploadFileWithRetry(file, serverInfo, fileName);
                        completedFiles++;
                    } catch (error) {
                        // Individual file errors are already handled in uploadFileWithRetry
                        console.warn(`Batch upload error for ${fileName}:`, error.message);
                    }
                });
                
                // Wait for current batch to complete
                await Promise.allSettled(batchPromises); // Use allSettled instead of all to handle individual failures
                
                // Update progress
                this.updateProgressText(
                    `Completed ${completedFiles}/${this.analytics.totalFiles} files`,
                    `${this.analytics.successCount} successful, ${this.analytics.errorCount} failed`
                );
                
                // Rate limiting delay between batches (not after the last batch)
                if (i + this.maxConcurrentUploads < fileEntries.length) {
                    const delayTime = this.rateLimit * this.maxConcurrentUploads;
                    this.updateStatus(`⏳ Rate limiting delay: ${delayTime}ms`, 'info');
                    await this.delay(delayTime);
                }
            }
            
            this.analytics.endTime = new Date();
            const duration = (this.analytics.endTime - this.analytics.startTime) / 1000;
            
            this.updateProgressText('Upload Complete!', `${this.analytics.successCount} files uploaded successfully`);
            await this.delay(1500); // Show completion message
            
            this.updateStatus(`🎉 Upload complete! Success: ${this.analytics.successCount}, Errors: ${this.analytics.errorCount}, Duration: ${duration.toFixed(1)}s`, 'info');
            this.updateAnalyticsDisplay();
            
            if (this.failedUploads.length > 0) {
                this.showRetryOption();
            }
            
        } catch (error) {
            this.updateStatus(`❌ Upload process failed: ${error.message}`, 'error');
        } finally {
            this.isUploading = false;
            this.hideProgressOverlay();
            this.updateUploadButton();
            
            // Reset button to initial state after upload completion
            setTimeout(() => {
                this.updateUploadButton();
            }, 500);
        }
    }

    async getUploadServer() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            this.updateStatus('🔍 Requesting upload server from DoodAPI...', 'info');
            
            let response;
            
            // Always try CORS proxy first if we've already detected CORS issues
            if (this.useCorsProxy) {
                this.updateStatus('🔄 Using CORS proxy for request...', 'info');
                const proxyUrl = `${this.corsProxy}https://doodapi.co/api/upload/server?key=${this.apiKey}`;
                
                response = await fetch(proxyUrl, {
                    method: 'GET',
                    mode: 'cors',
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
            } else {
                // Try direct API call first
                try {
                    const apiUrl = `https://doodapi.co/api/upload/server?key=${this.apiKey}`;
                    
                    response = await fetch(apiUrl, {
                        method: 'GET',
                        mode: 'cors',
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'DoodStream-Uploader-01dev/1.0',
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    });
                } catch (corsError) {
                    // Auto-enable CORS proxy on any fetch failure
                    this.updateStatus('⚠️ Direct API failed, switching to CORS proxy...', 'warning');
                    this.corsProxy = 'https://api.allorigins.win/raw?url=';
                    this.useCorsProxy = true;
                    
                    const proxyUrl = `${this.corsProxy}https://doodapi.co/api/upload/server?key=${this.apiKey}`;
                    response = await fetch(proxyUrl, {
                        method: 'GET',
                        mode: 'cors',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                }
            }
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                let errorMessage = `Failed to get upload server (${response.status})`;
                
                switch (response.status) {
                    case 0:
                        errorMessage = 'Network error - Check internet connection or try disabling ad blockers';
                        break;
                    case 401:
                        errorMessage = 'Invalid API key - Please check your credentials';
                        break;
                    case 403:
                        errorMessage = 'API access forbidden - Check account status';
                        break;
                    case 429:
                        errorMessage = 'Rate limit exceeded - Please wait before retrying';
                        break;
                    case 500:
                        errorMessage = 'DoodAPI server error - Please try again later';
                        break;
                }
                
                throw new Error(errorMessage);
            }
            
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                // Handle cases where response isn't JSON (CORS issues)
                throw new Error('Unable to parse server response - Possible CORS restriction');
            }
            
            if (data.status === 200 && data.result) {
                this.updateStatus(`✅ Upload server obtained: ${data.result}`, 'success');
                return data.result;
            } else {
                throw new Error(data.msg || `API returned status: ${data.status}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Upload server request timeout - Please check your connection');
            }
            
            // Enhanced error detection and solutions
            let enhancedMessage = error.message;
            
            if (error.message === 'Failed to fetch' || error.message.includes('NetworkError') || error.message.includes('fetch')) {
                enhancedMessage = 'Failed to fetch';
            }
            
            console.error('Error getting upload server:', {
                error: enhancedMessage,
                originalError: error.message,
                timestamp: new Date().toISOString(),
                apiKeyLength: this.apiKey?.length || 0,
                corsProxyEnabled: this.useCorsProxy,
                userAgent: navigator.userAgent
            });
            
            throw new Error(enhancedMessage);
        }
    }

    async uploadFile(file, uploadServer) {
        // Enhanced upload with better error handling and progress tracking
        const formData = new FormData();
        formData.append('api_key', this.apiKey);
        formData.append('file', file);

        const uploadUrl = `${uploadServer}?${this.apiKey}`;

        try {
            // Add timeout and abort controller for better control
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
            
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
                headers: {
                    'User-Agent': 'DoodStream-Uploader-01dev/1.0'
                }
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                // Enhanced error handling with specific HTTP status codes
                let errorMessage = `HTTP error! status: ${response.status}`;
                
                switch (response.status) {
                    case 400:
                        errorMessage = 'Bad request - Invalid file or API key';
                        break;
                    case 401:
                        errorMessage = 'Unauthorized - Invalid or expired API key';
                        break;
                    case 403:
                        errorMessage = 'Forbidden - Access denied or quota exceeded';
                        break;
                    case 413:
                        errorMessage = 'File too large for upload';
                        break;
                    case 429:
                        errorMessage = 'Rate limit exceeded - Please wait before retrying';
                        break;
                    case 500:
                        errorMessage = 'Server error - Please try again later';
                        break;
                    case 503:
                        errorMessage = 'Service unavailable - Server temporarily down';
                        break;
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            // Validate response structure
            if (!result || typeof result.status === 'undefined') {
                throw new Error('Invalid response format from server');
            }
            
            return result;
        } catch (error) {
            // Enhanced error logging with context
            console.error('Upload error details:', {
                fileName: file.name,
                fileSize: file.size,
                uploadUrl: uploadUrl.replace(this.apiKey, '***'),
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            // Re-throw with enhanced error message
            if (error.name === 'AbortError') {
                throw new Error('Upload timeout - File may be too large or connection too slow');
            }
            
            throw error;
        }
    }

    addUploadResult(result, success) {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${success ? 'success' : 'error'}`;
        
        if (success) {
            const embedCode = this.generateEmbedCode(result);
            const iframeCode = this.generateIframeCode(result);
            
            resultItem.innerHTML = `
                <h4>✅ ${result.title}</h4>
                <div class="result-details">
                    <p><strong>File Code:</strong> ${result.filecode}</p>
                    <p><strong>Size:</strong> ${this.formatFileSize(result.size)}</p>
                    <p><strong>Length:</strong> ${result.length} seconds</p>
                    <p><strong>Uploaded:</strong> ${result.uploaded}</p>
                </div>
                
                <div class="result-links">
                    <a href="${result.download_url}" target="_blank">📥 Download</a>
                    <a href="${result.protected_embed}" target="_blank">🎬 Embed</a>
                    <a href="${result.protected_dl}" target="_blank">🔒 Protected DL</a>
                    <a href="${result.single_img}" target="_blank">🖼️ Thumbnail</a>
                    <a href="${result.splash_img}" target="_blank">🎨 Splash</a>
                </div>
                
                <div class="quick-actions">
                    <button class="quick-action" onclick="uploader.copyToClipboard('${result.download_url}')">Copy Download Link</button>
                    <button class="quick-action" onclick="uploader.copyToClipboard('${result.protected_embed}')">Copy Embed Link</button>
                    <button class="quick-action" onclick="uploader.copyToClipboard('${result.filecode}')">Copy File Code</button>
                </div>
                
                <div class="embed-section">
                    <h5>📝 Embed Codes</h5>
                    
                    <strong>HTML Embed:</strong>
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="uploader.copyToClipboard(\`${embedCode}\`)">Copy</button>${embedCode}</div>
                    
                    <strong>iframe Embed:</strong>
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="uploader.copyToClipboard(\`${iframeCode}\`)">Copy</button>${iframeCode}</div>
                    
                    <strong>Discord Embed (for bots):</strong>
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="uploader.copyDiscordEmbed('${result.title}', '${result.download_url}', '${result.single_img}')">Copy</button>{
  "title": "${result.title}",
  "url": "${result.download_url}",
  "thumbnail": {
    "url": "${result.single_img}"
  },
  "fields": [
    {
      "name": "File Size",
      "value": "${this.formatFileSize(result.size)}",
      "inline": true
    },
    {
      "name": "Duration",
      "value": "${result.length}s",
      "inline": true
    }
  ]
}</div>
                </div>
            `;
        } else {
            resultItem.innerHTML = `
                <h4>❌ ${result.title}</h4>
                <p><strong>Error:</strong> ${result.error}</p>
            `;
        }
        
        this.elements.resultsList.appendChild(resultItem);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate HTML embed code
    generateEmbedCode(result) {
        return `<iframe width="560" height="315" src="${result.protected_embed}" frameborder="0" allowfullscreen></iframe>`;
    }

    // Generate iframe embed code
    generateIframeCode(result) {
        return `<iframe src="${result.protected_embed}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>`;
    }

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('📋 Copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showToast('❌ Failed to copy to clipboard', 'error');
        }
    }

    // Copy Discord embed format
    async copyDiscordEmbed(title, url, thumbnail) {
        const discordEmbed = {
            title: title,
            url: url,
            thumbnail: {
                url: thumbnail
            },
            color: 0x667eea,
            timestamp: new Date().toISOString(),
            footer: {
                text: "DoodStream Upload - 01 dev"
            }
        };
        
        await this.copyToClipboard(JSON.stringify(discordEmbed, null, 2));
    }

    // Copy all download links
    async copyAllLinks() {
        if (this.uploadResults.length === 0) {
            this.updateStatus('⚠️ No upload results to copy', 'error');
            return;
        }
        
        const links = this.uploadResults.map(result => {
            return `${result.title}: ${result.download_url}`;
        }).join('\n');
        
        await this.copyToClipboard(links);
        this.updateStatus(`📋 Copied ${this.uploadResults.length} download links!`, 'success');
    }

    // Copy all embed links
    async copyAllEmbeds() {
        if (this.uploadResults.length === 0) {
            this.updateStatus('⚠️ No upload results to copy', 'error');
            return;
        }
        
        const embeds = this.uploadResults.map(result => {
            return `${result.title}: ${result.protected_embed}`;
        }).join('\n');
        
        await this.copyToClipboard(embeds);
        this.updateStatus(`📋 Copied ${this.uploadResults.length} embed links!`, 'success');
    }

    // Export results as JSON
    async exportResults() {
        if (this.uploadResults.length === 0) {
            this.updateStatus('⚠️ No upload results to export', 'error');
            return;
        }
        
        const exportData = {
            exported_by: "01 dev",
            export_date: new Date().toISOString(),
            total_files: this.uploadResults.length,
            results: this.uploadResults.map(result => ({
                title: result.title,
                filecode: result.filecode,
                download_url: result.download_url,
                embed_url: result.protected_embed,
                protected_dl: result.protected_dl,
                thumbnail: result.single_img,
                splash: result.splash_img,
                size: result.size,
                length: result.length,
                uploaded: result.uploaded,
                embed_codes: {
                    html: this.generateEmbedCode(result),
                    iframe: this.generateIframeCode(result)
                }
            }))
        };
        
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `doodstream-exports-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateStatus(`📄 Exported ${this.uploadResults.length} results to JSON file!`, 'success');
    }

    // File validation system
    validateFiles(files) {
        const validFiles = [];
        const maxSize = 500 * 1024 * 1024; // 500MB
        const allowedTypes = ['video/', 'audio/', 'image/', 'application/zip', 'application/rar'];
        
        Array.from(files).forEach(file => {
            let isValid = true;
            let reason = '';
            
            // Size validation
            if (file.size > maxSize) {
                isValid = false;
                reason = `File too large (${this.formatFileSize(file.size)}). Max: 500MB`;
            }
            
            // Type validation
            const isAllowedType = allowedTypes.some(type => file.type.startsWith(type));
            if (!isAllowedType) {
                isValid = false;
                reason = `File type not supported: ${file.type}`;
            }
            
            if (isValid) {
                validFiles.push(file);
            } else {
                this.updateStatus(`⚠️ ${file.name}: ${reason}`, 'error');
            }
        });
        
        return validFiles;
    }

    // Enhanced upload server with retry and CORS handling
    async getUploadServerWithRetry(retries = this.maxRetries) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Add connection diagnostic on first attempt
                if (attempt === 1) {
                    await this.performConnectionDiagnostic();
                }
                
                const server = await this.getUploadServer();
                if (server) return server;
            } catch (error) {
                lastError = error;
                this.updateStatus(`⚠️ Server request attempt ${attempt}/${retries} failed: ${error.message}`, 'error');
                
                // Auto-enable CORS proxy if we detect "Failed to fetch" error
                if (error.message === 'Failed to fetch' && !this.useCorsProxy) {
                    this.updateStatus('🔄 Auto-enabling CORS proxy due to fetch error...', 'warning');
                    this.enableCorsProxy();
                    
                    // Try again immediately with CORS proxy (don't count as retry)
                    try {
                        this.updateStatus('🔄 Retrying with CORS proxy...', 'info');
                        const serverWithProxy = await this.getUploadServer();
                        if (serverWithProxy) return serverWithProxy;
                    } catch (proxyError) {
                        this.updateStatus(`⚠️ CORS proxy also failed: ${proxyError.message}`, 'error');
                        lastError = proxyError;
                    }
                }
                
                if (attempt < retries) {
                    const delayTime = Math.min(2000 * attempt, 8000); // Progressive delay: 2s, 4s, 6s
                    this.updateStatus(`⏳ Waiting ${delayTime/1000}s before retry...`, 'info');
                    await this.delay(delayTime);
                }
            }
        }
        
        // After all retries failed, provide comprehensive error information
        const detailedError = this.generateDetailedErrorReport(lastError);
        throw new Error(detailedError);
    }

    // Upload file with enhanced retry logic
    async uploadFileWithRetry(file, serverInfo, fileName, retries = this.maxRetries) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.updateStatus(`📤 Uploading: ${fileName} (attempt ${attempt}/${retries})...`, 'info');
                
                // Update button with current file progress
                this.updateUploadButtonProgress(fileName, attempt, retries);
                
                // Add delay before retry attempts (not on first attempt)
                if (attempt > 1) {
                    const delayTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
                    this.updateStatus(`⏳ Waiting ${delayTime/1000}s before retry...`, 'info');
                    await this.delay(delayTime);
                }
                
                const result = await this.uploadFile(file, serverInfo);
                
                if (result && result.status === 200) {
                    this.addUploadResult(result.result[0], true);
                    this.uploadResults.push(result.result[0]);
                    this.analytics.successCount++;
                    this.updateStatus(`✅ ${fileName} uploaded successfully!`, 'success');
                    
                    // Update button success state
                    this.updateUploadButton();
                    return; // Success - exit retry loop
                } else if (result && result.status === 429) {
                    // Rate limit - wait longer
                    throw new Error('Rate limit exceeded - waiting longer before retry');
                } else {
                    throw new Error(result?.msg || `Upload failed with status: ${result?.status || 'unknown'}`);
                }
            } catch (error) {
                lastError = error;
                this.analytics.retryCount++;
                
                // Check if this is a non-retryable error
                if (error.message.includes('Unauthorized') || 
                    error.message.includes('Forbidden') || 
                    error.message.includes('Bad request')) {
                    // Don't retry auth/permission errors
                    this.analytics.errorCount++;
                    this.failedUploads.push({ file, fileName, error: error.message, nonRetryable: true });
                    this.updateStatus(`❌ ${fileName} failed: ${error.message} (non-retryable)`, 'error');
                    this.addUploadResult({ title: fileName, error: error.message }, false);
                    return;
                }
                
                if (attempt < retries) {
                    this.updateStatus(`⚠️ Upload attempt ${attempt}/${retries} failed for ${fileName}: ${error.message}`, 'error');
                } else {
                    // Final failure after all retries
                    this.analytics.errorCount++;
                    this.failedUploads.push({ file, fileName, error: error.message });
                    this.updateStatus(`❌ Failed to upload ${fileName} after ${retries} attempts: ${error.message}`, 'error');
                    this.addUploadResult({ title: fileName, error: error.message }, false);
                }
            }
        }
    }

    // Retry failed uploads
    async retryFailedUploads() {
        if (this.failedUploads.length === 0) {
            this.showToast('No failed uploads to retry', 'info');
            return;
        }
        
        const failedCopy = [...this.failedUploads];
        this.failedUploads = [];
        
        this.updateStatus(`🔁 Retrying ${failedCopy.length} failed uploads...`, 'info');
        
        try {
            const serverInfo = await this.getUploadServerWithRetry();
            if (!serverInfo) {
                throw new Error('Failed to get upload server for retry');
            }
            
            for (const { file, fileName } of failedCopy) {
                await this.uploadFileWithRetry(file, serverInfo, fileName);
                await this.delay(this.rateLimit);
            }
            
            this.updateStatus(`🎉 Retry complete! Check results above.`, 'success');
            
        } catch (error) {
            this.updateStatus(`❌ Retry process failed: ${error.message}`, 'error');
        }
    }

    // Show retry option
    showRetryOption() {
        if (this.elements.retryBtn) {
            this.elements.retryBtn.style.display = 'block';
            this.elements.retryBtn.textContent = `🔁 Retry ${this.failedUploads.length} Failed Uploads`;
        }
    }

    // Update analytics display
    updateAnalytics() {
        this.analytics.totalFiles = this.selectedFiles.size;
    }
    
    updateAnalyticsDisplay() {
        if (this.elements.analyticsDisplay) {
            const duration = this.analytics.endTime && this.analytics.startTime 
                ? (this.analytics.endTime - this.analytics.startTime) / 1000 
                : 0;
            
            this.elements.analyticsDisplay.innerHTML = `
                <div class="analytics-grid">
                    <div class="metric">
                        <span class="metric-value">${this.analytics.totalFiles}</span>
                        <span class="metric-label">Total Files</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${this.analytics.successCount}</span>
                        <span class="metric-label">Successful</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${this.analytics.errorCount}</span>
                        <span class="metric-label">Failed</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${this.analytics.retryCount}</span>
                        <span class="metric-label">Retries</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${duration.toFixed(1)}s</span>
                        <span class="metric-label">Duration</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${(this.analytics.successCount / Math.max(this.analytics.totalFiles, 1) * 100).toFixed(1)}%</span>
                        <span class="metric-label">Success Rate</span>
                    </div>
                </div>
            `;
        }
    }

    // Keyboard shortcuts
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + U: Upload
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                if (!this.isUploading && this.selectedFiles.size > 0 && this.apiKey) {
                    this.handleUploadClick(); // Use the enhanced handler
                }
            }
            
            // Ctrl/Cmd + D: Clear
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.clearAllFiles();
            }
            
            // Ctrl/Cmd + A: Select files (when in upload area)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.target.closest('.upload-area')) {
                e.preventDefault();
                this.elements.fileInput.click();
            }
            
            // Escape: Cancel upload
            if (e.key === 'Escape' && this.isUploading) {
                this.cancelUpload();
            }
        });
    }
    
    // Cancel upload
    cancelUpload() {
        this.isUploading = false;
        this.hideProgressOverlay();
        this.updateUploadButton();
        this.updateStatus('❌ Upload cancelled by user', 'error');
    }

    // Progress overlay methods
    showProgressOverlay() {
        if (this.elements.progressOverlay) {
            this.elements.progressOverlay.classList.add('active');
            this.elements.uploadArea.classList.add('processing');
        }
    }
    
    hideProgressOverlay() {
        if (this.elements.progressOverlay) {
            this.elements.progressOverlay.classList.remove('active');
            this.elements.uploadArea.classList.remove('processing');
        }
    }
    
    updateProgressText(main, detail) {
        if (this.elements.progressText) {
            this.elements.progressText.textContent = main;
        }
        if (this.elements.progressDetail) {
            this.elements.progressDetail.textContent = detail;
        }
    }

    // Enhanced upload button handler
    handleUploadClick() {
        // Validation checks
        if (this.isUploading) {
            this.showConfirmationDialog(
                '⚠️ Upload in Progress',
                'An upload is already in progress. Do you want to cancel it?',
                () => this.cancelUpload()
            );
            return;
        }
        
        if (!this.apiKey) {
            this.showToast('🔑 Please enter your API key first', 'error');
            this.elements.apiKey.focus();
            this.elements.apiKey.classList.add('highlight-error');
            setTimeout(() => this.elements.apiKey.classList.remove('highlight-error'), 2000);
            return;
        }
        
        if (this.selectedFiles.size === 0) {
            this.showToast('📁 Please select files to upload first', 'error');
            this.elements.fileInput.click();
            return;
        }
        
        // Pre-upload validation
        const totalSize = Array.from(this.selectedFiles.values())
            .reduce((sum, file) => sum + file.size, 0);
        const estimatedTime = Math.ceil(totalSize / (1024 * 1024)) * 2; // Rough estimate
        
        // Show confirmation for large uploads
        if (this.selectedFiles.size > 5 || totalSize > 100 * 1024 * 1024) {
            const message = `Upload ${this.selectedFiles.size} files (${this.formatFileSize(totalSize)})?\n` +
                          `Estimated time: ~${estimatedTime} seconds\n\n` +
                          'This will use your API quota. Continue?';
            
            this.showConfirmationDialog(
                '🚀 Confirm Upload',
                message,
                () => this.startUploadWithPreparation()
            );
        } else {
            // Direct upload for small batches
            this.startUploadWithPreparation();
        }
    }
    
    // Upload with preparation and validation
    async startUploadWithPreparation() {
        try {
            // Final validation before upload
            const validFiles = this.validateFiles(Array.from(this.selectedFiles.values()));
            
            if (validFiles.length !== this.selectedFiles.size) {
                const invalidCount = this.selectedFiles.size - validFiles.length;
                const proceed = await this.showConfirmationDialog(
                    '⚠️ Some Files Invalid',
                    `${invalidCount} files failed validation. Upload ${validFiles.length} valid files?`,
                    null, true
                );
                
                if (!proceed) {
                    this.updateStatus('❌ Upload cancelled - validation failed', 'error');
                    return;
                }
                
                // Update selected files to only valid ones
                this.selectedFiles.clear();
                validFiles.forEach(file => this.selectedFiles.set(file.name, file));
                this.updateFileList();
                this.updateUploadButton();
            }
            
            // Ensure we still have files after validation
            if (this.selectedFiles.size === 0) {
                this.showToast('❌ No valid files to upload', 'error');
                return;
            }
            
            // Add upload start animation
            this.elements.uploadBtn.classList.add('starting');
            await this.delay(300);
            this.elements.uploadBtn.classList.remove('starting');
            
            // Start the upload
            await this.startUpload();
            
        } catch (error) {
            this.updateStatus(`❌ Upload preparation failed: ${error.message}`, 'error');
            this.showToast(`❌ Preparation failed: ${error.message}`, 'error');
        }
    }
    
    // Show confirmation dialog
    showConfirmationDialog(title, message, onConfirm, returnPromise = false) {
        const confirmed = confirm(`${title}\n\n${message}`);
        
        if (returnPromise) {
            return Promise.resolve(confirmed);
        }
        
        if (confirmed && onConfirm) {
            onConfirm();
        }
    }
    
    // Update button with upload progress
    updateUploadButtonProgress(fileName, attempt, maxAttempts) {
        if (!this.elements.uploadBtn) {
            console.warn('Upload button element not found for progress update');
            return;
        }
        
        try {
            const shortName = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
            let progressText = `📤 ${shortName}`;
            
            if (attempt > 1) {
                progressText += ` (retry ${attempt}/${maxAttempts})`;
            }
            
            this.elements.uploadBtn.innerHTML = progressText + 
                ` <span class="upload-counter">${this.analytics.successCount}/${this.analytics.totalFiles}</span>`;
        } catch (error) {
            console.error('Error updating button progress:', error);
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // Validate API key format
    validateApiKeyFormat(key) {
        // DoodAPI keys are typically alphanumeric, 12+ characters
        const keyPattern = /^[a-zA-Z0-9]{12,}$/;
        return keyPattern.test(key);
    }
    
    // Clear saved API key and metadata
    clearSavedApiKey() {
        try {
            localStorage.removeItem('doodapi_key');
            localStorage.removeItem('doodapi_key_timestamp');
            localStorage.removeItem('doodapi_metadata');
            this.updateStatus('🖾 Cleared all saved API key data', 'info');
        } catch (error) {
            console.error('Error clearing API key:', error);
        }
    }
    
    // Get API key metadata for research
    getApiKeyMetadata() {
        try {
            const metadata = localStorage.getItem('doodapi_metadata');
            return metadata ? JSON.parse(metadata) : null;
        } catch (error) {
            console.error('Error getting API key metadata:', error);
            return null;
        }
    }
    
    // Connection diagnostic for troubleshooting
    async performConnectionDiagnostic() {
        try {
            this.updateStatus('🔍 Running connection diagnostic...', 'info');
            
            // Test basic internet connectivity
            const connectivityTest = await Promise.race([
                fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-cache' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
            
            this.updateStatus('✅ Internet connection: OK', 'success');
            
            // Test DNS resolution for DoodAPI
            try {
                await fetch('https://doodapi.co/favicon.ico', { mode: 'no-cors', cache: 'no-cache' });
                this.updateStatus('✅ DoodAPI server reachable', 'success');
            } catch (dnsError) {
                this.updateStatus('⚠️ DoodAPI server may be unreachable', 'warning');
            }
            
        } catch (error) {
            this.updateStatus('❌ Connection diagnostic failed - Check internet connection', 'error');
        }
    }
    
    // Generate detailed error report for debugging
    // Test API connection
    async testApiConnection() {
        if (!this.apiKey) {
            this.showToast('🔑 Please enter API key first', 'error');
            return;
        }
        
        this.updateStatus('🧪 Testing API connection...', 'info');
        
        try {
            // Test both direct and proxy methods
            const results = {
                direct: null,
                proxy: null
            };
            
            // Test direct connection
            try {
                this.updateStatus('🔍 Testing direct API connection...', 'info');
                const directUrl = `https://doodapi.co/api/upload/server?key=${this.apiKey}`;
                
                const directResponse = await fetch(directUrl, {
                    method: 'GET',
                    mode: 'cors',
                    signal: AbortSignal.timeout(10000),
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (directResponse.ok) {
                    results.direct = 'SUCCESS';
                    this.updateStatus('✅ Direct API connection works!', 'success');
                } else {
                    results.direct = `HTTP ${directResponse.status}`;
                }
            } catch (directError) {
                results.direct = directError.message;
                this.updateStatus('❌ Direct API failed: ' + directError.message, 'error');
            }
            
            // Test proxy connection
            try {
                this.updateStatus('🌐 Testing CORS proxy connection...', 'info');
                const proxyUrl = `https://api.allorigins.win/raw?url=https://doodapi.co/api/upload/server?key=${this.apiKey}`;
                
                const proxyResponse = await fetch(proxyUrl, {
                    method: 'GET',
                    mode: 'cors',
                    signal: AbortSignal.timeout(10000),
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (proxyResponse.ok) {
                    results.proxy = 'SUCCESS';
                    this.updateStatus('✅ CORS proxy connection works!', 'success');
                } else {
                    results.proxy = `HTTP ${proxyResponse.status}`;
                }
            } catch (proxyError) {
                results.proxy = proxyError.message;
                this.updateStatus('❌ CORS proxy failed: ' + proxyError.message, 'error');
            }
            
            // Summary
            const summary = `API Test Results:\n- Direct: ${results.direct}\n- Proxy: ${results.proxy}`;
            this.updateStatus(`📋 Test completed: ${summary}`, 'info');
            
            // Auto-enable proxy if direct fails but proxy works
            if (results.direct !== 'SUCCESS' && results.proxy === 'SUCCESS' && !this.useCorsProxy) {
                this.updateStatus('🔄 Auto-enabling CORS proxy based on test results...', 'warning');
                this.enableCorsProxy();
            }
            
        } catch (error) {
            this.updateStatus(`❌ API test failed: ${error.message}`, 'error');
        }
    }
    // Enable CORS proxy mode manually
    enableCorsProxy() {
        if (this.useCorsProxy) {
            this.showToast('💫 CORS proxy already enabled', 'info');
            return;
        }
        
        this.corsProxy = 'https://api.allorigins.win/raw?url=';
        this.useCorsProxy = true;
        
        // Visual feedback
        const corsBtn = document.getElementById('corsBtn');
        if (corsBtn) {
            corsBtn.innerHTML = '✅ CORS Fixed';
            corsBtn.classList.add('active');
            corsBtn.disabled = true;
        }
        
        // Add visual indicator to the page
        this.addCorsIndicator();
        
        this.updateStatus('🌐 CORS proxy enabled! All requests will now use proxy mode.', 'success');
        this.showToast('🌐 CORS proxy enabled - upload should work now!', 'success');
        
        // Save preference for this session
        sessionStorage.setItem('dood_cors_proxy', 'enabled');
    }
    
    // Add visual indicator when CORS proxy is active
    addCorsIndicator() {
        // Remove existing indicator if present
        const existingIndicator = document.getElementById('corsIndicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.id = 'corsIndicator';
        indicator.innerHTML = '🌐 CORS Proxy Active';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #4caf50, #45a049);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(76, 175, 80, 0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(indicator);
    }
    
    // Check if we should use CORS proxy from previous session
    checkCorsPreference() {
        const corsPreference = sessionStorage.getItem('dood_cors_proxy');
        if (corsPreference === 'enabled') {
            this.corsProxy = 'https://api.allorigins.win/raw?url=';
            this.useCorsProxy = true;
            
            const corsBtn = document.getElementById('corsBtn');
            if (corsBtn) {
                corsBtn.innerHTML = '✅ CORS Fixed';
                corsBtn.classList.add('active');
                corsBtn.disabled = true;
            }
            
            // Add visual indicator
            setTimeout(() => {
                this.addCorsIndicator();
            }, 1000); // Delay to ensure DOM is ready
            
            this.updateStatus('💫 CORS proxy restored from previous session', 'info');
        }
    }
    
    // Generate detailed error report for debugging
    generateDetailedErrorReport(error) {
        const report = [
            `\n🚫 UPLOAD FAILED - Detailed Error Report`,
            `\n📊 Error Analysis:`,
            `- Primary Issue: ${error?.message || 'Unknown error'}`,
            `- Error Type: ${error?.name || 'Unknown'}`,
            `\n🔍 System Information:`,
            `- Browser: ${navigator.userAgent.split(' ')[0]}`,
            `- Online Status: ${navigator.onLine ? 'Connected' : 'Offline'}`,
            `- API Key Length: ${this.apiKey?.length || 0} characters`,
            `- CORS Proxy: ${this.useCorsProxy ? 'Enabled' : 'Disabled'}`,
            `- Timestamp: ${new Date().toISOString()}`,
            `\n🛠️ Troubleshooting Steps:`,
            `1. 🌐 Click "Fix CORS" button above`,
            `2. 🔑 Verify API key is correct: ${this.apiKey?.substring(0, 4)}...`,
            `3. 🛡️ Disable browser extensions (especially ad blockers)`,
            `4. 🔄 Try refreshing the page`,
            `5. 🌍 Try a different browser or incognito mode`,
            `\n🤖 For Bot Development:`,
            `- Consider using server-side API calls instead of browser-based`,
            `- Use CORS proxy for development testing`,
            `- Implement proper error handling in production bots`,
            `\n📊 Research Note: This demonstrates browser CORS limitations with external APIs`
        ].join('\n');
        
        return report;
    }
}

// Initialize the uploader when DOM is loaded
let uploader;
document.addEventListener('DOMContentLoaded', () => {
    uploader = new DoodUploader();
    console.log('🎮 DoodStream Uploader initialized by 01 dev');
});

// Expose uploader globally for HTML onclick handlers
window.uploader = uploader;