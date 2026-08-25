/**
 * Notifications Module - Push Notifications with OneSignal
 */

const Notifications = {
    initialized: false,
    oneSignalReady: false,
    initPromise: null,
    subscriptionListenerAttached: false,
    
    // OneSignal App ID
    ONESIGNAL_APP_ID: '098cbdcc-90ec-4af9-84a1-89e53dde4723',
    REMINDER_WORKER_URL: 'https://vocabmaster-reminders.doanhnghiepphu2k7.workers.dev',
    
    // Initialize OneSignal (call once on app start)
    async init() {
        if (this.initialized) return true;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            const oneSignal = await this.waitForOneSignal();
            if (!oneSignal?.User?.PushSubscription) {
                console.log('OneSignal is unavailable on this browser');
                return false;
            }

            try {
                this.oneSignalReady = true;
                this.initialized = true;

                if (!this.subscriptionListenerAttached) {
                    oneSignal.User.PushSubscription.addEventListener('change', async (event) => {
                        if (!event.current?.optedIn) return;
                        localStorage.setItem('vocabmaster_notif_subscribed', 'true');
                        await this.syncSubscription(oneSignal);
                    });
                    this.subscriptionListenerAttached = true;
                }

                console.log('Notifications module initialized');
                return true;
            } catch (error) {
                console.error('Notifications init error:', error);
                return false;
            }
        })();

        const result = await this.initPromise;
        if (!result) this.initPromise = null;
        return result;
    },

    // Wait for the deferred SDK queue instead of assuming the global is ready.
    async waitForOneSignal(timeoutMs = 10000) {
        if (window.OneSignal?.User) return window.OneSignal;
        if (window.OneSignalReady) {
            try {
                const oneSignal = await Promise.race([
                    window.OneSignalReady,
                    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
                ]);
                if (oneSignal?.User) return oneSignal;
            } catch (error) {
                console.warn('OneSignal ready wait failed:', error);
            }
        }

        const deferred = window.OneSignalDeferred = window.OneSignalDeferred || [];
        return new Promise((resolve) => {
            let settled = false;
            const finish = (oneSignal) => {
                if (settled) return;
                settled = true;
                resolve(oneSignal?.User ? oneSignal : null);
            };
            deferred.push(finish);
            setTimeout(() => finish(null), timeoutMs);
        });
    },

    isSupported() {
        return typeof window !== 'undefined' && 'Notification' in window;
    },

    getPermissionState() {
        return this.isSupported() ? Notification.permission : 'unsupported';
    },

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },

    isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    },

    async getSubscriptionId(oneSignal = window.OneSignal) {
        if (!oneSignal?.User?.PushSubscription) return null;
        const optedIn = await oneSignal.User.PushSubscription.optedIn;
        return optedIn ? (await oneSignal.User.PushSubscription.id) || null : null;
    },

    // iOS can grant permission before OneSignal finishes creating its subscription.
    async waitForActiveSubscription(oneSignal, timeoutMs = 10000) {
        if (!oneSignal?.User?.PushSubscription) return null;

        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                let optedIn = await oneSignal.User.PushSubscription.optedIn;
                if (!optedIn && this.getPermissionState() === 'granted' && oneSignal.User.PushSubscription.optIn) {
                    await oneSignal.User.PushSubscription.optIn();
                    optedIn = await oneSignal.User.PushSubscription.optedIn;
                }

                const subscriptionId = optedIn ? await oneSignal.User.PushSubscription.id : null;
                if (subscriptionId) return subscriptionId;
            } catch (error) {
                console.warn('Waiting for OneSignal subscription:', error);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return null;
    },

    async syncSubscription(oneSignal = window.OneSignal) {
        if (!oneSignal) return;
        let subscriptionId = await this.getSubscriptionId(oneSignal);
        if (!subscriptionId && this.getPermissionState() === 'granted') {
            subscriptionId = await this.waitForActiveSubscription(oneSignal);
        }
        if (subscriptionId && FirebaseDB.initialized && Auth.isLoggedIn()) {
            const settings = Storage.getSettings();
            await FirebaseDB.saveReminderSettings(
                settings.reminderEnabled !== false,
                settings.reminderTime || '20:00',
                subscriptionId
            );
        }
        if (Auth.isLoggedIn()) await this.tagUser(oneSignal);
        // Firebase identity is enough for the worker to target the verified email alias.
        if (Auth.isLoggedIn()) await this.syncReminderWorker(subscriptionId);
        await this.updateReminderTag(oneSignal);
    },

    // Register the device with the minute-by-minute Cloudflare reminder worker.
    async syncReminderWorker(subscriptionId, reminderSettings = Storage.getSettings()) {
        if (typeof Auth === 'undefined' || !Auth.isLoggedIn() || !Auth.user?.getIdToken) {
            return false;
        }

        try {
            const idToken = await Auth.user.getIdToken();
            const response = await fetch(`${this.REMINDER_WORKER_URL}/subscriptions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscriptionId: subscriptionId || null,
                    enabled: reminderSettings.reminderEnabled !== false,
                    reminderTime: reminderSettings.reminderTime || '20:00'
                })
            });

            if (!response.ok) throw new Error(`Worker returned ${response.status}`);
            console.log('Reminder subscription synced to Cloudflare');
            return true;
        } catch (error) {
            console.warn('Cloudflare reminder sync failed:', error);
            return false;
        }
    },
    
    // Request permission and register with OneSignal
    async requestPermission() {
        // iOS requires the native prompt to happen directly from a user gesture.
        if (this.isIOS() && this.isStandalone() && this.getPermissionState() === 'default') {
            const oneSignal = window.OneSignal?.User ? window.OneSignal : null;
            if (oneSignal?.Notifications?.requestPermission) {
                try {
                    await oneSignal.Notifications.requestPermission();
                    return this.promptNativePermission(oneSignal);
                } catch (error) {
                    console.warn('OneSignal iOS permission request failed:', error);
                }
            }
            return this.promptNativePermission(oneSignal);
        }

        let oneSignal = window.OneSignal?.User ? window.OneSignal : null;
        // Do not delay the browser prompt when the SDK is still loading.
        if (!oneSignal && this.getPermissionState() === 'default') {
            return this.promptNativePermission();
        }
        oneSignal = oneSignal || await this.waitForOneSignal(5000);
        try {
            if (oneSignal?.Slidedown?.promptPush) {
                if (oneSignal.Notifications?.isPushSupported &&
                    !(await oneSignal.Notifications.isPushSupported())) {
                    App.showToast('Thiết bị này không hỗ trợ thông báo đẩy', 'warning');
                    return false;
                }

                await oneSignal.Slidedown.promptPush();
                await new Promise(r => setTimeout(r, 1000));

                let isSubscribed = await oneSignal.User.PushSubscription.optedIn;
                if (!isSubscribed && this.getPermissionState() === 'granted') {
                    await oneSignal.User.PushSubscription.optIn();
                    isSubscribed = await oneSignal.User.PushSubscription.optedIn;
                }

                if (isSubscribed) {
                    console.log('OneSignal push subscription active');
                    App.showToast('Đã bật thông báo! 🔔', 'success');
                    localStorage.setItem('vocabmaster_notif_subscribed', 'true');
                    localStorage.setItem('vocabmaster_notif_prompted', 'true');
                    await this.syncSubscription(oneSignal);
                    return true;
                } else {
                    console.log('User did not subscribe');
                    localStorage.setItem('vocabmaster_notif_prompted', 'dismissed');
                    return false;
                }
            }

            return this.promptNativePermission(oneSignal);
        } catch (error) {
            console.error('Error requesting permission:', error);
            localStorage.setItem('vocabmaster_notif_prompted', 'error');
            return false;
        }
    },
    
    // Tag user with Firebase UID for targeting
    async tagUser(oneSignal = null) {
        if (!Auth.isLoggedIn()) return;

        oneSignal = oneSignal || await this.waitForOneSignal(5000);
        if (!oneSignal?.User?.addTags) return;

        try {
            if (oneSignal.login) {
                let loggedIn = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        await oneSignal.login(Auth.user.uid);
                        loggedIn = true;
                        break;
                    } catch (error) {
                        console.warn('OneSignal identity sync attempt ' + attempt + ' failed:', error);
                        if (attempt < 3) {
                            await new Promise(resolve => setTimeout(resolve, attempt * 1500));
                        }
                    }
                }
                if (!loggedIn) {
                    console.warn('OneSignal identity sync failed after retries');
                    return false;
                }
            }
            const normalizedEmail = (Auth.user.email || '').trim().toLowerCase();
            await oneSignal.User.addTags({
                firebase_uid: Auth.user.uid,
                user_name: Auth.user.displayName || 'User',
                user_email: normalizedEmail,
                user_email_normalized: normalizedEmail
            });
            if (oneSignal.User.addAlias && normalizedEmail) {
                await oneSignal.User.addAlias('email', normalizedEmail);
            }
            console.log('User tagged with Firebase UID');
            return true;
        } catch (error) {
            console.error('Error tagging user:', error);
            return false;
        }
    },
    
    // Update reminder time tag for scheduled notifications
    async updateReminderTag(oneSignal = null) {
        oneSignal = oneSignal || await this.waitForOneSignal(5000);
        if (!oneSignal?.User?.addTags) {
            console.log('OneSignal not available for tags');
            return false;
        }

        if (Auth.isLoggedIn() && oneSignal.login) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await oneSignal.login(Auth.user.uid);
                    break;
                } catch (error) {
                    console.warn('OneSignal login before reminder tags failed:', error);
                    if (attempt === 3) return false;
                    await new Promise(resolve => setTimeout(resolve, attempt * 1500));
                }
            }
        }

        const settings = Storage.getSettings();
        const reminderEnabled = settings.reminderEnabled !== false;
        const reminderTime = settings.reminderTime || '20:00';
        console.log('Updating OneSignal tags:', { reminder_enabled: reminderEnabled, reminder_time: reminderTime });

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await oneSignal.User.addTags({
                    reminder_enabled: reminderEnabled ? 'true' : 'false',
                    reminder_time: reminderTime
                });
                console.log('Reminder tags updated successfully');
                return true;
            } catch (error) {
                console.warn('Reminder tag sync attempt ' + attempt + ' failed:', error);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1500));
                }
            }
        }

        console.error('Error updating reminder tags after retries');
        return false;
    },
    
    // Request native notification permission directly (no custom modal)
    async promptNativePermission(oneSignal = null) {
        if (!this.isSupported()) {
            console.log('Notifications not supported');
            return false;
        }

        if (this.isIOS() && !this.isStandalone()) {
            App.showToast('Trên iPhone/iPad, hãy thêm web vào Màn hình chính rồi mở app để bật thông báo', 'warning');
            return false;
        }

        const permission = this.getPermissionState();
        if (permission === 'granted') {
            console.log('Already have notification permission');
            localStorage.setItem('vocabmaster_notif_subscribed', 'true');
            oneSignal = oneSignal || await this.waitForOneSignal(10000);
            if (oneSignal) {
                await this.syncSubscription(oneSignal);
                if (await this.getSubscriptionId(oneSignal)) return true;
            }
            App.showToast('Đã cấp quyền nhưng chưa đồng bộ được thiết bị', 'warning');
            return false;
        }

        if (permission === 'denied') {
            console.log('Notifications denied by user');
            localStorage.setItem('vocabmaster_notif_prompted', 'denied');
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            console.log('Permission result:', result);

            if (result === 'granted') {
                App.showToast('Đã bật thông báo! 🔔', 'success');
                localStorage.setItem('vocabmaster_notif_subscribed', 'true');
                localStorage.setItem('vocabmaster_notif_prompted', 'true');

                oneSignal = oneSignal || await this.waitForOneSignal(10000);
                let subscriptionReady = false;
                if (oneSignal?.User?.PushSubscription?.optIn) {
                    try {
                        await oneSignal.User.PushSubscription.optIn();
                        await this.syncSubscription(oneSignal);
                        subscriptionReady = !!(await this.getSubscriptionId(oneSignal));
                    } catch (e) {
                        console.log('OneSignal optIn error:', e);
                    }
                }

                if (!subscriptionReady) {
                    App.showToast('Đã cấp quyền nhưng chưa đồng bộ được thiết bị', 'warning');
                    return false;
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
    async checkAndPrompt() {
        // iOS only permits this prompt after installation and a user gesture.
        if (this.isIOS()) return;

        const prompted = localStorage.getItem('vocabmaster_notif_prompted');
        const oneSignal = await this.waitForOneSignal(3000);
        if (await this.getSubscriptionId(oneSignal)) {
            localStorage.setItem('vocabmaster_notif_subscribed', 'true');
            console.log('Already subscribed, skipping prompt');
            return;
        }

        // Do not trust stale local flags when the SDK can report the real state.
        if (!oneSignal && (prompted === 'true' || prompted === 'denied')) return;
        
        // OneSignal's prompt is more reliable on Android than a delayed native call.
        setTimeout(() => {
            this.requestPermission();
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
        if (!this.isSupported() || this.getPermissionState() !== 'granted') return;
        try {
            new Notification(title, {
                body: body,
                icon: './icons/icon-192.png',
                badge: './icons/icon-192.png'
            });
        } catch (error) {
            console.warn('Local notification unavailable:', error);
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
    async saveReminderSettings(enabled, time) {
        const settings = Storage.getSettings();
        settings.reminderEnabled = enabled;
        settings.reminderTime = time;
        Storage.saveSettings(settings);
        let subscriptionId = null;
        let oneSignal = null;
        
        // Reschedule local reminder (fallback)
        if (enabled && this.isEnabled()) {
            this.scheduleDailyReminder();
        } else if (this.reminderTimer) {
            clearTimeout(this.reminderTimer);
            this.reminderTimer = null;
        }
        
        // Get the push subscription even if Firebase has not finished initializing.
        try {
            oneSignal = await this.waitForOneSignal(15000);
            subscriptionId = await this.getSubscriptionId(oneSignal);
            if (!subscriptionId && oneSignal) {
                subscriptionId = await this.waitForActiveSubscription(oneSignal, 15000);
            }
            if (oneSignal && Auth.isLoggedIn()) {
                await this.tagUser(oneSignal);
            }
        } catch (error) {
            console.error('Error getting OneSignal subscription ID:', error);
        }

        // Save to Firebase (works on all devices including iOS)
        if (typeof FirebaseDB !== 'undefined' && FirebaseDB.initialized && Auth.isLoggedIn()) {
            const saved = await FirebaseDB.saveReminderSettings(enabled, time, subscriptionId);
            if (saved) {
                console.log('Reminder saved to Firebase with subscription ID:', subscriptionId);
            } else {
                console.warn('Failed to save reminder to Firebase');
            }
        }

        const workerSynced = await this.syncReminderWorker(subscriptionId, settings);
        if (workerSynced) {
            App.showToast(`🔔 Đã lưu nhắc nhở lúc ${time}`, 'success');
        } else if (enabled) {
            App.showToast('Chưa đồng bộ được thiết bị. Hãy bấm Đồng bộ thông báo rồi lưu lại.', 'warning');
        }
        
        // Also try OneSignal tags (works on desktop/Android)
        oneSignal = oneSignal || await this.waitForOneSignal(15000);
        if (oneSignal) {
            await this.updateReminderTag(oneSignal);
        } else {
            console.warn('OneSignal was not ready while saving reminder settings');
        }
        
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
        return this.getPermissionState() === 'granted';
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
