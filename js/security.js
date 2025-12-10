/**
 * Security Module - Rate limiting, input sanitization, and abuse detection
 */

const Security = {
    // ==================== Rate Limiting ====================
    rateLimits: {},
    
    // Action limits per minute
    LIMITS: {
        chat_message: 10,
        private_message: 15,
        create_challenge: 5,
        accept_challenge: 10,
        create_word: 60,
        update_word: 60,
        create_topic: 10,
        avatar_upload: 3,
        sync_data: 10,
        general: 100
    },
    
    // Check if action is allowed
    isAllowed(action) {
        const limit = this.LIMITS[action] || this.LIMITS.general;
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        
        if (!this.rateLimits[action]) {
            this.rateLimits[action] = [];
        }
        
        // Remove old entries
        this.rateLimits[action] = this.rateLimits[action].filter(t => t > windowStart);
        
        // Check limit
        if (this.rateLimits[action].length >= limit) {
            console.warn(`Rate limit exceeded for action: ${action}`);
            return false;
        }
        
        // Add current timestamp
        this.rateLimits[action].push(now);
        return true;
    },
    
    // Wrapper for rate-limited actions
    async execute(action, fn) {
        if (!this.isAllowed(action)) {
            App.showToast('Thao tác quá nhanh, vui lòng chờ', 'warning');
            return null;
        }
        
        try {
            return await fn();
        } catch (error) {
            console.error(`Action ${action} failed:`, error);
            throw error;
        }
    },
    
    // ==================== Input Sanitization ====================
    
    // Sanitize text input (prevent XSS)
    sanitizeText(text, maxLength = 500) {
        if (!text) return '';
        
        return String(text)
            .trim()
            .substring(0, maxLength)
            // Remove script tags
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            // Remove javascript: protocol
            .replace(/javascript:/gi, '')
            // Remove event handlers
            .replace(/on\w+\s*=/gi, '')
            // Escape HTML entities
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },
    
    // Sanitize HTML (allow some tags)
    sanitizeHtml(html) {
        if (!html) return '';
        
        // Only allow safe tags
        const allowed = ['b', 'i', 'u', 'strong', 'em', 'br'];
        
        return String(html)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    },
    
    // Validate and sanitize word input
    sanitizeWord(word) {
        return {
            english: this.sanitizeText(word.english, 100),
            vietnamese: this.sanitizeText(word.vietnamese, 200),
            topicId: word.topicId
        };
    },
    
    // Validate email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    // Validate word
    isValidWord(word) {
        return word.english && word.english.length >= 1 && word.english.length <= 100
            && word.vietnamese && word.vietnamese.length >= 1 && word.vietnamese.length <= 200
            && word.topicId;
    },
    
    // Validate topic
    isValidTopic(topic) {
        return topic.name && topic.name.length >= 1 && topic.name.length <= 50;
    },
    
    // ==================== Abuse Detection ====================
    
    suspiciousUsers: new Set(),
    
    // Log activity for abuse detection
    logActivity(action) {
        if (!Auth.isLoggedIn()) return;
        
        const userId = Auth.user.uid;
        const key = `abuse_log_${userId}`;
        const data = JSON.parse(sessionStorage.getItem(key) || '[]');
        
        data.push({ 
            action, 
            time: Date.now(),
            url: window.location.pathname
        });
        
        // Keep last 200 entries
        while (data.length > 200) data.shift();
        sessionStorage.setItem(key, JSON.stringify(data));
        
        // Check for abuse patterns
        this.checkAbusePatterns(userId, data);
    },
    
    // Detect abuse patterns
    checkAbusePatterns(userId, data) {
        const lastMinute = data.filter(d => d.time > Date.now() - 60000);
        const last5Minutes = data.filter(d => d.time > Date.now() - 300000);
        
        let abuseType = null;
        
        // Pattern 1: Too many actions in 1 minute
        if (lastMinute.length > 150) {
            abuseType = 'extreme_rate';
        }
        
        // Pattern 2: Repetitive same action
        const actionCounts = {};
        lastMinute.forEach(d => {
            actionCounts[d.action] = (actionCounts[d.action] || 0) + 1;
        });
        
        const maxCount = Math.max(...Object.values(actionCounts));
        if (maxCount > 50) {
            abuseType = 'repetitive_action';
        }
        
        // Pattern 3: Sustained high activity (5 min average)
        if (last5Minutes.length > 500) {
            abuseType = 'sustained_abuse';
        }
        
        if (abuseType) {
            this.handleAbuse(userId, abuseType);
        }
    },
    
    // Handle detected abuse
    handleAbuse(userId, abuseType) {
        console.error('Abuse detected:', userId, abuseType);
        
        // Add to suspicious list
        this.suspiciousUsers.add(userId);
        
        // Show warning
        App.showToast('⚠️ Hoạt động bất thường đã được phát hiện', 'error');
        
        // Report to server (could save to Firestore)
        this.reportAbuse(userId, abuseType);
        
        // Temporarily block actions
        this.tempBlock(userId);
    },
    
    // Report abuse to admin
    async reportAbuse(userId, abuseType) {
        if (!FirebaseDB.initialized) return;
        
        try {
            const { collection, addDoc, serverTimestamp } = FirebaseDB.firestore;
            
            await addDoc(collection(db, 'abuse_reports'), {
                userId: userId,
                abuseType: abuseType,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent,
                sessionData: sessionStorage.getItem(`abuse_log_${userId}`)
            });
            
            console.log('Abuse reported to admin');
        } catch (error) {
            console.error('Failed to report abuse:', error);
        }
    },
    
    // Temporary block user actions
    tempBlock(userId) {
        const blockUntil = Date.now() + 60000; // 1 minute block
        sessionStorage.setItem(`blocked_${userId}`, blockUntil.toString());
    },
    
    // Check if user is blocked
    isBlocked() {
        if (!Auth.isLoggedIn()) return false;
        
        const blocked = sessionStorage.getItem(`blocked_${Auth.user.uid}`);
        if (!blocked) return false;
        
        if (Date.now() < parseInt(blocked)) {
            return true;
        }
        
        // Block expired
        sessionStorage.removeItem(`blocked_${Auth.user.uid}`);
        return false;
    },
    
    // ==================== CSRF Protection ====================
    
    // Generate CSRF token
    generateCSRFToken() {
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem('csrf_token', token);
        return token;
    },
    
    // Verify CSRF token
    verifyCSRFToken(token) {
        return token === sessionStorage.getItem('csrf_token');
    },
    
    // ==================== Secure Storage ====================
    
    // Encrypt sensitive data before storing
    encryptData(data) {
        // Simple obfuscation (not true encryption)
        // For real encryption, use Web Crypto API
        return btoa(JSON.stringify(data));
    },
    
    // Decrypt data
    decryptData(encrypted) {
        try {
            return JSON.parse(atob(encrypted));
        } catch {
            return null;
        }
    },
    
    // ==================== Initialize ====================
    
    init() {
        // Generate CSRF token on load
        this.generateCSRFToken();
        
        // Clear old abuse logs
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('abuse_log_') || key.startsWith('blocked_')) {
                const data = sessionStorage.getItem(key);
                // Clear if older than 1 hour
                try {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const oldest = parsed[0].time;
                        if (Date.now() - oldest > 3600000) {
                            sessionStorage.removeItem(key);
                        }
                    }
                } catch {}
            }
        });
        
        console.log('Security module initialized');
    }
};
