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
            const { getAuth, onAuthStateChanged, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            
            const firebaseConfig = {
                apiKey: "AIzaSyDBZz76elwCKWLtGRRiPntj4CFbmty9tmk",
                authDomain: "vocabmaster-4c784.firebaseapp.com",
                projectId: "vocabmaster-4c784",
                storageBucket: "vocabmaster-4c784.firebasestorage.app",
                messagingSenderId: "816895415090",
                appId: "1:816895415090:web:5fcf52a0ea39f49e6d3d2b"
            };
            
            const app = initializeApp(firebaseConfig, 'auth-app');
            this.auth = getAuth(app);
            this.provider = new GoogleAuthProvider();
            
            // Handle redirect result (for PWA/iOS)
            const { getRedirectResult } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            try {
                const result = await getRedirectResult(this.auth);
                if (result && result.user) {
                    console.log('Redirect login successful:', result.user.displayName);
                }
            } catch (redirectError) {
                console.log('No redirect result or error:', redirectError);
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
    
    // Sign in with Google
    async signInWithGoogle() {
        try {
            // Use redirect for PWA/iOS standalone mode (popup doesn't work)
            if (this.isStandalone()) {
                const { signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                await signInWithRedirect(this.auth, this.provider);
                return null; // Will redirect, so no result here
            } else {
                // Use popup for regular browser
                const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                const result = await signInWithPopup(this.auth, this.provider);
                App.showToast(`Xin chào, ${result.user.displayName}! 👋`, 'success');
                return result.user;
            }
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
