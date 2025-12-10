/**
 * Admin Module - Admin panel for user and message management
 */

const Admin = {
    // Admin UID (first admin - you can manually add more via Firebase Console)
    ADMIN_UID: 'clYviws6fuMcSEG1oG4g6yExG3j2',
    
    users: [],
    messages: [],
    selectedUser: null,
    
    // Check if current user is admin
    async isAdmin() {
        if (!Auth.isLoggedIn()) return false;
        
        // Check isAdmin field in user document
        try {
            const { doc, getDoc } = FirebaseDB.firestore;
            const userDoc = await getDoc(doc(db, 'users', Auth.user.uid));
            if (userDoc.exists() && userDoc.data().isAdmin === true) {
                return true;
            }
        } catch (error) {
            console.error('Check admin error:', error);
        }
        
        return false;
    },
    
    // Fetch all users
    async fetchAllUsers() {
        if (!FirebaseDB.initialized) return [];
        
        try {
            const { collection, getDocs, orderBy, query } = FirebaseDB.firestore;
            const q = query(collection(db, 'users'), orderBy('xp', 'desc'));
            const snapshot = await getDocs(q);
            
            this.users = [];
            snapshot.forEach(doc => {
                this.users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return this.users;
        } catch (error) {
            console.error('Fetch users error:', error);
            return [];
        }
    },
    
    // Fetch all chat messages
    async fetchAllMessages() {
        if (!FirebaseDB.initialized) return [];
        
        try {
            const { collection, getDocs, orderBy, query } = FirebaseDB.firestore;
            const q = query(collection(db, 'chat'), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            
            this.messages = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.messages.push({
                    id: doc.id,
                    text: data.text,
                    userId: data.userId,
                    userName: data.userName,
                    timestamp: data.timestamp?.toDate() || new Date()
                });
            });
            
            return this.messages;
        } catch (error) {
            console.error('Fetch messages error:', error);
            return [];
        }
    },
    
    // Update user data
    async updateUser(uid, data) {
        try {
            const { doc, updateDoc } = FirebaseDB.firestore;
            await updateDoc(doc(db, 'users', uid), data);
            App.showToast('Đã cập nhật user', 'success');
            return true;
        } catch (error) {
            console.error('Update user error:', error);
            App.showToast('Lỗi cập nhật user', 'error');
            return false;
        }
    },
    
    // Delete user (marks as deleted, doesn't actually delete auth)
    async deleteUser(uid) {
        try {
            const { doc, deleteDoc, collection, getDocs } = FirebaseDB.firestore;
            
            // Delete user's topics
            const topicsSnap = await getDocs(collection(db, `users/${uid}/topics`));
            for (const topicDoc of topicsSnap.docs) {
                await deleteDoc(doc(db, `users/${uid}/topics/${topicDoc.id}`));
            }
            
            // Delete user's words
            const wordsSnap = await getDocs(collection(db, `users/${uid}/words`));
            for (const wordDoc of wordsSnap.docs) {
                await deleteDoc(doc(db, `users/${uid}/words/${wordDoc.id}`));
            }
            
            // Delete user's settings
            try {
                await deleteDoc(doc(db, `users/${uid}/settings/main`));
            } catch (e) {}
            
            // Delete user document
            await deleteDoc(doc(db, 'users', uid));
            
            App.showToast('Đã xóa user', 'success');
            return true;
        } catch (error) {
            console.error('Delete user error:', error);
            App.showToast('Lỗi xóa user', 'error');
            return false;
        }
    },
    
    // Delete chat message
    async deleteMessage(messageId) {
        try {
            const { doc, deleteDoc } = FirebaseDB.firestore;
            await deleteDoc(doc(db, 'chat', messageId));
            App.showToast('Đã xóa tin nhắn', 'success');
            return true;
        } catch (error) {
            console.error('Delete message error:', error);
            App.showToast('Lỗi xóa tin nhắn', 'error');
            return false;
        }
    },
    
    // Get user's topics
    async getUserTopics(uid) {
        try {
            const { collection, getDocs } = FirebaseDB.firestore;
            const snapshot = await getDocs(collection(db, `users/${uid}/topics`));
            
            const topics = [];
            snapshot.forEach(doc => {
                topics.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return topics;
        } catch (error) {
            console.error('Get user topics error:', error);
            return [];
        }
    },
    
    // Get user's words
    async getUserWords(uid) {
        try {
            const { collection, getDocs } = FirebaseDB.firestore;
            const snapshot = await getDocs(collection(db, `users/${uid}/words`));
            
            const words = [];
            snapshot.forEach(doc => {
                words.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return words;
        } catch (error) {
            console.error('Get user words error:', error);
            return [];
        }
    },
    
    // Delete user's topic
    async deleteUserTopic(uid, topicId) {
        try {
            const { doc, deleteDoc, collection, getDocs, query, where } = FirebaseDB.firestore;
            
            // Delete all words in this topic
            const wordsSnap = await getDocs(collection(db, `users/${uid}/words`));
            for (const wordDoc of wordsSnap.docs) {
                if (wordDoc.data().topicId === topicId) {
                    await deleteDoc(doc(db, `users/${uid}/words/${wordDoc.id}`));
                }
            }
            
            // Delete topic
            await deleteDoc(doc(db, `users/${uid}/topics/${topicId}`));
            
            App.showToast('Đã xóa topic', 'success');
            return true;
        } catch (error) {
            console.error('Delete topic error:', error);
            App.showToast('Lỗi xóa topic', 'error');
            return false;
        }
    },
    
    // Render users tab
    renderUsers() {
        const container = document.getElementById('adminUsersList');
        if (!container) return;
        
        if (this.users.length === 0) {
            container.innerHTML = '<p class="empty-state">Không có user nào</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Avatar</th>
                        <th>Tên</th>
                        <th>Email</th>
                        <th>XP</th>
                        <th>Streak</th>
                        <th>Freeze</th>
                        <th>Admin</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.users.map(user => `
                        <tr data-uid="${user.id}">
                            <td><img src="${user.photoURL || ''}" class="admin-avatar" alt=""></td>
                            <td>${user.displayName || 'N/A'}</td>
                            <td>${user.email || 'N/A'}</td>
                            <td>${user.xp || 0}</td>
                            <td>${user.streak || 0}</td>
                            <td>${user.freezeCount || 0}</td>
                            <td>${user.isAdmin ? '✅' : ''}</td>
                            <td class="admin-actions">
                                <button class="btn-icon" onclick="Admin.openEditUser('${user.id}')" title="Sửa">✏️</button>
                                <button class="btn-icon" onclick="Admin.openUserData('${user.id}')" title="Xem data">📁</button>
                                <button class="btn-icon" onclick="Admin.confirmDeleteUser('${user.id}')" title="Xóa">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },
    
    // Render messages tab
    renderMessages() {
        const container = document.getElementById('adminMessagesList');
        if (!container) return;
        
        if (this.messages.length === 0) {
            container.innerHTML = '<p class="empty-state">Không có tin nhắn nào</p>';
            return;
        }
        
        container.innerHTML = this.messages.map(msg => `
            <div class="admin-message" data-id="${msg.id}">
                <div class="admin-message-info">
                    <strong>${msg.userName}</strong>
                    <span class="admin-message-time">${msg.timestamp.toLocaleString('vi-VN')}</span>
                </div>
                <div class="admin-message-text">${msg.text}</div>
                <button class="btn-icon admin-message-delete" onclick="Admin.confirmDeleteMessage('${msg.id}')">🗑️</button>
            </div>
        `).join('');
    },
    
    // Open edit user modal
    openEditUser(uid) {
        const user = this.users.find(u => u.id === uid);
        if (!user) return;
        
        this.selectedUser = user;
        
        document.getElementById('editUserName').value = user.displayName || '';
        document.getElementById('editUserXP').value = user.xp || 0;
        document.getElementById('editUserStreak').value = user.streak || 0;
        document.getElementById('editUserFreeze').value = user.freezeCount || 0;
        document.getElementById('editUserAdmin').checked = user.isAdmin || false;
        
        document.getElementById('editUserModal').classList.add('active');
    },
    
    // Save user edit
    async saveUserEdit() {
        if (!this.selectedUser) return;
        
        const data = {
            displayName: document.getElementById('editUserName').value.trim(),
            xp: parseInt(document.getElementById('editUserXP').value) || 0,
            streak: parseInt(document.getElementById('editUserStreak').value) || 0,
            freezeCount: parseInt(document.getElementById('editUserFreeze').value) || 0,
            isAdmin: document.getElementById('editUserAdmin').checked
        };
        
        const success = await this.updateUser(this.selectedUser.id, data);
        
        if (success) {
            document.getElementById('editUserModal').classList.remove('active');
            await this.fetchAllUsers();
            this.renderUsers();
        }
    },
    
    // Open user data modal (topics/words)
    async openUserData(uid) {
        const user = this.users.find(u => u.id === uid);
        if (!user) return;
        
        this.selectedUser = user;
        
        document.getElementById('userDataTitle').textContent = `Data của ${user.displayName || 'User'}`;
        
        const topics = await this.getUserTopics(uid);
        const words = await this.getUserWords(uid);
        
        const container = document.getElementById('userDataContent');
        
        if (topics.length === 0 && words.length === 0) {
            container.innerHTML = '<p class="empty-state">User chưa có data</p>';
        } else {
            container.innerHTML = `
                <h4>📁 Topics (${topics.length})</h4>
                <div class="user-data-list">
                    ${topics.map(t => `
                        <div class="user-data-item">
                            <span>${t.icon || '📁'} ${t.name}</span>
                            <button class="btn-icon" onclick="Admin.deleteTopicConfirm('${uid}', '${t.id}')">🗑️</button>
                        </div>
                    `).join('') || '<p>Chưa có topic</p>'}
                </div>
                
                <h4>📝 Words (${words.length})</h4>
                <div class="user-data-list" style="max-height: 200px; overflow-y: auto;">
                    ${words.slice(0, 50).map(w => `
                        <div class="user-data-item">
                            <span><strong>${w.english}</strong> - ${w.vietnamese}</span>
                        </div>
                    `).join('') || '<p>Chưa có từ</p>'}
                    ${words.length > 50 ? `<p class="text-muted">...và ${words.length - 50} từ khác</p>` : ''}
                </div>
            `;
        }
        
        document.getElementById('userDataModal').classList.add('active');
    },
    
    // Confirm delete user
    confirmDeleteUser(uid) {
        const user = this.users.find(u => u.id === uid);
        if (!user) return;
        
        if (confirm(`Bạn có chắc muốn xóa user "${user.displayName}"?\nTất cả data của user sẽ bị xóa!`)) {
            this.deleteUser(uid).then(() => {
                this.fetchAllUsers().then(() => this.renderUsers());
            });
        }
    },
    
    // Confirm delete message
    confirmDeleteMessage(messageId) {
        this.deleteMessage(messageId).then(() => {
            this.fetchAllMessages().then(() => this.renderMessages());
        });
    },
    
    // Confirm delete topic
    deleteTopicConfirm(uid, topicId) {
        if (confirm('Xóa topic này và tất cả từ vựng trong đó?')) {
            this.deleteUserTopic(uid, topicId).then(() => {
                this.openUserData(uid);
            });
        }
    },
    
    // Switch admin tab
    switchTab(tab) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        
        document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).classList.add('active');
        
        if (tab === 'users') {
            this.fetchAllUsers().then(() => this.renderUsers());
        } else if (tab === 'messages') {
            this.fetchAllMessages().then(() => this.renderMessages());
        }
    },
    
    // Initialize admin panel
    async init() {
        const isAdmin = await this.isAdmin();
        
        // Show/hide admin nav item
        const adminNav = document.getElementById('adminNavItem');
        if (adminNav) {
            adminNav.style.display = isAdmin ? 'flex' : 'none';
        }
        
        if (!isAdmin) return;
        
        // Bind tab clicks
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
        
        // Bind edit user form
        const editForm = document.getElementById('editUserForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveUserEdit();
            });
        }
        
        console.log('Admin panel initialized');
    }
};
