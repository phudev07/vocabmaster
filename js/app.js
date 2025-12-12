/**
 * App Module - Main application controller
 */

const App = {
    currentView: 'dashboardView',
    deleteCallback: null,

    // Initialize app
    async init() {
        console.log('VocabMaster initializing...');
        
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
            }
        } catch (error) {
            console.log('Auth not available');
        }
        
        // Initialize Leaderboard (for landing page and dashboard)
        try {
            await Leaderboard.init();
        } catch (error) {
            console.log('Leaderboard not available');
        }
        
        // Initialize modules (only if logged in, otherwise they won't render)
        Speech.init();
        Topics.init();
        Vocabulary.init();
        Review.init();
        Test.init();
        Achievements.init();
        Chat.init();
        Admin.init();
        Import.init();
        PrivateChat.init();
        Challenges.init();
        
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
        
        // Landing page login button
        const landingLoginBtn = document.getElementById('landingLoginBtn');
        if (landingLoginBtn) {
            landingLoginBtn.addEventListener('click', async () => {
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
                } else if (view === 'chat') {
                    this.showView('chatView');
                    // Start listening if not already
                    if (typeof Chat !== 'undefined' && Auth.isLoggedIn()) {
                        Chat.startListening();
                        // Update online count
                        const onlineCount = document.getElementById('chatOnlineCount');
                        if (onlineCount && typeof Leaderboard !== 'undefined') {
                            onlineCount.textContent = Leaderboard.getOnlineCount();
                        }
                    }
                } else if (view === 'admin') {
                    this.showView('adminView');
                    // Load users for admin panel
                    if (typeof Admin !== 'undefined') {
                        Admin.fetchAllUsers().then(() => Admin.renderUsers());
                    }
                } else if (view === 'inbox') {
                    this.showView('inboxView');
                    // Load conversations
                    if (typeof PrivateChat !== 'undefined') {
                        PrivateChat.fetchConversations().then(() => PrivateChat.renderConversations());
                    }
                } else if (view === 'challenges') {
                    this.showView('challengesView');
                    // Load challenges
                    if (typeof Challenges !== 'undefined') {
                        Challenges.fetchChallenges().then(() => Challenges.render());
                    }
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
        
        // Mobile swipe gesture for sidebar
        this.setupSwipeGesture();
    },
    
    // Setup swipe gesture for mobile sidebar
    setupSwipeGesture() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        const sidebar = document.getElementById('sidebar');
        const minSwipeDistance = 50; // Minimum swipe distance in pixels
        const edgeThreshold = 50; // Edge of screen threshold for opening (increased for easier trigger)
        
        // Touch start
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        // Touch end
        document.addEventListener('touchend', (e) => {
            if (window.innerWidth > 768) return; // Only on mobile
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            // Only handle horizontal swipes (ignore vertical scrolling)
            if (Math.abs(deltaX) < Math.abs(deltaY)) return;
            if (Math.abs(deltaX) < minSwipeDistance) return;
            
            // Swipe right - open sidebar (only if started from left edge)
            if (deltaX > 0 && touchStartX < edgeThreshold && !sidebar.classList.contains('open')) {
                sidebar.classList.add('open');
                console.log('Swipe: Open sidebar');
                return;
            }
            
            // Swipe left - close sidebar
            if (deltaX < 0 && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                console.log('Swipe: Close sidebar');
            }
        }, { passive: true });
        
        console.log('Swipe gesture initialized');
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
            
            // Mark chat as seen when switching to chat view
            if (viewId === 'chatView' && typeof Chat !== 'undefined') {
                Chat.markChatAsSeen();
            }
        }
    },

    // Load theme from storage
    loadTheme() {
        const settings = Storage.getSettings();
        const theme = settings.theme || 'dark';
        const color = settings.colorTheme || '';
        
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-color', color);
        
        // Update color selector active state
        this.updateColorSelector(color);
    },

    // Toggle theme
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        const settings = Storage.getSettings();
        settings.theme = newTheme;
        Storage.saveSettings(settings);
    },
    
    // Set color theme
    setColorTheme(color) {
        document.documentElement.setAttribute('data-color', color);
        const settings = Storage.getSettings();
        settings.colorTheme = color;
        Storage.saveSettings(settings);
        
        this.updateColorSelector(color);
    },
    
    // Update color selector active state
    updateColorSelector(color) {
        const container = document.getElementById('themeColors');
        if (!container) return;
        
        container.querySelectorAll('.color-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === color);
        });
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
        
        // Display freeze count
        const localStats = Storage.getStats();
        const freezes = localStats.freezesRemaining !== undefined ? localStats.freezesRemaining : 3;
        document.getElementById('profileFreezes').textContent = `❄️${freezes}`;
        
        // Calculate level and XP (include bonusXP from admin)
        const bonusXP = localStats.bonusXP || 0;
        const xp = stats.totalWords * 10 + stats.masteredWords * 50 + stats.streak * 5 + bonusXP;
        const levels = [
            { level: 1, name: 'Người học mới', minXP: 0 },
            { level: 2, name: 'Học viên', minXP: 2000 },
            { level: 3, name: 'Sinh viên chăm chỉ', minXP: 5000 },
            { level: 4, name: 'Thành thạo', minXP: 10000 },
            { level: 5, name: 'Chuyên gia', minXP: 20000 },
            { level: 6, name: 'Cao thủ', minXP: 40000 },
            { level: 7, name: 'Bậc thầy', minXP: 80000 }
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
        
        // Render achievement badges
        Achievements.renderProfileBadges();
        
        // Render current animated badge and selector button
        const badgeContainer = document.getElementById('profileAnimatedBadge');
        if (badgeContainer) {
            const localStats = Storage.getStats();
            const userBadges = localStats.badges || {};
            const currentBadge = Badges.getSelectedBadge(userBadges, xp);
            
            if (currentBadge) {
                badgeContainer.innerHTML = `
                    <div class="current-badge-display">
                        ${Badges.renderBadge(currentBadge, 'large')}
                        <span class="badge-label">${currentBadge.name}</span>
                    </div>
                    <button class="btn-outline" onclick="App.openBadgeSelector()">🎨 Thay đổi</button>
                `;
            } else {
                badgeContainer.innerHTML = `
                    <div class="current-badge-display">
                        <span class="badge-icon">❌</span>
                        <span class="badge-label">Chưa chọn badge</span>
                    </div>
                    <button class="btn-outline" onclick="App.openBadgeSelector()">🎨 Chọn badge</button>
                `;
            }
        }
        
        // Show modal
        document.getElementById('profileModal').classList.add('active');
        
        // Logout button handler
        document.getElementById('profileLogoutBtn').onclick = async () => {
            document.getElementById('profileModal').classList.remove('active');
            await Auth.signOut();
        };
        
        // Color theme handlers
        const colorContainer = document.getElementById('themeColors');
        if (colorContainer) {
            colorContainer.querySelectorAll('.color-option').forEach(btn => {
                btn.onclick = () => {
                    this.setColorTheme(btn.dataset.color);
                };
            });
            // Update active state
            const currentColor = document.documentElement.getAttribute('data-color') || '';
            this.updateColorSelector(currentColor);
        }
    },
    
    // Open badge selector modal
    openBadgeSelector() {
        if (!Auth.isLoggedIn()) return;
        
        const localStats = Storage.getStats();
        const userBadges = localStats.badges || {};
        const stats = Stats.calculate();
        const bonusXP = localStats.bonusXP || 0;
        const xp = stats.totalWords * 10 + stats.masteredWords * 50 + stats.streak * 5 + bonusXP;
        
        // Create modal content
        const content = Badges.renderBadgeSelector(xp, userBadges);
        
        // Show in a simple modal
        const modal = document.getElementById('badgeSelectorModal');
        if (modal) {
            document.getElementById('badgeSelectorContent').innerHTML = content;
            modal.classList.add('active');
        } else {
            // Fallback: create modal dynamically
            const dynamicModal = document.createElement('div');
            dynamicModal.className = 'modal active';
            dynamicModal.id = 'badgeSelectorModal';
            dynamicModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🏷️ Chọn Badge Hiệu Ứng</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="modal-body" id="badgeSelectorContent">
                        ${content}
                    </div>
                </div>
            `;
            document.body.appendChild(dynamicModal);
            
            // Close on backdrop click
            dynamicModal.addEventListener('click', (e) => {
                if (e.target === dynamicModal) dynamicModal.remove();
            });
        }
    },
    
    // Edit display name - shows input in modal
    async editDisplayName() {
        if (!Auth.isLoggedIn()) return;
        
        const currentName = Auth.user.displayName || '';
        
        // Create inline edit
        const nameEl = document.getElementById('profileName');
        const originalContent = nameEl.innerHTML;
        
        nameEl.innerHTML = `
            <input type="text" id="nameEditInput" value="${currentName}" style="width: 150px; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
            <button onclick="App.saveDisplayName()" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" class="btn btn-primary">Lưu</button>
            <button onclick="App.cancelNameEdit('${currentName}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" class="btn btn-secondary">Hủy</button>
        `;
        
        document.getElementById('nameEditInput').focus();
    },
    
    // Save display name
    async saveDisplayName() {
        const input = document.getElementById('nameEditInput');
        const newName = input?.value?.trim();
        
        if (!newName) return;
        
        try {
            const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await updateProfile(Auth.user, { displayName: newName });
            
            if (FirebaseDB.initialized) {
                const { doc, updateDoc } = FirebaseDB.firestore;
                await updateDoc(doc(db, 'users', Auth.user.uid), {
                    displayName: newName
                });
            }
            
            document.getElementById('profileName').textContent = newName;
            document.getElementById('userName').textContent = newName;
            
            this.showToast('Đã cập nhật tên', 'success');
        } catch (error) {
            console.error('Update name error:', error);
            this.showToast('Lỗi cập nhật tên', 'error');
        }
    },
    
    // Cancel name edit
    cancelNameEdit(originalName) {
        document.getElementById('profileName').textContent = originalName;
    },
    
    // Upload avatar from file
    async uploadAvatar(input) {
        if (!Auth.isLoggedIn() || !input.files || !input.files[0]) return;
        
        const file = input.files[0];
        
        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            this.showToast('Ảnh quá lớn (tối đa 2MB)', 'warning');
            return;
        }
        
        // Check if user is blocked
        if (Security.isBlocked()) {
            this.showToast('Bạn đang bị tạm khóa do hoạt động bất thường', 'error');
            return;
        }
        
        // Rate limiting for avatar uploads
        if (!Security.isAllowed('avatar_upload')) {
            this.showToast('Bạn đang tải ảnh quá nhanh, vui lòng chờ', 'warning');
            return;
        }
        
        try {
            this.showToast('Đang tải ảnh...', 'success');
            
            // Import Firebase Storage
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
            const storage = getStorage();
            
            // Upload to user's folder
            const storageRef = ref(storage, `avatars/${Auth.user.uid}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            // Update Firebase Auth profile
            const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await updateProfile(Auth.user, { photoURL: downloadURL });
            
            // Update Firestore
            if (FirebaseDB.initialized) {
                const { doc, updateDoc } = FirebaseDB.firestore;
                await updateDoc(doc(db, 'users', Auth.user.uid), {
                    photoURL: downloadURL
                });
            }
            
            // Update UI
            document.getElementById('profileAvatar').src = downloadURL;
            document.getElementById('userAvatar').src = downloadURL;
            
            this.showToast('Đã cập nhật ảnh đại diện', 'success');
        } catch (error) {
            console.error('Upload avatar error:', error);
            this.showToast('Lỗi tải ảnh: ' + error.message, 'error');
        }
        
        // Clear input
        input.value = '';
    },
    
    // Show another user's profile
    async showUserProfile(userId) {
        if (!FirebaseDB.initialized) return;
        
        try {
            const { doc, getDoc } = FirebaseDB.firestore;
            const userDoc = await getDoc(doc(db, 'users', userId));
            
            if (!userDoc.exists()) {
                this.showToast('Không tìm thấy người dùng', 'error');
                return;
            }
            
            const user = userDoc.data();
            const badgeHtml = Badges.getBadgeHtml(user, 'medium');
            
            // Populate user profile modal
            document.getElementById('viewUserAvatar').src = user.photoURL || '';
            document.getElementById('viewUserName').innerHTML = (user.displayName || 'Unknown') + badgeHtml;
            document.getElementById('viewUserXP').textContent = user.xp || 0;
            document.getElementById('viewUserStreak').textContent = user.streak || 0;
            document.getElementById('viewUserWords').textContent = user.totalWords || 0;
            document.getElementById('viewUserMastered').textContent = user.masteredWords || 0;
            
            // Set button actions
            document.getElementById('viewUserMessageBtn').onclick = () => {
                // Close all modals
                document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
                PrivateChat.startConversation(userId);
            };
            
            document.getElementById('viewUserChallengeBtn').onclick = () => {
                document.getElementById('viewUserModal').classList.remove('active');
                Challenges.openCreateModal(userId);
            };
            
            // Hide buttons if viewing own profile
            const isOwn = userId === Auth.user?.uid;
            document.getElementById('viewUserActions').style.display = isOwn ? 'none' : 'flex';
            
            document.getElementById('viewUserModal').classList.add('active');
            
        } catch (error) {
            console.error('Show user profile error:', error);
            this.showToast('Lỗi tải thông tin người dùng', 'error');
        }
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
            
            // Show install button (header)
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.addEventListener('click', () => this.installPWA());
            }
            
            // Show install button (landing page)
            const pwaInstallBtn = document.getElementById('pwaInstallBtn');
            if (pwaInstallBtn) {
                pwaInstallBtn.style.display = 'inline-block';
                pwaInstallBtn.addEventListener('click', () => this.installPWA());
            }
            
            console.log('PWA install available');
        });
        
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            this.deferredPrompt = null;
            const installBtn = document.getElementById('installBtn');
            if (installBtn) installBtn.style.display = 'none';
            const pwaInstallBtn = document.getElementById('pwaInstallBtn');
            if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
            
            this.showToast('Ứng dụng đã được cài đặt! 🎉', 'success');
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
