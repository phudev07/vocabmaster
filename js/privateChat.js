/**
 * Private Chat Module - 1-1 messaging between users
 */

const PrivateChat = {
    conversations: [],
    currentConversation: null,
    messages: [],
    unsubscribe: null,
    
    // Get or create conversation with a user
    async startConversation(userId) {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) {
            App.showToast('Vui lòng đăng nhập', 'warning');
            return null;
        }
        
        const currentUid = Auth.user.uid;
        if (userId === currentUid) {
            App.showToast('Không thể chat với chính mình', 'error');
            return null;
        }
        
        try {
            const { collection, query, where, getDocs, addDoc, serverTimestamp } = FirebaseDB.firestore;
            
            // Check if conversation already exists
            const conversationsRef = collection(db, 'conversations');
            const q = query(conversationsRef, where('participants', 'array-contains', currentUid));
            const snapshot = await getDocs(q);
            
            let existingConv = null;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.participants.includes(userId)) {
                    existingConv = { id: doc.id, ...data };
                }
            });
            
            if (existingConv) {
                await this.openConversation(existingConv.id, userId);
                return existingConv.id;
            }
            
            // Create new conversation
            const docRef = await addDoc(conversationsRef, {
                participants: [currentUid, userId],
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                createdAt: serverTimestamp()
            });
            
            await this.openConversation(docRef.id, userId);
            return docRef.id;
            
        } catch (error) {
            console.error('Start conversation error:', error);
            App.showToast('Lỗi: ' + (error.message || 'Không thể tạo cuộc trò chuyện'), 'error');
            return null;
        }
    },
    
    // Fetch all conversations for current user
    async fetchConversations() {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) return [];
        
        try {
            const { collection, query, where, getDocs, orderBy, doc, getDoc } = FirebaseDB.firestore;
            
            const q = query(
                collection(db, 'conversations'),
                where('participants', 'array-contains', Auth.user.uid)
            );
            const snapshot = await getDocs(q);
            
            this.conversations = [];
            
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const otherUserId = data.participants.find(p => p !== Auth.user.uid);
                
                // Get other user's info
                let otherUser = { displayName: 'Unknown', photoURL: '' };
                try {
                    const userDoc = await getDoc(doc(db, 'users', otherUserId));
                    if (userDoc.exists()) {
                        otherUser = userDoc.data();
                    }
                } catch (e) {}
                
                this.conversations.push({
                    id: docSnap.id,
                    ...data,
                    otherUser: {
                        id: otherUserId,
                        name: otherUser.displayName || 'Unknown',
                        avatar: otherUser.photoURL || ''
                    },
                    lastMessageTime: data.lastMessageTime?.toDate() || new Date()
                });
            }
            
            // Sort by last message time
            this.conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
            
            return this.conversations;
        } catch (error) {
            console.error('Fetch conversations error:', error);
            return [];
        }
    },
    
    // Open a conversation
    async openConversation(conversationId, targetUserId = null) {
        this.currentConversation = conversationId;
        
        // Show chat view
        App.showView('privateChatView');
        
        // Start listening to messages
        this.listenToMessages(conversationId);
        
        // Update header with other user's name
        let conv = this.conversations.find(c => c.id === conversationId);
        
        // If not in conversations list, fetch user info
        if (!conv && targetUserId) {
            try {
                const { doc, getDoc } = FirebaseDB.firestore;
                const userDoc = await getDoc(doc(db, 'users', targetUserId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    conv = {
                        otherUser: {
                            id: targetUserId,
                            name: userData.displayName || 'Unknown',
                            avatar: userData.photoURL || ''
                        }
                    };
                }
            } catch (e) {
                console.error('Fetch user for chat error:', e);
            }
        }
        
        if (conv) {
            document.getElementById('privateChatTitle').textContent = conv.otherUser.name;
            document.getElementById('privateChatAvatar').src = conv.otherUser.avatar;
        }
    },
    
    // Listen to messages in a conversation
    listenToMessages(conversationId) {
        this.stopListening();
        
        try {
            const { collection, query, orderBy, limit, onSnapshot } = FirebaseDB.firestore;
            
            const q = query(
                collection(db, `conversations/${conversationId}/messages`),
                orderBy('timestamp', 'asc'),
                limit(100)
            );
            
            this.unsubscribe = onSnapshot(q, (snapshot) => {
                this.messages = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    this.messages.push({
                        id: doc.id,
                        ...data,
                        timestamp: data.timestamp?.toDate() || new Date()
                    });
                });
                
                this.renderMessages();
                this.scrollToBottom();
            });
            
        } catch (error) {
            console.error('Listen to messages error:', error);
        }
    },
    
    // Stop listening
    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    },
    
    // Send a message
    async sendMessage(text) {
        if (!this.currentConversation || !Auth.isLoggedIn()) return;
        if (!text || !text.trim()) return;
        
        // Check if user is blocked
        if (Security.isBlocked()) {
            App.showToast('Bạn đang bị tạm khóa do hoạt động bất thường', 'error');
            return;
        }
        
        // Rate limiting
        if (!Security.isAllowed('private_message')) {
            App.showToast('Bạn đang gửi tin nhắn quá nhanh, vui lòng chờ', 'warning');
            return;
        }
        
        // Sanitize input
        const sanitizedText = Security.sanitizeText(text.trim(), 500);
        if (!sanitizedText) return;
        
        try {
            const { collection, addDoc, serverTimestamp, doc, updateDoc } = FirebaseDB.firestore;
            
            // Add message
            await addDoc(collection(db, `conversations/${this.currentConversation}/messages`), {
                text: sanitizedText,
                senderId: Auth.user.uid,
                senderName: Auth.user.displayName,
                timestamp: serverTimestamp()
            });
            
            // Update conversation with last message
            await updateDoc(doc(db, 'conversations', this.currentConversation), {
                lastMessage: sanitizedText.substring(0, 50),
                lastMessageTime: serverTimestamp()
            });
            
            // Log activity for abuse detection
            Security.logActivity('private_message');
            
        } catch (error) {
            console.error('Send message error:', error);
            App.showToast('Lỗi gửi tin nhắn', 'error');
        }
    },
    
    // Render conversations list
    renderConversations() {
        const container = document.getElementById('conversationsList');
        if (!container) return;
        
        if (this.conversations.length === 0) {
            container.innerHTML = '<p class="empty-state">Chưa có cuộc trò chuyện nào</p>';
            return;
        }
        
        container.innerHTML = this.conversations.map(conv => `
            <div class="conversation-item" onclick="PrivateChat.openConversation('${conv.id}')">
                <img src="${conv.otherUser.avatar}" class="conversation-avatar" alt="">
                <div class="conversation-info">
                    <div class="conversation-name">${conv.otherUser.name}</div>
                    <div class="conversation-preview">${conv.lastMessage || 'Chưa có tin nhắn'}</div>
                </div>
                <div class="conversation-time">${this.formatTime(conv.lastMessageTime)}</div>
            </div>
        `).join('');
    },
    
    // Render messages
    renderMessages() {
        const container = document.getElementById('privateMessages');
        if (!container) return;
        
        if (this.messages.length === 0) {
            container.innerHTML = '<p class="empty-state">Bắt đầu cuộc trò chuyện!</p>';
            return;
        }
        
        const currentUid = Auth.user?.uid;
        
        container.innerHTML = this.messages.map(msg => `
            <div class="private-message ${msg.senderId === currentUid ? 'own' : ''}">
                <div class="private-bubble">
                    <div class="private-text">${this.escapeHtml(msg.text)}</div>
                    <div class="private-time">${this.formatMessageTime(msg.timestamp)}</div>
                </div>
            </div>
        `).join('');
    },
    
    // Scroll to bottom
    scrollToBottom() {
        const container = document.getElementById('privateMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    },
    
    // Format time for conversation list
    formatTime(date) {
        if (!date) return '';
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60 * 1000) return 'Vừa xong';
        if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' phút';
        if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' giờ';
        
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    },
    
    // Format time for messages
    formatMessageTime(date) {
        if (!date) return '';
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    },
    
    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Handle form submit
    handleSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('privateInput');
        if (input && input.value.trim()) {
            this.sendMessage(input.value);
            input.value = '';
        }
    },
    
    // Go back to inbox
    goBack() {
        this.stopListening();
        this.currentConversation = null;
        App.showView('inboxView');
        this.fetchConversations().then(() => this.renderConversations());
    },
    
    // Initialize
    init() {
        // Bind form submit
        const form = document.getElementById('privateForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        // Back button
        const backBtn = document.getElementById('privateChatBack');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goBack());
        }
        
        console.log('Private chat initialized');
    }
};
