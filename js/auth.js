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
                            // Check if streak should be reset (user missed days)
                            Stats.checkStreakOnLoad();
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
    },
    
    // ========================================
    // Email/Password Authentication
    // ========================================
    
    // Sign up with email and password
    async signUpWithEmail(email, password, displayName) {
        const submitBtn = document.querySelector('#emailRegisterForm button[type="submit"]');
        const originalText = submitBtn ? submitBtn.textContent : '';
        
        try {
            // Show loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Đang đăng ký...';
            }
            this.clearAuthError();
            
            const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const result = await createUserWithEmailAndPassword(this.auth, email, password);
            
            // Generate avatar URL from name using UI Avatars API
            const name = displayName || email.split('@')[0];
            const avatarUrl = this.generateAvatarUrl(name);
            
            // Update display name and photo URL
            await updateProfile(result.user, { 
                displayName: displayName || name,
                photoURL: avatarUrl
            });
            
            App.showToast(`Chào mừng, ${displayName || email}! 🎉`, 'success');
            this.closeEmailModal();
            return result.user;
        } catch (error) {
            console.error('Sign up error:', error);
            this.showAuthError(error);
            return null;
        } finally {
            // Reset button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    },
    
    // Generate avatar URL from name/email
    generateAvatarUrl(seed) {
        // Use DiceBear API - generates fun cartoon avatars
        // Available styles: adventurer, avataaars, bottts, fun-emoji, lorelei, micah, notionists, personas, pixel-art
        const styles = ['adventurer', 'avataaars', 'bottts', 'fun-emoji', 'lorelei', 'micah', 'notionists-neutral', 'pixel-art'];
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const encodedSeed = encodeURIComponent(seed);
        return `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${encodedSeed}&size=128`;
    },
    
    // Sign in with email and password
    async signInWithEmail(email, password) {
        const submitBtn = document.querySelector('#emailLoginForm button[type="submit"]');
        const originalText = submitBtn ? submitBtn.textContent : '';
        
        try {
            // Show loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Đang đăng nhập...';
            }
            this.clearAuthError();
            
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            App.showToast(`Xin chào, ${result.user.displayName || result.user.email}! 👋`, 'success');
            this.closeEmailModal();
            return result.user;
        } catch (error) {
            console.error('Sign in error:', error);
            this.showAuthError(error);
            return null;
        } finally {
            // Reset button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    },
    
    // Send password reset email
    async sendPasswordReset(email) {
        const submitBtn = document.querySelector('#forgotPasswordForm button[type="submit"]');
        const originalText = submitBtn ? submitBtn.textContent : '';
        
        try {
            // Show loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Đang gửi...';
            }
            this.clearAuthError();
            
            const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await sendPasswordResetEmail(this.auth, email);
            
            // Show success message in form
            this.showAuthSuccess(`Đã gửi email đặt lại mật khẩu đến ${email}! Kiểm tra hộp thư (và cả thư rác) của bạn.`);
            App.showToast('Đã gửi email đặt lại mật khẩu!', 'success');
            
            // Change button to go back
            if (submitBtn) {
                submitBtn.textContent = '✅ Đã gửi! Quay lại đăng nhập';
                submitBtn.onclick = () => this.showEmailLoginForm();
                submitBtn.type = 'button';
            }
        } catch (error) {
            console.error('Password reset error:', error);
            this.showAuthError(error);
            // Reset button on error
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    },
    
    // Show auth error messages in Vietnamese (inline + toast)
    showAuthError(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'Email này đã được đăng ký! Hãy thử đăng nhập hoặc dùng email khác.',
            'auth/invalid-email': 'Email không hợp lệ! Vui lòng kiểm tra lại.',
            'auth/operation-not-allowed': 'Đăng nhập email chưa được bật! Liên hệ admin.',
            'auth/weak-password': 'Mật khẩu quá yếu! Cần ít nhất 6 ký tự.',
            'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa! Liên hệ admin.',
            'auth/user-not-found': 'Không tìm thấy tài khoản với email này! Hãy đăng ký mới.',
            'auth/wrong-password': 'Sai mật khẩu! Vui lòng thử lại.',
            'auth/invalid-credential': 'Email hoặc mật khẩu không đúng!',
            'auth/too-many-requests': 'Quá nhiều lần thử! Vui lòng đợi vài phút.',
            'auth/network-request-failed': 'Lỗi kết nối mạng! Kiểm tra internet của bạn.',
        };
        const message = errorMessages[error.code] || `Lỗi: ${error.message}`;
        
        // Show inline error in modal
        this.showInlineMessage(message, 'error');
        
        // Also show toast
        App.showToast(message, 'error');
    },
    
    // Clear inline error message
    clearAuthError() {
        const errorDiv = document.getElementById('authInlineMessage');
        if (errorDiv) errorDiv.remove();
    },
    
    // Show success message inline
    showAuthSuccess(message) {
        this.showInlineMessage(message, 'success');
    },
    
    // Show inline message (error or success)
    showInlineMessage(message, type) {
        this.clearAuthError();
        
        const content = document.getElementById('emailAuthContent');
        if (!content) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.id = 'authInlineMessage';
        msgDiv.style.cssText = `
            padding: 0.75rem 1rem;
            border-radius: var(--radius-md);
            margin-bottom: 1rem;
            font-size: 0.875rem;
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            ${type === 'error' 
                ? 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);'
                : 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);'
            }
        `;
        msgDiv.innerHTML = `
            <span style="flex-shrink: 0;">${type === 'error' ? '⚠️' : '✅'}</span>
            <span>${message}</span>
        `;
        
        // Insert at the top of the content
        content.insertBefore(msgDiv, content.firstChild);
    },
    
    // Show email authentication modal
    showEmailAuthModal() {
        const existingModal = document.getElementById('emailAuthModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'emailAuthModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2 id="emailModalTitle">📧 Đăng nhập</h2>
                    <button class="btn-icon modal-close" aria-label="Đóng">✕</button>
                </div>
                <div id="emailAuthContent" style="padding: 1.5rem;">
                    <!-- Content will be inserted here -->
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Show login form by default
        this.showEmailLoginForm();
        
        // Close handlers
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeEmailModal());
        });
        modal.querySelector('.modal-overlay').addEventListener('click', () => this.closeEmailModal());
    },
    
    // Close email modal
    closeEmailModal() {
        const modal = document.getElementById('emailAuthModal');
        if (modal) modal.remove();
    },
    
    // Show login form
    showEmailLoginForm() {
        const title = document.getElementById('emailModalTitle');
        const content = document.getElementById('emailAuthContent');
        if (!content) return;
        
        if (title) title.textContent = '📧 Đăng nhập';
        content.innerHTML = `
            <form id="emailLoginForm">
                <div class="form-group" style="padding: 0; margin-bottom: 1rem;">
                    <label>Email</label>
                    <input type="email" id="loginEmail" required placeholder="email@example.com" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
                <div class="form-group" style="padding: 0; margin-bottom: 1rem;">
                    <label>Mật khẩu</label>
                    <input type="password" id="loginPassword" required placeholder="••••••••" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-bottom: 1rem;">Đăng nhập</button>
            </form>
            <div style="text-align: center; font-size: 0.875rem;">
                <a href="#" id="showForgotPassword" style="color: var(--accent-primary);">Quên mật khẩu?</a>
                <span style="margin: 0 0.5rem; color: var(--text-muted);">|</span>
                <a href="#" id="showRegister" style="color: var(--accent-primary);">Đăng ký mới</a>
            </div>
        `;
        
        // Form submit
        document.getElementById('emailLoginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            this.signInWithEmail(email, password);
        });
        
        // Navigation links
        document.getElementById('showForgotPassword').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPasswordForm();
        });
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });
    },
    
    // Show register form
    showRegisterForm() {
        const title = document.getElementById('emailModalTitle');
        const content = document.getElementById('emailAuthContent');
        if (!content) return;
        
        if (title) title.textContent = '📝 Đăng ký tài khoản';
        content.innerHTML = `
            <form id="emailRegisterForm">
                <div class="form-group" style="padding: 0; margin-bottom: 1rem;">
                    <label>Tên hiển thị</label>
                    <input type="text" id="registerName" required placeholder="Tên của bạn" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
                <div class="form-group" style="padding: 0; margin-bottom: 1rem;">
                    <label>Email</label>
                    <input type="email" id="registerEmail" required placeholder="email@example.com" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
                <div class="form-group" style="padding: 0; margin-bottom: 1rem;">
                    <label>Mật khẩu (ít nhất 6 ký tự)</label>
                    <input type="password" id="registerPassword" required minlength="6" placeholder="••••••••" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-bottom: 1rem;">Đăng ký</button>
            </form>
            <div style="text-align: center; font-size: 0.875rem;">
                <a href="#" id="backToLogin" style="color: var(--accent-primary);">← Quay lại đăng nhập</a>
            </div>
        `;
        
        // Form submit
        document.getElementById('emailRegisterForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            this.signUpWithEmail(email, password, name);
        });
        
        // Back link
        document.getElementById('backToLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showEmailLoginForm();
        });
    },
    
    // Show forgot password form
    showForgotPasswordForm() {
        const title = document.getElementById('emailModalTitle');
        const content = document.getElementById('emailAuthContent');
        if (!content) return;
        
        if (title) title.textContent = '🔑 Quên mật khẩu';
        content.innerHTML = `
            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                Nhập email của bạn để nhận link đặt lại mật khẩu.
            </p>
            <form id="forgotPasswordForm">
                <div class="form-group" style="padding: 0; margin-bottom: 1rem;">
                    <label>Email</label>
                    <input type="email" id="resetEmail" required placeholder="email@example.com" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-bottom: 1rem;">Gửi email đặt lại</button>
            </form>
            <div style="text-align: center; font-size: 0.875rem;">
                <a href="#" id="backToLogin2" style="color: var(--accent-primary);">← Quay lại đăng nhập</a>
            </div>
        `;
        
        // Form submit
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value;
            this.sendPasswordReset(email);
        });
        
        // Back link
        document.getElementById('backToLogin2').addEventListener('click', (e) => {
            e.preventDefault();
            this.showEmailLoginForm();
        });
    }
};
