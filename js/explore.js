/**
 * Explore Module - Browse and import public topics from other users
 */

const Explore = {
    topics: [],
    searchQuery: '',

    // Initialize
    init() {
        this.bindEvents();
    },

    // Bind events
    bindEvents() {
        const searchInput = document.getElementById('exploreSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.render();
            });
        }
    },

    // Fetch public topics from Firestore
    async fetchPublicTopics() {
        if (!FirebaseDB.initialized) return [];
        
        try {
            const { collection, getDocs } = FirebaseDB.firestore;
            const snapshot = await getDocs(collection(db, 'publicTopics'));
            
            const topics = [];
            snapshot.forEach(doc => {
                topics.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Sort by createdAt in JS (no index needed)
            topics.sort((a, b) => {
                const aTime = a.createdAt?.toDate?.() || new Date(0);
                const bTime = b.createdAt?.toDate?.() || new Date(0);
                return bTime - aTime;
            });
            
            this.topics = topics;
            console.log('Fetched public topics:', topics.length);
            return topics;
        } catch (error) {
            console.error('Fetch public topics error:', error);
            return [];
        }
    },

    // Publish a topic to public
    async publishTopic(topicId) {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) return;
        
        try {
            const topic = Storage.getTopicById(topicId);
            if (!topic) return;
            
            const words = Storage.getWordsByTopic(topicId);
            
            const { doc, setDoc, serverTimestamp } = FirebaseDB.firestore;
            
            await setDoc(doc(db, 'publicTopics', topicId), {
                topicId: topicId,
                userId: Auth.user.uid,
                userName: Auth.user.displayName || 'Người dùng',
                userAvatar: Auth.user.photoURL || '',
                topicName: topic.name,
                topicIcon: topic.icon,
                topicColor: topic.color,
                wordsCount: words.length,
                importCount: 0,
                createdAt: serverTimestamp(),
                words: words.map(w => ({
                    english: w.english,
                    vietnamese: w.vietnamese
                }))
            });
            
            console.log('Topic published:', topicId);
        } catch (error) {
            console.error('Publish topic error:', error);
        }
    },

    // Unpublish a topic (make private)
    async unpublishTopic(topicId) {
        if (!FirebaseDB.initialized) return;
        
        try {
            const { doc, deleteDoc } = FirebaseDB.firestore;
            await deleteDoc(doc(db, 'publicTopics', topicId));
            console.log('Topic unpublished:', topicId);
        } catch (error) {
            console.error('Unpublish topic error:', error);
        }
    },

    // Render explore view
    render() {
        const container = document.getElementById('exploreTopicsList');
        if (!container) return;
        
        let filteredTopics = this.topics;
        
        // Filter by search query
        if (this.searchQuery) {
            filteredTopics = filteredTopics.filter(t => 
                t.topicName.toLowerCase().includes(this.searchQuery) ||
                t.userName.toLowerCase().includes(this.searchQuery)
            );
        }
        
        if (filteredTopics.length === 0) {
            container.innerHTML = this.searchQuery 
                ? '<p class="empty-state">Không tìm thấy chủ đề phù hợp</p>'
                : '<p class="empty-state">Chưa có chủ đề nào được chia sẻ. Hãy là người đầu tiên! 📤</p>';
            return;
        }
        
        const currentUserId = Auth.isLoggedIn() ? Auth.user.uid : null;
        
        container.innerHTML = filteredTopics.map(topic => {
            const isOwn = topic.userId === currentUserId;
            const avatarUrl = topic.userAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(topic.userName)}&size=40`;
            
            return `
            <div class="explore-topic-card ${isOwn ? 'own-topic' : ''}">
                <div class="explore-topic-left">
                    <span class="explore-topic-icon" style="background: ${topic.topicColor}">${topic.topicIcon}</span>
                    <div class="explore-topic-info">
                        <h3 class="explore-topic-name">${topic.topicName}</h3>
                        <p class="explore-topic-meta">${topic.wordsCount} từ</p>
                    </div>
                </div>
                <div class="explore-topic-right">
                    <div class="explore-topic-user" onclick="Explore.filterByUser('${topic.userId}')" title="Xem các chủ đề của ${topic.userName}">
                        <img src="${avatarUrl}" class="explore-user-avatar" alt="">
                        <span class="explore-user-name">${isOwn ? 'Bạn' : topic.userName}</span>
                    </div>
                    <div class="explore-topic-actions">
                        <button class="btn-icon" onclick="Explore.previewTopic('${topic.id}')" title="Xem trước">👁️</button>
                        ${isOwn ? `
                            <button class="btn-icon btn-danger-icon" onclick="Explore.unpublishTopic('${topic.id}').then(() => { Explore.fetchPublicTopics().then(() => Explore.render()); App.showToast('Đã gỡ chia sẻ', 'success'); })" title="Gỡ chia sẻ">🗑️</button>
                        ` : `
                            <button class="btn-icon btn-primary-icon" onclick="Explore.importTopic('${topic.id}')" title="Import">📥</button>
                        `}
                    </div>
                </div>
            </div>
        `;
        }).join('');
    },

    // Filter topics by user
    filterByUser(userId) {
        // If already filtering, clear filter
        if (this.filterUserId === userId) {
            this.filterUserId = null;
            this.render();
            return;
        }
        
        this.filterUserId = userId;
        
        const container = document.getElementById('exploreTopicsList');
        if (!container) return;
        
        const userTopics = this.topics.filter(t => t.userId === userId);
        const userName = userTopics[0]?.userName || 'Người dùng';
        const avatarUrl = userTopics[0]?.userAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(userName)}&size=40`;
        
        const currentUserId = Auth.isLoggedIn() ? Auth.user.uid : null;
        
        container.innerHTML = `
            <div class="explore-user-filter">
                <img src="${avatarUrl}" class="explore-filter-avatar">
                <span>Chủ đề của <strong>${userName}</strong></span>
                <button class="btn-icon" onclick="Explore.filterUserId = null; Explore.render();" title="Xóa bộ lọc">✕</button>
            </div>
            ${userTopics.map(topic => {
                const isOwn = topic.userId === currentUserId;
                return `
                <div class="explore-topic-card ${isOwn ? 'own-topic' : ''}">
                    <div class="explore-topic-left">
                        <span class="explore-topic-icon" style="background: ${topic.topicColor}">${topic.topicIcon}</span>
                        <div class="explore-topic-info">
                            <h3 class="explore-topic-name">${topic.topicName}</h3>
                            <p class="explore-topic-meta">${topic.wordsCount} từ</p>
                        </div>
                    </div>
                    <div class="explore-topic-actions">
                        <button class="btn-icon" onclick="Explore.previewTopic('${topic.id}')" title="Xem trước">👁️</button>
                        ${isOwn ? `
                            <button class="btn-icon btn-danger-icon" onclick="Explore.unpublishTopic('${topic.id}').then(() => { Explore.fetchPublicTopics().then(() => Explore.render()); App.showToast('Đã gỡ chia sẻ', 'success'); })" title="Gỡ chia sẻ">🗑️</button>
                        ` : `
                            <button class="btn-icon btn-primary-icon" onclick="Explore.importTopic('${topic.id}')" title="Import">📥</button>
                        `}
                    </div>
                </div>
            `;
            }).join('')}
        `;
    },

    filterUserId: null,

    // Preview a public topic
    async previewTopic(publicTopicId) {
        let topic = this.topics.find(t => t.id === publicTopicId);
        
        // Fetch from Firebase if not in cache
        if (!topic) {
            try {
                const { doc, getDoc } = FirebaseDB.firestore;
                const docSnap = await getDoc(doc(db, 'publicTopics', publicTopicId));
                if (docSnap.exists()) {
                    topic = { id: docSnap.id, ...docSnap.data() };
                    this.topics.push(topic); // Add to cache
                }
            } catch (e) {
                console.error('Fetch topic error:', e);
            }
        }
        
        if (!topic || !topic.words || topic.words.length === 0) {
            App.showToast('Không có từ vựng để xem', 'warning');
            return;
        }
        
        this.showPreviewModal(topic);
    },

    // Show preview modal (like study list)
    showPreviewModal(topic) {
        // Remove existing modal
        const existing = document.getElementById('topicPreviewModal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'topicPreviewModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2>${topic.topicIcon} ${topic.topicName}</h2>
                    <button class="btn-icon modal-close" aria-label="Đóng">✕</button>
                </div>
                <p style="padding: 0 1rem; color: var(--text-muted);">
                    ${topic.wordsCount} từ • bởi ${topic.userName}
                </p>
                <div class="study-list" style="padding: 1rem; max-height: 50vh; overflow-y: auto;">
                    ${topic.words.map((word, index) => `
                        <div class="study-word-row">
                            <span class="study-word-number">${index + 1}</span>
                            <button class="study-word-speak" onclick="Speech.speak('${this.escapeHtml(word.english)}')">🔊</button>
                            <span class="study-word-english">${this.escapeHtml(word.english)}</span>
                            <span class="study-word-vietnamese">${this.escapeHtml(word.vietnamese)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="form-actions preview-actions">
                    <button class="btn btn-secondary modal-close">Đóng</button>
                    <button class="btn btn-primary" id="importFromPreviewBtn">📥 Import</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close handlers
        modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        
        // Import button
        modal.querySelector('#importFromPreviewBtn').addEventListener('click', () => {
            modal.remove();
            this.importTopic(topic.id);
        });
    },

    // Import a topic to own collection
    async importTopic(publicTopicId) {
        if (!Auth.isLoggedIn()) {
            App.showToast('Vui lòng đăng nhập để import', 'error');
            return;
        }
        
        let topic = this.topics.find(t => t.id === publicTopicId);
        
        // Fetch from Firebase if not in cache
        if (!topic) {
            try {
                const { doc, getDoc } = FirebaseDB.firestore;
                const docSnap = await getDoc(doc(db, 'publicTopics', publicTopicId));
                if (docSnap.exists()) {
                    topic = { id: docSnap.id, ...docSnap.data() };
                    this.topics.push(topic);
                }
            } catch (e) {
                console.error('Fetch topic error:', e);
            }
        }
        
        if (!topic) {
            App.showToast('Không tìm thấy chủ đề', 'error');
            return;
        }
        
        // Create new topic
        const newTopic = {
            name: topic.topicName,
            icon: topic.topicIcon,
            color: topic.topicColor,
            isPublic: false
        };
        
        const savedTopic = await FirebaseDB.saveTopic(newTopic);
        
        // Add all words
        for (const word of topic.words) {
            const newWord = {
                english: word.english,
                vietnamese: word.vietnamese,
                topicId: savedTopic.id
            };
            await FirebaseDB.saveWord(newWord);
        }
        
        // Increment import count on the public topic
        try {
            const { doc, updateDoc, increment } = FirebaseDB.firestore;
            await updateDoc(doc(db, 'publicTopics', publicTopicId), {
                importCount: increment(1)
            });
        } catch (e) {
            console.log('Could not update import count');
        }
        
        // Refresh UI
        Topics.render();
        Stats.render();
        
        App.showToast(`Đã import "${topic.topicName}" với ${topic.words.length} từ!`, 'success');
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Current share type (public/private)
    shareType: 'public',

    // Open modal to select topic to share
    openShareModal(chatType = 'public') {
        if (!Auth.isLoggedIn()) {
            App.showToast('Vui lòng đăng nhập', 'warning');
            return;
        }
        
        this.shareType = chatType;
        
        const topics = Storage.getTopics();
        if (topics.length === 0) {
            App.showToast('Bạn chưa có chủ đề nào để chia sẻ', 'warning');
            return;
        }
        
        // Remove existing modal
        const existing = document.getElementById('shareTopicModal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'shareTopicModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📤 Chọn chủ đề để chia sẻ</h2>
                    <button class="btn-icon modal-close" aria-label="Đóng">✕</button>
                </div>
                <div style="padding: 1rem; max-height: 50vh; overflow-y: auto;">
                    ${topics.map(t => {
                        const wordCount = Storage.getWordCountByTopic(t.id);
                        return `
                            <div class="share-topic-item" onclick="Explore.shareToChat('${t.id}')" style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; border-radius: var(--radius-md); cursor: pointer; transition: var(--transition-fast);">
                                <span style="font-size: 1.5rem;">${t.icon}</span>
                                <div style="flex: 1;">
                                    <strong>${this.escapeHtml(t.name)}</strong>
                                    <span style="color: var(--text-muted); font-size: 0.85rem; margin-left: 0.5rem;">${wordCount} từ</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add hover effect
        modal.querySelectorAll('.share-topic-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-tertiary)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');
        });
        
        // Close handlers
        modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    },

    // Share topic via chat
    async shareToChat(topicId) {
        if (!Auth.isLoggedIn()) return;
        
        const topic = Storage.getTopicById(topicId);
        if (!topic) return;
        
        const words = Storage.getWordsByTopic(topicId);
        
        // Close modal
        const modal = document.getElementById('shareTopicModal');
        if (modal) modal.remove();
        
        // First publish to public if not already
        if (!topic.isPublic) {
            await this.publishTopic(topicId);
            // Update local topic
            topic.isPublic = true;
            Storage.saveTopic(topic);
        }
        
        // Build message text (simple format that won't be escaped)
        const shareText = `📚 Chia sẻ chủ đề: ${topic.icon} ${topic.name} (${words.length} từ)\n🔗 ID: ${topicId}`;
        
        if (this.shareType === 'public') {
            // Send to public chat using special format
            await this.sendTopicShareMessage(topicId, topic, words.length, 'public');
            App.showToast('Đã chia sẻ lên Chat cộng đồng!', 'success');
        } else if (this.shareType === 'private') {
            // Send to private chat
            if (!PrivateChat.currentConversation) {
                App.showToast('Vui lòng mở cuộc trò chuyện trước', 'warning');
                return;
            }
            await this.sendTopicShareMessage(topicId, topic, words.length, 'private');
            App.showToast('Đã chia sẻ trong tin nhắn!', 'success');
        }
    },

    // Send topic share message directly to Firestore (bypass sanitization)
    async sendTopicShareMessage(topicId, topic, wordsCount, chatType) {
        if (!FirebaseDB.initialized) return;
        
        try {
            const { collection, addDoc, serverTimestamp } = FirebaseDB.firestore;
            
            const messageData = {
                text: `[TOPIC_SHARE]${JSON.stringify({
                    type: 'topic_share',
                    topicId: topicId,
                    topicName: topic.name,
                    topicIcon: topic.icon,
                    wordsCount: wordsCount
                })}`,
                userId: Auth.user.uid,
                userName: Auth.user.displayName || 'Người dùng',
                userAvatar: Auth.user.photoURL || '',
                timestamp: serverTimestamp()
            };
            
            if (chatType === 'public') {
                await addDoc(collection(db, 'chat'), messageData);
            } else if (chatType === 'private' && typeof PrivateChat !== 'undefined' && PrivateChat.currentConversation) {
                // currentConversation is a string (conversation ID)
                await addDoc(collection(db, 'conversations', PrivateChat.currentConversation, 'messages'), {
                    ...messageData,
                    senderId: Auth.user.uid,
                    senderName: Auth.user.displayName
                });
            }
        } catch (error) {
            console.error('Send topic share error:', error);
        }
    }
};

