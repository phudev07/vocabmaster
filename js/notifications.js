/**
 * Notifications Module - Push Notifications with FCM
 */

const Notifications = {
    initialized: false,
    messaging: null,
    
    // Initialize FCM
    async init() {
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return false;
        }
        
        try {
            // Import Firebase messaging
            const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');
            
            // Get messaging instance (using the app from FirebaseDB)
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            
            const firebaseConfig = {
                apiKey: "AIzaSyDBZz76elwCKWLtGRRiPntj4CFbmty9tmk",
                authDomain: "vocabmaster-4c784.firebaseapp.com",
                projectId: "vocabmaster-4c784",
                storageBucket: "vocabmaster-4c784.firebasestorage.app",
                messagingSenderId: "816895415090",
                appId: "1:816895415090:web:5fcf52a0ea39f49e6d3d2b",
                measurementId: "G-P5S6Z8YENY"
            };
            
            const app = initializeApp(firebaseConfig, 'messaging');
            this.messaging = getMessaging(app);
            
            // Handle foreground messages
            onMessage(this.messaging, (payload) => {
                console.log('Foreground message received:', payload);
                this.showLocalNotification(payload.notification.title, payload.notification.body);
            });
            
            this.initialized = true;
            console.log('Notifications initialized');
            return true;
        } catch (error) {
            console.error('Notifications init error:', error);
            return false;
        }
    },
    
    // Request permission and get token
    async requestPermission() {
        if (!this.initialized) {
            await this.init();
        }
        
        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                console.log('Notification permission granted');
                App.showToast('Đã bật thông báo! 🔔', 'success');
                
                // Get FCM token
                const { getToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');
                const token = await getToken(this.messaging, {
                    vapidKey: 'YOUR_VAPID_KEY_HERE' // Need to generate this in Firebase Console
                });
                
                if (token) {
                    console.log('FCM Token:', token);
                    // Save token to Firestore for server-side notifications
                    await this.saveToken(token);
                }
                
                return true;
            } else {
                console.log('Notification permission denied');
                App.showToast('Bạn đã từ chối thông báo', 'warning');
                return false;
            }
        } catch (error) {
            console.error('Error requesting permission:', error);
            App.showToast('Không thể bật thông báo', 'error');
            return false;
        }
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
        const now = new Date();
        const reminderTime = new Date();
        reminderTime.setHours(20, 0, 0, 0); // 8 PM
        
        // If it's past 8 PM, schedule for tomorrow
        if (now > reminderTime) {
            reminderTime.setDate(reminderTime.getDate() + 1);
        }
        
        const timeUntilReminder = reminderTime - now;
        
        setTimeout(() => {
            const dueWords = Storage.getDueWords();
            if (dueWords.length > 0) {
                this.showLocalNotification(
                    '📚 VocabMaster',
                    `Bạn có ${dueWords.length} từ cần ôn tập hôm nay!`
                );
            }
            // Schedule next reminder
            this.scheduleDailyReminder();
        }, timeUntilReminder);
        
        console.log('Reminder scheduled for:', reminderTime.toLocaleString());
    },
    
    // Check if notifications are enabled
    isEnabled() {
        return Notification.permission === 'granted';
    }
};
