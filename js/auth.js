/**
 * Auth Module - Firebase Authentication with Google Sign-in
 */

const Auth = {
    user: null,
    initialized: false,
    auth: null,
    
    // Initialize Auth
    async init() {
        try {
            const { getAuth, onAuthStateChanged, GoogleAuthProvider, browserLocalPersistence, setPersistence, getRedirectResult } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            
            const firebaseConfig = {
                apiKey: "AIzaSyDBZz76elwCKWLtGRRiPntj4CFbmty9tmk",
                authDomain: "vocabmaster-4c784.firebaseapp.com",
                projectId: "vocabmaster-4c784",
                storageBucket: "vocabmaster-4c784.firebasestorage.app",
                messagingSenderId: "816895415090",
                appId: "1:816895415090:web:5fcf52a0ea39f49e6d3d2b"
            };
            
            // Use existing app or create new one (avoid duplicate initialization)
            let app;
            if (getApps().length === 0) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
            }
            
            this.auth = getAuth(app);
            this.provider = new GoogleAuthProvider();
            
            // Set persistence to LOCAL (important for PWA)
            try {
                await setPersistence(this.auth, browserLocalPersistence);
                console.log('Auth persistence set to LOCAL');
            } catch (persistenceError) {
                console.log('Persistence error (non-critical):', persistenceError);
            }
            
            // Handle redirect result FIRST before setting up listener
            // This is crucial for PWA/redirect-based login
            try {
                const result = await getRedirectResult(this.auth);
                if (result && result.user) {
                    console.log('Redirect login successful:', result.user.displayName);
                    // Show success toast after a short delay
                    setTimeout(() => {
                        if (typeof App !== 'undefined') {
                            App.showToast(`Xin chào, ${result.user.displayName}! 👋`, 'success');
                        }
                    }, 500);
                }
            } catch (redirectError) {
                console.log('No redirect result or error:', redirectError.code || redirectError.message);
            }
            
            // Listen for auth state changes
            return new Promise((resolve) => {
                onAuthStateChanged(this.auth, (user) => {
                    this.user = user;
                    this.initialized = true;
                    this.updateUI();
                    this.hideLoadingOverlay();
                    
                    if (user) {
                        console.log('User signed in:', user.displayName);
                        // Sync data for this user
                        FirebaseDB.setUserId(user.uid);
                        FirebaseDB.syncFromCloud().then(() => {
                            FirebaseDB.startRealtimeSync();
                            Stats.render();
                            Topics.render();
                        });
                    } else {
                        console.log('User signed out');
                        FirebaseDB.setUserId(null);
                    }
                    
                    resolve(user);
                });
            });
        } catch (error) {
            console.error('Auth init error:', error);
            this.initialized = true;
            return null;
        }
    },
    
    // Check if running as standalone PWA
    isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true ||
               document.referrer.includes('android-app://');
    },
    
    // Check if iOS
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },
    
    // Sign in with Google
    async signInWithGoogle() {
        try {
            // iOS PWA: Try popup first (sometimes works), fallback to instructions
            if (this.isStandalone() && this.isIOS()) {
                try {
                    const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                    const result = await signInWithPopup(this.auth, this.provider);
                    App.showToast(`Xin chào, ${result.user.displayName}! 👋`, 'success');
                    return result.user;
                } catch (iosError) {
                    console.log('iOS popup failed, showing instructions:', iosError.code);
                    this.showIOSLoginHelp();
                    return null;
                }
            }
            
            // Android PWA: Use redirect
            if (this.isStandalone()) {
                const { signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                await signInWithRedirect(this.auth, this.provider);
                return null;
            }
            
            // Regular browser: Use popup
            const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const result = await signInWithPopup(this.auth, this.provider);
            App.showToast(`Xin chào, ${result.user.displayName}! 👋`, 'success');
            return result.user;
        } catch (error) {
            console.error('Sign in error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                App.showToast('Đăng nhập bị hủy', 'warning');
            } else if (error.code === 'auth/popup-blocked') {
                // Fallback to redirect if popup is blocked
                const { signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                await signInWithRedirect(this.auth, this.provider);
            } else {
                App.showToast('Lỗi đăng nhập: ' + error.message, 'error');
            }
            return null;
        }
    },
    
    // Show iOS login help modal
    showIOSLoginHelp() {
        const existingModal = document.getElementById('iosLoginModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'iosLoginModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>🍎 Đăng nhập trên iOS</h2>
                    <button class="btn-icon modal-close" aria-label="Đóng">✕</button>
                </div>
                <div style="padding: 1.5rem;">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                        Do hạn chế của iOS, bạn cần đăng nhập qua Safari trước:
                    </p>
                    <ol style="padding-left: 1.25rem; line-height: 1.8; color: var(--text-primary);">
                        <li>Mở <strong>Safari</strong> và truy cập trang web này</li>
                        <li>Đăng nhập bằng Google trên Safari</li>
                        <li>Sau đó quay lại app này và <strong>làm mới trang</strong></li>
                    </ol>
                    <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
                        <button class="btn btn-secondary modal-close" style="flex: 1;">Đóng</button>
                        <button class="btn btn-primary" id="openInSafariBtn" style="flex: 1;">Mở Safari</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        
        // Open in Safari button
        document.getElementById('openInSafariBtn').addEventListener('click', () => {
            // Open current URL in Safari (will open outside PWA)
            window.open(window.location.href, '_blank');
            modal.remove();
        });
        
        // Close on overlay click
        modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    },
    
    // Sign out
    async signOut() {
        try {
            // Set user offline before signing out
            if (typeof Leaderboard !== 'undefined') {
                await Leaderboard.setOffline();
                Leaderboard.stopHeartbeat();
            }
            
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signOut(this.auth);
            
            // Clear local storage
            localStorage.clear();
            
            App.showToast('Đã đăng xuất', 'success');
            
            // Refresh page to reset state
            location.reload();
        } catch (error) {
            console.error('Sign out error:', error);
            App.showToast('Lỗi đăng xuất', error);
        }
    },
    
    // Hide loading overlay
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },
    
    // Update UI based on auth state
    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const landingPage = document.getElementById('landingPage');
        const appContainer = document.getElementById('appContainer');
        
        // Always hide header login button (landing page has its own)
        if (loginBtn) loginBtn.style.display = 'none';
        
        if (this.user) {
            // Logged in - Show app, hide landing
            if (userInfo) userInfo.style.display = 'flex';
            if (userName) userName.textContent = this.user.displayName || 'User';
            if (userAvatar) userAvatar.src = this.user.photoURL || '';
            if (landingPage) landingPage.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';
        } else {
            // Logged out - Show landing, hide app
            if (userInfo) userInfo.style.display = 'none';
            if (landingPage) landingPage.style.display = 'block';
            if (appContainer) appContainer.style.display = 'none';
        }
    },
    
    // Check if user is logged in
    isLoggedIn() {
        return !!this.user;
    },
    
    // Get current user ID
    getUserId() {
        return this.user ? this.user.uid : null;
    }
};
