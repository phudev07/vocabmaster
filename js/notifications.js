/**
 * Notifications Module - Push Notifications with OneSignal
 */

const Notifications = {
    initialized: false,
    oneSignalReady: false,
    
    // OneSignal App ID
    ONESIGNAL_APP_ID: '098cbdcc-90ec-4af9-84a1-89e53dde4723',
    
    // Initialize OneSignal (call once on app start)
    async init() {
        if (this.initialized) return true;
        
        // Check if OneSignal is available
        if (typeof window.OneSignal === 'undefined') {
            console.log('OneSignal SDK not loaded yet');
            return false;
        }
        
        try {
            // OneSignal is already initialized by SDK, just set up listeners
            this.oneSignalReady = true;
            this.initialized = true;
            
            // Listen for subscription changes
            window.OneSignal.User.PushSubscription.addEventListener('change', (event) => {
                console.log('Push subscription changed:', event.current);
                if (event.current.optedIn) {
                    localStorage.setItem('vocabmaster_notif_subscribed', 'true');
                    // Tag user when subscribed
                    if (Auth.isLoggedIn()) {
                        this.tagUser();
                    }
                }
            });
            
            console.log('Notifications module initialized');
            return true;
        } catch (error) {
            console.error('Notifications init error:', error);
            return false;
        }
    },
    
    // Request permission and register with OneSignal
    async requestPermission() {
        if (!this.initialized) {
            await this.init();
        }
        
        try {
            // Use OneSignal's permission flow
            if (window.OneSignal) {
                await window.OneSignal.Slidedown.promptPush();
                
                // Wait a moment for subscription to process
                await new Promise(r => setTimeout(r, 1000));
                
                // Check if subscribed
                const isSubscribed = await window.OneSignal.User.PushSubscription.optedIn;
                
                if (isSubscribed) {
                    console.log('OneSignal push subscription active');
                    App.showToast('Đã bật thông báo! 🔔', 'success');
                    
                    // Set BOTH flags
                    localStorage.setItem('vocabmaster_notif_subscribed', 'true');
                    localStorage.setItem('vocabmaster_notif_prompted', 'true');
                    
                    // Tag user with Firebase UID for targeted notifications
                    if (Auth.isLoggedIn()) {
                        await this.tagUser();
                    }
                    
                    // Set reminder time tag
                    await this.updateReminderTag();
                    
                    return true;
                } else {
                    console.log('User did not subscribe');
                    localStorage.setItem('vocabmaster_notif_prompted', 'dismissed');
                    return false;
                }
            } else {
                // Fallback to native permission
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    App.showToast('Đã bật thông báo! 🔔', 'success');
                    localStorage.setItem('vocabmaster_notif_subscribed', 'true');
                    localStorage.setItem('vocabmaster_notif_prompted', 'true');
                    return true;
                } else if (permission === 'denied') {
                    localStorage.setItem('vocabmaster_notif_prompted', 'denied');
                }
                return false;
            }
        } catch (error) {
            console.error('Error requesting permission:', error);
            // Still mark as prompted to avoid loop
            localStorage.setItem('vocabmaster_notif_prompted', 'error');
            return false;
        }
    },
    
    // Tag user with Firebase UID for targeting
    async tagUser() {
        if (!window.OneSignal || !Auth.isLoggedIn()) return;
        
        try {
            await window.OneSignal.User.addTags({
                firebase_uid: Auth.user.uid,
                user_name: Auth.user.displayName || 'User',
                user_email: Auth.user.email || ''
            });
            console.log('User tagged with Firebase UID');
        } catch (error) {
            console.error('Error tagging user:', error);
        }
    },
    
    // Update reminder time tag for scheduled notifications
    async updateReminderTag() {
        if (!window.OneSignal) return;
        
        try {
            const settings = Storage.getSettings();
            const reminderEnabled = settings.reminderEnabled !== false;
            const reminderTime = settings.reminderTime || '20:00';
            
            await window.OneSignal.User.addTags({
                reminder_enabled: reminderEnabled ? 'true' : 'false',
                reminder_time: reminderTime
            });
            console.log('Reminder tags updated:', { reminderEnabled, reminderTime });
        } catch (error) {
            console.error('Error updating reminder tags:', error);
        }
    },
    
    // Request native notification permission directly (no custom modal)
    async promptNativePermission() {
        // Skip if already granted or denied
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            console.log('Already have notification permission');
            localStorage.setItem('vocabmaster_notif_subscribed', 'true');
            if (Auth.isLoggedIn()) {
                this.tagUser();
            }
            return true;
        }
        
        if (Notification.permission === 'denied') {
            console.log('Notifications denied by user');
            localStorage.setItem('vocabmaster_notif_prompted', 'denied');
            return false;
        }
        
        // Request permission - this shows the NATIVE device prompt
        try {
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);
            
            if (permission === 'granted') {
                App.showToast('Đã bật thông báo! 🔔', 'success');
                localStorage.setItem('vocabmaster_notif_subscribed', 'true');
                localStorage.setItem('vocabmaster_notif_prompted', 'true');
                
                // Register with OneSignal if available
                if (window.OneSignal) {
                    try {
                        await window.OneSignal.User.PushSubscription.optIn();
                        if (Auth.isLoggedIn()) {
                            await this.tagUser();
                        }
                    } catch (e) {
                        console.log('OneSignal optIn error:', e);
                    }
                }
                
                return true;
            } else {
                localStorage.setItem('vocabmaster_notif_prompted', 'denied');
                return false;
            }
        } catch (error) {
            console.error('Permission request error:', error);
            localStorage.setItem('vocabmaster_notif_prompted', 'error');
            return false;
        }
    },
    
    // Check and prompt on login (call this after user logs in)
    checkAndPrompt() {
        // Skip if already subscribed or prompted
        if (localStorage.getItem('vocabmaster_notif_subscribed') === 'true') {
            console.log('Already subscribed, skipping prompt');
            return;
        }
        
        const prompted = localStorage.getItem('vocabmaster_notif_prompted');
        if (prompted === 'true' || prompted === 'denied') {
            console.log('Already prompted, skipping');
            return;
        }
        
        // Delay then request native permission
        setTimeout(() => {
            this.promptNativePermission();
        }, 3000);
    },
    
    // Save FCM token to Firestore
    async saveToken(token) {
        if (!FirebaseDB.initialized) return;
        
        try {
            const { doc, setDoc } = FirebaseDB.firestore;
            await setDoc(doc(db, 'fcmTokens', 'webToken'), {
                token: token,
                updatedAt: new Date().toISOString()
            });
            console.log('FCM token saved');
        } catch (error) {
            console.error('Error saving token:', error);
        }
    },
    
    // Show local notification (for foreground)
    showLocalNotification(title, body) {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: './icons/icon-192.png',
                badge: './icons/icon-192.png'
            });
        }
    },
    
    // Schedule daily reminder (using setTimeout as fallback)
    scheduleDailyReminder() {
        // Check if reminder is enabled
        const settings = Storage.getSettings();
        if (settings.reminderEnabled === false) {
            console.log('Daily reminder disabled');
            return;
        }
        
        // Get reminder time from settings (default 20:00)
        const reminderTimeStr = settings.reminderTime || '20:00';
        const [hours, minutes] = reminderTimeStr.split(':').map(Number);
        
        const now = new Date();
        const reminderTime = new Date();
        reminderTime.setHours(hours, minutes, 0, 0);
        
        // If it's past reminder time, schedule for tomorrow
        if (now > reminderTime) {
            reminderTime.setDate(reminderTime.getDate() + 1);
        }
        
        const timeUntilReminder = reminderTime - now;
        
        // Clear existing timer
        if (this.reminderTimer) {
            clearTimeout(this.reminderTimer);
        }
        
        this.reminderTimer = setTimeout(() => {
            const dueWords = Storage.getDueWords();
            if (dueWords.length > 0) {
                this.showLocalNotification(
                    '📚 VocabMaster',
                    `Bạn có ${dueWords.length} từ cần ôn tập hôm nay!`
                );
            } else {
                this.showLocalNotification(
                    '🎉 VocabMaster', 
                    'Tuyệt vời! Bạn đã hoàn thành ôn tập hôm nay!'
                );
            }
            // Schedule next reminder
            this.scheduleDailyReminder();
        }, timeUntilReminder);
        
        console.log('Reminder scheduled for:', reminderTime.toLocaleString());
    },
    
    // Save reminder settings
    saveReminderSettings(enabled, time) {
        const settings = Storage.getSettings();
        settings.reminderEnabled = enabled;
        settings.reminderTime = time;
        Storage.saveSettings(settings);
        
        // Reschedule local reminder (fallback)
        if (enabled && this.isEnabled()) {
            this.scheduleDailyReminder();
        } else if (this.reminderTimer) {
            clearTimeout(this.reminderTimer);
            this.reminderTimer = null;
        }
        
        // Update OneSignal tags for server-side scheduling
        this.updateReminderTag();
        
        console.log('Reminder settings saved:', { enabled, time });
    },
    
    // Load reminder settings into UI
    loadReminderSettings() {
        const settings = Storage.getSettings();
        const enabledCheckbox = document.getElementById('reminderEnabled');
        const timeInput = document.getElementById('reminderTime');
        
        if (enabledCheckbox) {
            enabledCheckbox.checked = settings.reminderEnabled !== false;
        }
        if (timeInput) {
            timeInput.value = settings.reminderTime || '20:00';
        }
    },
    
    // Check if notifications are enabled
    isEnabled() {
        return Notification.permission === 'granted';
    },
    
    // ========================================
    // Sound Notifications & Badge Counts
    // ========================================
    
    // Track seen challenges to avoid duplicate sounds
    seenChallenges: new Set(),
    lastMessageId: null,
    badgeCounts: { challenges: 0 },
    
    // Play notification sound using Web Audio API
    playSound(type = 'notification') {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different tones for different notifications
            if (type === 'challenge') {
                oscillator.frequency.value = 440; // A4
                oscillator.type = 'sine';
            } else if (type === 'message') {
                oscillator.frequency.value = 523; // C5
                oscillator.type = 'sine';
            } else {
                oscillator.frequency.value = 600;
                oscillator.type = 'sine';
            }
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            
            // Vibrate on mobile if supported
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        } catch (e) {
            console.log('Audio not supported');
        }
    },
    
    // Check for new challenges and update badge/sound
    checkNewChallenges(challenges) {
        if (!Auth.isLoggedIn()) return;
        
        const uid = Auth.user.uid;
        let pendingCount = 0;
        let hasNewChallenge = false;
        
        // Load seen challenges from localStorage
        const stored = localStorage.getItem('seenChallenges');
        if (stored) {
            this.seenChallenges = new Set(JSON.parse(stored));
        }
        
        challenges.forEach(challenge => {
            // Count pending challenges for current user (as opponent)
            if (challenge.opponentId === uid && challenge.status === 'pending') {
                pendingCount++;
                
                // Check if this is a new unseen challenge
                if (!this.seenChallenges.has(challenge.id)) {
                    hasNewChallenge = true;
                    this.seenChallenges.add(challenge.id);
                }
            }
            
            // Count active challenges waiting for user's score
            if (challenge.status === 'active') {
                const isCreator = challenge.creatorId === uid;
                const myScore = isCreator ? challenge.creatorScore : challenge.opponentScore;
                if (myScore === null) {
                    pendingCount++;
                }
            }
        });
        
        // Play sound if new challenge
        if (hasNewChallenge) {
            this.playSound('challenge');
            // Save seen challenges
            localStorage.setItem('seenChallenges', JSON.stringify([...this.seenChallenges]));
        }
        
        this.badgeCounts.challenges = pendingCount;
        this.updateBadge('challenges', pendingCount);
    },
    
    // Check for new chat messages
    checkNewMessage(message) {
        if (!Auth.isLoggedIn()) return;
        
        // Only play sound for messages from others
        if (message.userId !== Auth.user.uid && message.id !== this.lastMessageId) {
            this.playSound('message');
            this.lastMessageId = message.id;
        }
    },
    
    // Update badge count in UI
    updateBadge(type, count) {
        const badge = document.getElementById(`${type}Badge`);
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
        
        // Update page title
        this.updateTitle();
    },
    
    // Update page title with badge count
    updateTitle() {
        const total = this.badgeCounts.challenges;
        const baseTitle = 'VocabMaster';
        
        if (total > 0) {
            document.title = `(${total}) ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }
};
