/**
 * Leaderboard Module - Fetches and displays top users
 */

const Leaderboard = {
    users: [],
    
    // Fetch all users from Firestore
    async fetchUsers() {
        if (!FirebaseDB.initialized) return [];
        
        try {
            const { collection, getDocs } = FirebaseDB.firestore;
            const snapshot = await getDocs(collection(db, 'users'));
            const users = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                users.push({
                    id: doc.id,
                    name: data.displayName || 'Người dùng',
                    avatar: data.photoURL || '',
                    xp: data.xp || 0,
                    totalWords: data.totalWords || 0,
                    streak: data.streak || 0,
                    lastActive: data.lastActive || null,
                    badges: data.badges || {},
                    isAdmin: data.isAdmin || false
                });
            });
            
            // Sort by XP descending
            users.sort((a, b) => b.xp - a.xp);
            this.users = users;
            
            return users;
        } catch (error) {
            console.error('Fetch users error:', error);
            return [];
        }
    },
    
    // Update current user's profile
    async updateUserProfile() {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) return;
        
        try {
            const { doc, setDoc, getDoc } = FirebaseDB.firestore;
            const stats = Stats.calculate();
            const localStats = Storage.getStats();
            const bonusXP = localStats.bonusXP || 0;
            const xp = stats.totalWords * 10 + stats.masteredWords * 50 + stats.streak * 5 + bonusXP;
            
            await setDoc(doc(db, 'users', Auth.user.uid), {
                displayName: Auth.user.displayName,
                photoURL: Auth.user.photoURL,
                email: Auth.user.email,
                xp: xp,
                bonusXP: bonusXP,
                totalWords: stats.totalWords,
                masteredWords: stats.masteredWords,
                streak: stats.streak,
                lastActive: new Date().toISOString()
            }, { merge: true });
            
            console.log('User profile updated');
        } catch (error) {
            console.error('Update user profile error:', error);
        }
    },
    
    // Heartbeat interval ID
    heartbeatInterval: null,
    
    // Start heartbeat - updates lastActive every 2 minutes
    startHeartbeat() {
        if (this.heartbeatInterval) return;
        
        // Update immediately
        this.updateLastActive();
        
        // Then every 2 minutes
        this.heartbeatInterval = setInterval(() => {
            this.updateLastActive();
        }, 2 * 60 * 1000);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.setOffline();
        });
        
        console.log('Heartbeat started');
    },
    
    // Stop heartbeat
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('Heartbeat stopped');
        }
    },
    
    // Update only lastActive (lightweight)
    async updateLastActive() {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) return;
        
        try {
            const { doc, updateDoc } = FirebaseDB.firestore;
            await updateDoc(doc(db, 'users', Auth.user.uid), {
                lastActive: new Date().toISOString()
            });
        } catch (error) {
            // Ignore errors for heartbeat
        }
    },
    
    // Set user as offline (set lastActive to past)
    async setOffline() {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) return;
        
        try {
            const { doc, updateDoc } = FirebaseDB.firestore;
            // Set lastActive to 10 minutes ago so they appear offline immediately
            const offlineTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            await updateDoc(doc(db, 'users', Auth.user.uid), {
                lastActive: offlineTime
            });
            console.log('User set offline');
        } catch (error) {
            console.error('Set offline error:', error);
        }
    },
    
    // Get online users count (active in last 5 minutes)
    getOnlineCount() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        return this.users.filter(u => u.lastActive && u.lastActive > fiveMinutesAgo).length;
    },
    
    // Render leaderboard on landing page
    renderLandingLeaderboard() {
        const container = document.getElementById('landingLeaderboard');
        if (!container) return;
        
        const topUsers = this.users.slice(0, 10);
        
        if (topUsers.length === 0) {
            container.innerHTML = '<div class="leaderboard-loading">Chưa có dữ liệu</div>';
            return;
        }
        
        container.innerHTML = topUsers.map((user, index) => {
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            
            return `
                <div class="leaderboard-item" onclick="App.showUserProfile('${user.id}')" style="cursor: pointer;">
                    <span class="leaderboard-rank ${rankClass}">${rankIcon}</span>
                    <img class="leaderboard-avatar" src="${user.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}&size=64`}" alt="">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${Security.sanitizeText(user.name, 50)}${Badges.getBadgeHtml(user, 'small')}</div>
                        <div class="leaderboard-xp">${user.xp} XP • ${user.totalWords} từ • 🔥${user.streak}</div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Render dashboard leaderboard (sidebar or section)
    renderDashboardLeaderboard() {
        const container = document.getElementById('dashboardLeaderboard');
        if (!container) return;
        
        const topUsers = this.users.slice(0, 5);
        
        if (topUsers.length === 0) {
            container.innerHTML = '<div class="leaderboard-loading">Chưa có dữ liệu</div>';
            return;
        }
        
        container.innerHTML = topUsers.map((user, index) => {
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            const isCurrentUser = Auth.isLoggedIn() && user.id === Auth.user.uid;
            
            return `
                <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}" onclick="App.showUserProfile('${user.id}')" style="cursor: pointer;">
                    <span class="leaderboard-rank">${rankIcon}</span>
                    <img class="leaderboard-avatar" src="${user.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}&size=64`}" alt="">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${Security.sanitizeText(user.name, 50)}${Badges.getBadgeHtml(user, 'small')}${isCurrentUser ? ' (Bạn)' : ''}</div>
                        <div class="leaderboard-xp">${user.xp} XP</div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Update global stats on landing page
    updateGlobalStats() {
        const totalUsers = this.users.length;
        const totalWords = this.users.reduce((sum, u) => sum + u.totalWords, 0);
        const onlineCount = this.getOnlineCount();
        
        const usersEl = document.getElementById('globalUsers');
        const wordsEl = document.getElementById('globalWords');
        const onlineEl = document.getElementById('globalOnline');
        
        if (usersEl) usersEl.textContent = totalUsers;
        if (wordsEl) wordsEl.textContent = totalWords;
        if (onlineEl) onlineEl.textContent = onlineCount;
    },
    
    // Render online users on dashboard
    renderDashboardOnline() {
        const container = document.getElementById('dashboardOnlineUsers');
        const countEl = document.getElementById('dashboardOnlineCount');
        if (!container) return;
        
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const onlineUsers = this.users.filter(u => u.lastActive && u.lastActive > fiveMinutesAgo);
        
        if (countEl) countEl.textContent = onlineUsers.length;
        
        if (onlineUsers.length === 0) {
            container.innerHTML = '<p class="empty-state">Không có ai đang online</p>';
            return;
        }
        
        container.innerHTML = onlineUsers.slice(0, 10).map(user => {
            const isCurrentUser = Auth.isLoggedIn() && user.id === Auth.user.uid;
            return `
                <div class="online-user ${isCurrentUser ? 'current-user' : ''}">
                    <span class="online-dot"></span>
                    <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}&size=64`}" alt="">
                    <span>${Security.sanitizeText(user.name, 50)}${isCurrentUser ? ' (Bạn)' : ''}</span>
                </div>
            `;
        }).join('');
    },
    
    // Real-time listener unsubscribe function
    unsubscribe: null,
    
    // Start real-time sync for users
    async startRealtimeUsers() {
        if (!FirebaseDB.initialized) return;
        
        try {
            const { collection, onSnapshot } = FirebaseDB.firestore;
            
            this.unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
                const users = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    users.push({
                        id: doc.id,
                        name: data.displayName || 'Người dùng',
                        avatar: data.photoURL || '',
                        xp: data.xp || 0,
                        totalWords: data.totalWords || 0,
                        streak: data.streak || 0,
                        lastActive: data.lastActive || null,
                        badges: data.badges || {},
                        isAdmin: data.isAdmin || false
                    });
                });
                
                // Sort by XP descending
                users.sort((a, b) => b.xp - a.xp);
                this.users = users;
                
                // Re-render all leaderboards
                this.renderLandingLeaderboard();
                this.updateGlobalStats();
                if (Auth.isLoggedIn()) {
                    this.renderDashboardLeaderboard();
                    this.renderDashboardOnline();
                }
                
                console.log('Users updated in real-time');
            });
            
            console.log('Real-time users sync started');
        } catch (error) {
            console.error('Start realtime users error:', error);
        }
    },
    
    // Stop real-time sync
    stopRealtimeUsers() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            console.log('Real-time users sync stopped');
        }
    },
    
    // Initialize leaderboard (call from app.js)
    async init() {
        await this.fetchUsers();
        this.renderLandingLeaderboard();
        this.updateGlobalStats();
        
        // Update current user's profile if logged in
        if (Auth.isLoggedIn()) {
            await this.updateUserProfile();
            this.renderDashboardLeaderboard();
            this.renderDashboardOnline();
            this.startHeartbeat();
        }
        
        // Start real-time sync
        this.startRealtimeUsers();
        
        // Bind view all button
        const viewAllBtn = document.getElementById('viewAllLeaderboardBtn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => this.showFullLeaderboard());
        }
    },
    
    // Show full leaderboard modal
    showFullLeaderboard() {
        // Remove existing modal
        const existing = document.getElementById('fullLeaderboardModal');
        if (existing) existing.remove();
        
        // Find current user's rank
        let currentUserRank = -1;
        if (Auth.isLoggedIn()) {
            currentUserRank = this.users.findIndex(u => u.id === Auth.user.uid);
        }
        
        const modal = document.createElement('div');
        modal.id = 'fullLeaderboardModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2>🏆 Bảng xếp hạng</h2>
                    <button class="btn-icon modal-close" aria-label="Đóng">✕</button>
                </div>
                <div style="padding: 1rem; max-height: 60vh; overflow-y: auto;">
                    ${currentUserRank >= 0 ? `
                        <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; text-align: center;">
                            <span style="font-size: 1.25rem;">🎯 Hạng của bạn: <strong>#${currentUserRank + 1}</strong> / ${this.users.length}</span>
                        </div>
                    ` : ''}
                    <div class="full-leaderboard-list">
                        ${this.users.map((user, index) => {
                            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
                            const isCurrentUser = Auth.isLoggedIn() && user.id === Auth.user.uid;
                            return `
                                <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}" onclick="App.showUserProfile('${user.id}')" style="cursor: pointer;">
                                    <span class="leaderboard-rank">${rankIcon}</span>
                                    <img class="leaderboard-avatar" src="${user.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}&size=64`}" alt="">
                                    <div class="leaderboard-info">
                                        <div class="leaderboard-name">${Security.sanitizeText(user.name, 50)}${Badges.getBadgeHtml(user, 'small')}${isCurrentUser ? ' (Bạn)' : ''}</div>
                                        <div class="leaderboard-xp">${user.xp} XP • ${user.totalWords} từ • 🔥${user.streak}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Set z-index lower than viewUserModal so user profile appears on top
        modal.style.zIndex = '1500';
        
        // Close handlers
        modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    }
};
