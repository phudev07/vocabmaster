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
            
            // Listen for auth state changes
            return new Promise((resolve) => {
                onAuthStateChanged(this.auth, (user) => {
                    this.user = user;
                    this.initialized = true;
                    this.updateUI();
                    
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
    
    // Sign in with Google
    async signInWithGoogle() {
        try {
            const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const result = await signInWithPopup(this.auth, this.provider);
            App.showToast(`Xin chào, ${result.user.displayName}! 👋`, 'success');
            return result.user;
        } catch (error) {
            console.error('Sign in error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                App.showToast('Đăng nhập bị hủy', 'warning');
            } else {
                App.showToast('Lỗi đăng nhập', 'error');
            }
            return null;
        }
    },
    
    // Sign out
    async signOut() {
        try {
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signOut(this.auth);
            
            // Clear local storage
            localStorage.clear();
            
            App.showToast('Đã đăng xuất', 'success');
            
            // Refresh page to reset state
            location.reload();
        } catch (error) {
            console.error('Sign out error:', error);
            App.showToast('Lỗi đăng xuất', 'error');
        }
    },
    
    // Update UI based on auth state
    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (this.user) {
            // Logged in
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (userName) userName.textContent = this.user.displayName || 'User';
            if (userAvatar) userAvatar.src = this.user.photoURL || '';
        } else {
            // Logged out
            if (loginBtn) loginBtn.style.display = 'flex';
            if (userInfo) userInfo.style.display = 'none';
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
