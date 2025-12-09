/**
 * App Module - Main application controller
 */

const App = {
    currentView: 'dashboardView',
    deleteCallback: null,

    // Initialize app
    async init() {
        console.log('VocabMaster initializing...');
        
        // Show loading state
        this.showToast('Đang kết nối...', 'warning');
        
        // Initialize Firebase first
        try {
            await FirebaseDB.init();
        } catch (error) {
            console.log('Firebase not available, using local storage');
        }
        
        // Initialize Auth (will sync data after login)
        try {
            await Auth.init();
            if (Auth.isLoggedIn()) {
                this.showToast(`Xin chào, ${Auth.user.displayName}!`, 'success');
            } else {
                this.showToast('Vui lòng đăng nhập để đồng bộ', 'warning');
            }
        } catch (error) {
            console.log('Auth not available');
        }
        
        // Initialize modules
        Speech.init();
        Topics.init();
        Vocabulary.init();
        Review.init();
        Test.init();
        
        // Load theme
        this.loadTheme();
        
        // Bind global events
        this.bindEvents();
        
        // Initial render
        Stats.render();
        Topics.render();
        
        console.log('VocabMaster ready!');
    },

    // Bind global events
    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Sync button
        document.getElementById('syncBtn').addEventListener('click', async () => {
            this.showToast('Đang đồng bộ...', 'warning');
            try {
                await FirebaseDB.syncToCloud();
                await FirebaseDB.syncFromCloud();
                // Refresh UI
                Stats.render();
                Topics.render();
                if (Topics.currentTopicId) {
                    Vocabulary.renderTopicWords(Topics.currentTopicId);
                }
            } catch (error) {
                this.showToast('Lỗi đồng bộ', 'error');
            }
        });

        // Mobile menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                await Auth.signInWithGoogle();
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await Auth.signOut();
            });
        }

        // Notification button
        const notifyBtn = document.getElementById('notifyBtn');
        if (notifyBtn) {
            // Show button if notifications are supported
            if ('Notification' in window) {
                notifyBtn.style.display = 'flex';
                // Update button state
                if (Notification.permission === 'granted') {
                    notifyBtn.textContent = '🔔';
                    notifyBtn.title = 'Thông báo đã bật';
                } else {
                    notifyBtn.textContent = '🔕';
                    notifyBtn.title = 'Bấm để bật thông báo';
                }
            }
            
            notifyBtn.addEventListener('click', async () => {
                if (Notification.permission === 'granted') {
                    this.showToast('Thông báo đã được bật', 'success');
                } else {
                    const granted = await Notifications.requestPermission();
                    if (granted) {
                        notifyBtn.textContent = '🔔';
                        notifyBtn.title = 'Thông báo đã bật';
                        // Schedule daily reminder
                        Notifications.scheduleDailyReminder();
                    } else {
                        notifyBtn.textContent = '🔕';
                    }
                }
            });
        }

        // Close sidebar when clicking outside (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menuToggle');
            
            if (window.innerWidth <= 768 && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target) &&
                sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });

        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                
                // Update active state
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // Clear topic selection
                Topics.currentTopicId = null;
                document.querySelectorAll('.topic-item').forEach(t => t.classList.remove('active'));
                
                // Show view
                if (view === 'dashboard') {
                    this.showView('dashboardView');
                    Stats.render();
                } else if (view === 'all-words') {
                    this.showView('allWordsView');
                    Vocabulary.renderAllWords();
                } else if (view === 'review-due') {
                    this.showView('reviewDueView');
                    Vocabulary.renderDueWords();
                }
                
                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('open');
                }
            });
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
            el.addEventListener('click', () => {
                el.closest('.modal').classList.remove('active');
            });
        });

        // Config form submit
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            Review.processConfig();
        });

        // Confirm delete button
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            if (this.deleteCallback) {
                this.deleteCallback();
                this.deleteCallback = null;
            }
            document.getElementById('confirmModal').classList.remove('active');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });
    },

    // Show view
    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const view = document.getElementById(viewId);
        if (view) {
            view.classList.add('active');
            this.currentView = viewId;
        }
    },

    // Load theme from storage
    loadTheme() {
        const settings = Storage.getSettings();
        const theme = settings.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
    },

    // Toggle theme
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        Storage.saveSettings({ theme: newTheme });
    },

    // Show toast notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '✓'}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Show confirm dialog
    showConfirm(message, callback) {
        document.getElementById('confirmMessage').textContent = message;
        this.deleteCallback = callback;
        document.getElementById('confirmModal').classList.add('active');
    },
    
    // Show profile modal
    showProfileModal() {
        if (!Auth.isLoggedIn()) {
            this.showToast('Vui lòng đăng nhập', 'warning');
            return;
        }
        
        const user = Auth.user;
        const stats = Stats.calculate();
        
        // Populate user info
        document.getElementById('profileAvatar').src = user.photoURL || '';
        document.getElementById('profileName').textContent = user.displayName || 'Người dùng';
        document.getElementById('profileEmail').textContent = user.email || '';
        
        // Populate stats
        document.getElementById('profileTotalWords').textContent = stats.totalWords;
        document.getElementById('profileMastered').textContent = stats.masteredWords;
        document.getElementById('profileStreak').textContent = stats.streak;
        
        // Calculate level and XP
        const xp = stats.totalWords * 10 + stats.masteredWords * 50 + stats.streak * 5;
        const levels = [
            { level: 1, name: 'Người học mới', minXP: 0 },
            { level: 2, name: 'Học viên', minXP: 100 },
            { level: 3, name: 'Sinh viên chăm chỉ', minXP: 300 },
            { level: 4, name: 'Thành thạo', minXP: 600 },
            { level: 5, name: 'Chuyên gia', minXP: 1000 },
            { level: 6, name: 'Cao thủ', minXP: 2000 },
            { level: 7, name: 'Bậc thầy', minXP: 5000 }
        ];
        
        let currentLevel = levels[0];
        let nextLevel = levels[1];
        for (let i = levels.length - 1; i >= 0; i--) {
            if (xp >= levels[i].minXP) {
                currentLevel = levels[i];
                nextLevel = levels[i + 1] || levels[i];
                break;
            }
        }
        
        document.getElementById('profileLevel').textContent = `Cấp ${currentLevel.level}: ${currentLevel.name}`;
        document.getElementById('profileXP').textContent = `${xp} XP`;
        
        // Calculate level progress
        const progressXP = xp - currentLevel.minXP;
        const neededXP = nextLevel.minXP - currentLevel.minXP;
        const progress = neededXP > 0 ? Math.min((progressXP / neededXP) * 100, 100) : 100;
        document.getElementById('profileLevelFill').style.width = `${progress}%`;
        
        // Usage stats
        const joinDate = user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('vi-VN') : '--';
        document.getElementById('profileJoinDate').textContent = joinDate;
        document.getElementById('profileTestCount').textContent = Storage.getStats().testCount || 0;
        document.getElementById('profileAccuracy').textContent = `${Stats.getAccuracyRate()}%`;
        
        // Show modal
        document.getElementById('profileModal').classList.add('active');
        
        // Logout button handler
        document.getElementById('profileLogoutBtn').onclick = async () => {
            document.getElementById('profileModal').classList.remove('active');
            await Auth.signOut();
        };
    },
    
    // Register Service Worker for PWA
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    },
    
    // PWA install prompt
    deferredPrompt: null,
    
    setupPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Show install button
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.addEventListener('click', () => this.installPWA());
            }
            
            console.log('PWA install available');
        });
        
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            this.deferredPrompt = null;
            const installBtn = document.getElementById('installBtn');
            if (installBtn) installBtn.style.display = 'none';
        });
    },
    
    async installPWA() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        const result = await this.deferredPrompt.userChoice;
        console.log('Install prompt result:', result);
        this.deferredPrompt = null;
    },
    
    // Show confetti animation for milestone
    showConfetti() {
        const container = document.getElementById('toastContainer');
        const confettiColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${confettiColors[Math.floor(Math.random() * confettiColors.length)]};
                left: ${Math.random() * 100}vw;
                top: -10px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: confetti-fall ${2 + Math.random() * 2}s linear forwards;
                z-index: 9999;
            `;
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 4000);
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    App.registerServiceWorker();
    App.setupPWAInstall();
});
