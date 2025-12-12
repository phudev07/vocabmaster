/**
 * Chat Module - Global group chat with Firebase
 */

const Chat = {
    messages: [],
    unsubscribe: null,
    
    // Send a message
    async sendMessage(text) {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) {
            App.showToast('Vui lòng đăng nhập để chat', 'warning');
            return;
        }
        
        if (!text || text.trim() === '') return;
        
        // Check if user is blocked
        if (Security.isBlocked()) {
            App.showToast('Bạn đang bị tạm khóa do hoạt động bất thường', 'error');
            return;
        }
        
        // Rate limiting
        if (!Security.isAllowed('chat_message')) {
            App.showToast('Bạn đang gửi tin nhắn quá nhanh, vui lòng chờ', 'warning');
            return;
        }
        
        // Sanitize input
        const sanitizedText = Security.sanitizeText(text.trim(), 500);
        if (!sanitizedText) return;
        
        try {
            const { collection, addDoc, serverTimestamp } = FirebaseDB.firestore;
            
            // Get current user's badge info from localStorage
            const localStats = Storage.getStats();
            const userBadges = localStats.badges || {};
            const xp = (localStats.totalWords || 0) * 10 + (localStats.masteredWords || 0) * 50 + (localStats.streak || 0) * 5 + (localStats.bonusXP || 0);
            
            await addDoc(collection(db, 'chat'), {
                text: sanitizedText,
                userId: Auth.user.uid,
                userName: Auth.user.displayName || 'Người dùng',
                userAvatar: Auth.user.photoURL || '',
                xp: xp,
                badges: userBadges,
                timestamp: serverTimestamp()
            });
            
            // Log activity for abuse detection
            Security.logActivity('chat_message');
            
            console.log('Message sent');
        } catch (error) {
            console.error('Send message error:', error);
            App.showToast('Lỗi gửi tin nhắn', 'error');
        }
    },
    
    // Start real-time listener for messages
    startListening() {
        if (!FirebaseDB.initialized) return;
        if (this.unsubscribe) return; // Already listening
        
        try {
            const { collection, query, orderBy, limit, onSnapshot } = FirebaseDB.firestore;
            
            // Get last 100 messages, ordered by timestamp
            const q = query(
                collection(db, 'chat'),
                orderBy('timestamp', 'asc'),
                limit(100)
            );
            
            let isFirstLoad = true;
            
            this.unsubscribe = onSnapshot(q, (snapshot) => {
                const previousCount = this.messages.length;
                this.messages = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    this.messages.push({
                        id: doc.id,
                        text: data.text,
                        userId: data.userId,
                        userName: data.userName,
                        userAvatar: data.userAvatar,
                        timestamp: data.timestamp?.toDate() || new Date()
                    });
                });
                
                // Play sound for new messages (not on first load)
                if (!isFirstLoad && this.messages.length > previousCount) {
                    const lastMessage = this.messages[this.messages.length - 1];
                    if (lastMessage && typeof Notifications !== 'undefined') {
                        Notifications.checkNewMessage(lastMessage);
                    }
                }
                
                // Update chat badge for unread messages
                this.updateChatBadge();
                
                isFirstLoad = false;
                this.render();
                this.scrollToBottom();
            });
            
            console.log('Chat listening started');
        } catch (error) {
            console.error('Start listening error:', error);
        }
    },
    
    // Update chat badge for unread messages
    updateChatBadge() {
        if (!Auth.isLoggedIn()) return;
        
        const badge = document.getElementById('chatBadge');
        if (!badge) return;
        
        // Get last seen message ID from localStorage
        const lastSeenId = localStorage.getItem('lastSeenChatId');
        
        // Count messages after last seen (excluding own messages)
        let unreadCount = 0;
        let foundLastSeen = !lastSeenId; // If no lastSeen, count from start
        
        for (const msg of this.messages) {
            if (msg.id === lastSeenId) {
                foundLastSeen = true;
                continue;
            }
            if (foundLastSeen && msg.userId !== Auth.user.uid) {
                unreadCount++;
            }
        }
        
        // Update badge
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    },
    
    // Mark chat as seen (call when opening chat view)
    markChatAsSeen() {
        if (this.messages.length > 0) {
            const lastMessage = this.messages[this.messages.length - 1];
            localStorage.setItem('lastSeenChatId', lastMessage.id);
            this.updateChatBadge();
        }
    },
    
    // Stop listening
    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            console.log('Chat listening stopped');
        }
    },
    
    // Render messages
    render() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        if (this.messages.length === 0) {
            container.innerHTML = '<div class="chat-empty">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện! 💬</div>';
            return;
        }
        
        const currentUserId = Auth.isLoggedIn() ? Auth.user.uid : null;
        
        container.innerHTML = this.messages.map(msg => {
            const isOwn = msg.userId === currentUserId;
            const time = this.formatTime(msg.timestamp);
            
            // Get badge from Leaderboard.users (current data) instead of stored message data
            const leaderboardUser = Leaderboard.users.find(u => u.id === msg.userId);
            const badgeHtml = leaderboardUser ? Badges.getBadgeHtml(leaderboardUser, 'small') : '';
            
            // Check if user is admin (from Firestore, cannot be faked)
            const isAdmin = leaderboardUser?.isAdmin || false;
            const adminLabel = isAdmin ? '<span class="admin-label">Admin</span>' : '';
            
            return `
                <div class="chat-message ${isOwn ? 'own' : ''}" data-id="${msg.id}">
                    ${!isOwn ? `<img class="chat-avatar clickable-avatar" src="${msg.userAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(msg.userName)}&size=64`}" alt="${msg.userName}" onclick="App.showUserProfile('${msg.userId}')" title="Xem thông tin">` : ''}
                    <div class="chat-bubble">
                        ${!isOwn ? `<div class="chat-sender clickable-name" onclick="App.showUserProfile('${msg.userId}')">${msg.userName}${adminLabel}${badgeHtml}</div>` : ''}
                        <div class="chat-text">${this.escapeHtml(msg.text)}</div>
                        <div class="chat-meta">
                            <span class="chat-time">${time}</span>
                            ${isOwn ? `
                                <div class="chat-actions">
                                    <button class="chat-action-btn" onclick="Chat.editMessage('${msg.id}')" title="Sửa">✏️</button>
                                    <button class="chat-action-btn" onclick="Chat.deleteMessage('${msg.id}')" title="Xóa">🗑️</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Format timestamp
    formatTime(date) {
        if (!date) return '';
        const now = new Date();
        const diff = now - date;
        
        // Today: show time
        if (diff < 24 * 60 * 60 * 1000 && now.getDate() === date.getDate()) {
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        
        // This week: show day + time
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            return date.toLocaleDateString('vi-VN', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }
        
        // Older: show date
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    },
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Scroll to bottom of chat
    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    },
    
    // Currently editing message ID
    editingMessageId: null,
    
    // Edit a message - puts text in input for editing
    editMessage(messageId) {
        const msg = this.messages.find(m => m.id === messageId);
        if (!msg) return;
        
        const input = document.getElementById('chatInput');
        const form = document.getElementById('chatForm');
        const sendBtn = form.querySelector('button[type="submit"]');
        
        // Set input value to message text
        input.value = msg.text;
        input.focus();
        
        // Store editing state
        this.editingMessageId = messageId;
        
        // Change button text
        sendBtn.textContent = 'Sửa';
        sendBtn.classList.add('editing');
        
        // Add cancel button if not exists
        if (!document.getElementById('cancelEditBtn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancelEditBtn';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Hủy';
            cancelBtn.onclick = () => this.cancelEdit();
            form.appendChild(cancelBtn);
        }
    },
    
    // Cancel editing
    cancelEdit() {
        const input = document.getElementById('chatInput');
        const form = document.getElementById('chatForm');
        const sendBtn = form.querySelector('button[type="submit"]');
        const cancelBtn = document.getElementById('cancelEditBtn');
        
        input.value = '';
        this.editingMessageId = null;
        sendBtn.textContent = 'Gửi';
        sendBtn.classList.remove('editing');
        
        if (cancelBtn) cancelBtn.remove();
    },
    
    // Save edited message
    async saveEdit(newText) {
        if (!this.editingMessageId) return;
        
        // Check if user is blocked
        if (Security.isBlocked()) {
            App.showToast('Bạn đang bị tạm khóa do hoạt động bất thường', 'error');
            return;
        }
        
        // Sanitize input
        const sanitizedText = Security.sanitizeText(newText.trim(), 500);
        if (!sanitizedText) return;
        
        try {
            const { doc, updateDoc } = FirebaseDB.firestore;
            await updateDoc(doc(db, 'chat', this.editingMessageId), {
                text: sanitizedText,
                edited: true
            });
            App.showToast('Đã sửa tin nhắn', 'success');
        } catch (error) {
            console.error('Edit message error:', error);
            App.showToast('Lỗi sửa tin nhắn', 'error');
        }
        
        this.cancelEdit();
    },
    
    // Delete a message
    async deleteMessage(messageId) {
        try {
            const { doc, deleteDoc } = FirebaseDB.firestore;
            await deleteDoc(doc(db, 'chat', messageId));
            App.showToast('Đã xóa', 'success');
        } catch (error) {
            console.error('Delete message error:', error);
            App.showToast('Lỗi xóa tin nhắn', 'error');
        }
    },
    
    // Handle input submit
    handleSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        if (input && input.value.trim()) {
            if (this.editingMessageId) {
                // Save edit
                this.saveEdit(input.value);
            } else {
                // Send new message
                this.sendMessage(input.value);
                input.value = '';
            }
        }
    },
    
    // Initialize chat
    init() {
        // Bind form submit
        const form = document.getElementById('chatForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        // Start listening if logged in
        if (Auth.isLoggedIn()) {
            this.startListening();
        }
    }
};
