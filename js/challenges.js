/**
 * Challenges Module - Challenge friends to vocabulary battles
 */

const Challenges = {
    challenges: [],
    currentChallenge: null,
    
    // Create a new challenge
    async createChallenge(opponentId, topicId, wordCount = 10) {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) {
            App.showToast('Vui lòng đăng nhập', 'warning');
            return null;
        }
        
        // Check if user is blocked
        if (Security.isBlocked()) {
            App.showToast('Bạn đang bị tạm khóa do hoạt động bất thường', 'error');
            return null;
        }
        
        // Rate limiting
        if (!Security.isAllowed('create_challenge')) {
            App.showToast('Bạn đang tạo thách đấu quá nhanh, vui lòng chờ', 'warning');
            return null;
        }
        
        try {
            const { collection, addDoc, serverTimestamp } = FirebaseDB.firestore;
            
            // Get topic name and words
            const topic = Storage.getTopicById(topicId);
            const allWords = Storage.getWordsByTopic(topicId);
            
            if (allWords.length === 0) {
                App.showToast('Topic này chưa có từ vựng', 'error');
                return null;
            }
            
            // Shuffle and select words
            const shuffled = allWords.sort(() => Math.random() - 0.5);
            const selectedWords = shuffled.slice(0, Math.min(wordCount, allWords.length)).map(w => ({
                english: w.english,
                vietnamese: w.vietnamese
            }));
            
            const docRef = await addDoc(collection(db, 'challenges'), {
                creatorId: Auth.user.uid,
                creatorName: Auth.user.displayName,
                creatorAvatar: Auth.user.photoURL,
                opponentId: opponentId,
                opponentName: '', // Will be filled when opponent accepts
                opponentAvatar: '',
                topicId: topicId,
                topicName: topic?.name || 'Topic',
                wordCount: selectedWords.length,
                words: selectedWords, // Store words in challenge
                status: 'pending', // pending, active, completed, declined, cancelled
                creatorScore: null,
                opponentScore: null,
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            });
            
            App.showToast('Đã gửi lời thách đấu!', 'success');
            return docRef.id;
            
        } catch (error) {
            console.error('Create challenge error:', error);
            App.showToast('Lỗi tạo thách đấu', 'error');
            return null;
        }
    },
    
    // Fetch challenges for current user
    async fetchChallenges() {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) return [];
        
        try {
            const { collection, query, where, getDocs, orderBy, or } = FirebaseDB.firestore;
            
            // Get challenges where user is creator or opponent
            const q = query(
                collection(db, 'challenges'),
                orderBy('createdAt', 'desc')
            );
            
            const snapshot = await getDocs(q);
            
            this.challenges = [];
            const uid = Auth.user.uid;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                // Only include challenges involving current user
                if (data.creatorId === uid || data.opponentId === uid) {
                    this.challenges.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        isCreator: data.creatorId === uid
                    });
                }
            });
            
            return this.challenges;
        } catch (error) {
            console.error('Fetch challenges error:', error);
            return [];
        }
    },
    
    // Accept a challenge
    async acceptChallenge(challengeId) {
        // Check if user is blocked
        if (Security.isBlocked()) {
            App.showToast('Bạn đang bị tạm khóa do hoạt động bất thường', 'error');
            return;
        }
        
        // Rate limiting
        if (!Security.isAllowed('accept_challenge')) {
            App.showToast('Thao tác quá nhanh, vui lòng chờ', 'warning');
            return;
        }
        
        try {
            const { doc, updateDoc } = FirebaseDB.firestore;
            
            await updateDoc(doc(db, 'challenges', challengeId), {
                opponentName: Auth.user.displayName,
                opponentAvatar: Auth.user.photoURL,
                status: 'active'
            });
            
            App.showToast('Đã chấp nhận thách đấu!', 'success');
            await this.fetchChallenges();
            this.render();
            
        } catch (error) {
            console.error('Accept challenge error:', error);
            App.showToast('Lỗi chấp nhận thách đấu', 'error');
        }
    },
    
    // Decline a challenge
    async declineChallenge(challengeId) {
        try {
            const { doc, updateDoc } = FirebaseDB.firestore;
            
            await updateDoc(doc(db, 'challenges', challengeId), {
                status: 'declined'
            });
            
            App.showToast('Đã từ chối thách đấu', 'success');
            await this.fetchChallenges();
            this.render();
            
        } catch (error) {
            console.error('Decline challenge error:', error);
        }
    },
    
    // Submit score for a challenge
    async submitScore(challengeId, score) {
        try {
            const { doc, updateDoc, getDoc } = FirebaseDB.firestore;
            
            const challenge = this.challenges.find(c => c.id === challengeId);
            if (!challenge) return;
            
            const isCreator = challenge.creatorId === Auth.user.uid;
            const scoreField = isCreator ? 'creatorScore' : 'opponentScore';
            
            const updateData = { [scoreField]: score };
            
            // Check if other player has submitted
            const challengeDoc = await getDoc(doc(db, 'challenges', challengeId));
            const data = challengeDoc.data();
            
            const otherScoreField = isCreator ? 'opponentScore' : 'creatorScore';
            if (data[otherScoreField] !== null) {
                updateData.status = 'completed';
            }
            
            await updateDoc(doc(db, 'challenges', challengeId), updateData);
            
            App.showToast('Đã gửi điểm!', 'success');
            
        } catch (error) {
            console.error('Submit score error:', error);
            App.showToast('Lỗi gửi điểm', 'error');
        }
    },
    
    // Start playing a challenge
    async startChallenge(challengeId) {
        // Fetch challenge from Firestore to get words
        try {
            const { doc, getDoc } = FirebaseDB.firestore;
            const challengeDoc = await getDoc(doc(db, 'challenges', challengeId));
            
            if (!challengeDoc.exists()) {
                App.showToast('Thách đấu không tồn tại', 'error');
                return;
            }
            
            const challenge = challengeDoc.data();
            
            if (challenge.status !== 'active') {
                App.showToast('Thách đấu không hợp lệ', 'error');
                return;
            }
            
            // Check if already played
            const isCreator = challenge.creatorId === Auth.user.uid;
            const myScore = isCreator ? challenge.creatorScore : challenge.opponentScore;
            if (myScore !== null) {
                App.showToast('Bạn đã hoàn thành thách đấu này', 'info');
                return;
            }
            
            this.currentChallenge = challengeId;
            
            // Get words from challenge document
            const words = challenge.words || [];
            if (words.length === 0) {
                App.showToast('Không có từ vựng trong thách đấu này', 'error');
                return;
            }
            
            // Show word preview first, then start quiz
            this.showChallengePreview(challengeId, words, challenge);
            
        } catch (error) {
            console.error('Start challenge error:', error);
            App.showToast('Lỗi bắt đầu thách đấu', 'error');
        }
    },
    
    // Show word preview before starting challenge quiz
    showChallengePreview(challengeId, words, challenge) {
        // Escape HTML helper
        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        // Determine opponent name
        const isCreator = challenge.creatorId === Auth.user.uid;
        const opponentName = isCreator ? challenge.opponentName : challenge.creatorName;
        
        // Create preview modal
        const existingModal = document.getElementById('challengePreviewModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'challengePreviewModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content challenge-preview-modal">
                <div class="modal-header">
                    <h2>⚔️ Thách đấu với ${escapeHtml(opponentName)}</h2>
                    <button class="btn-icon modal-close" aria-label="Đóng">✕</button>
                </div>
                <div class="challenge-preview-body">
                    <div style="text-align: center; margin-bottom: 1rem;">
                        <span style="background: var(--accent-warning); color: #000; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.875rem;">
                            📚 Chủ đề: ${escapeHtml(challenge.topicName || 'Hỗn hợp')}
                        </span>
                    </div>
                    <p style="text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">
                        Ôn tập ${words.length} từ dưới đây trước khi bắt đầu kiểm tra
                    </p>
                    <div class="challenge-word-list">
                        ${words.map((word, index) => `
                            <div class="challenge-word-row">
                                <span class="challenge-word-number">${index + 1}</span>
                                <button class="challenge-word-speak" onclick="Speech.speak('${escapeHtml(word.english)}')">🔊</button>
                                <span class="challenge-word-text">${escapeHtml(word.english)}</span>
                                <span class="challenge-word-text challenge-word-vn">${escapeHtml(word.vietnamese)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="challenge-preview-actions">
                        <button class="btn btn-secondary modal-close">
                            ← Quay lại
                        </button>
                        <button class="btn btn-primary" id="startChallengeQuizBtn">
                            ⚔️ Bắt đầu kiểm tra (${words.length} từ)
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close handlers
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
                this.currentChallenge = null;
            });
        });
        modal.querySelector('.modal-overlay').addEventListener('click', () => {
            modal.remove();
            this.currentChallenge = null;
        });
        
        // Start quiz button
        document.getElementById('startChallengeQuizBtn').addEventListener('click', () => {
            modal.remove();
            
            // Shuffle words and start test
            const shuffledWords = [...words].sort(() => Math.random() - 0.5);
            
            Test.startChallenge(shuffledWords, (score) => {
                this.submitScore(challengeId, score);
                this.currentChallenge = null;
                this.fetchChallenges().then(() => this.render());
            });
        });
    },
    
    // Cancel a pending challenge (creator only)
    async cancelChallenge(challengeId) {
        try {
            const { doc, deleteDoc } = FirebaseDB.firestore;
            
            await deleteDoc(doc(db, 'challenges', challengeId));
            
            App.showToast('Đã hủy thách đấu', 'success');
            await this.fetchChallenges();
            this.render();
            
        } catch (error) {
            console.error('Cancel challenge error:', error);
            App.showToast('Lỗi hủy thách đấu', 'error');
        }
    },
    
    // Open create challenge modal
    openCreateModal(userId = null) {
        document.getElementById('challengeOpponentId').value = userId || '';
        
        // Populate topics
        const select = document.getElementById('challengeTopicSelect');
        const topics = Storage.getTopics();
        select.innerHTML = topics.map(t => `
            <option value="${t.id}">${t.icon} ${t.name} (${Storage.getWordCountByTopic(t.id)} từ)</option>
        `).join('');
        
        // Populate users - pass userId to preselect if provided
        this.populateUserSelect(userId);
        
        document.getElementById('challengeModal').classList.add('active');
    },
    
    // Populate user select with avatar list (only online users)
    async populateUserSelect(preselectedId = null) {
        const container = document.getElementById('challengeOpponentList');
        const allUsers = Leaderboard.users || [];
        const currentUid = Auth.user?.uid;
        
        // Filter only online users (active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const onlineUsers = allUsers.filter(u => u.lastActive && u.lastActive > fiveMinutesAgo);
        
        // If preselectedId provided, show only that user (even if offline)
        // Otherwise show only online users
        let displayUsers;
        if (preselectedId) {
            displayUsers = allUsers.filter(u => u.id === preselectedId);
        } else {
            displayUsers = onlineUsers.filter(u => u.id !== currentUid);
        }
        
        if (displayUsers.length === 0) {
            container.innerHTML = '<p class="empty-state">Không có người dùng online để thách đấu</p>';
            return;
        }
        
        // Mark preselected user
        this.selectedOpponentId = preselectedId;
        
        container.innerHTML = displayUsers.map(u => {
            const isOnline = u.lastActive && u.lastActive > fiveMinutesAgo;
            return `
                <div class="opponent-item ${u.id === preselectedId ? 'selected' : ''}" 
                     data-uid="${u.id}" 
                     onclick="Challenges.selectOpponent('${u.id}')">
                    <img src="${u.avatar || ''}" class="opponent-avatar" alt="">
                    <div class="opponent-info">
                        <div class="opponent-name">${isOnline ? '🟢 ' : ''}${u.name}</div>
                        <div class="opponent-xp">${u.xp} XP • 🔥${u.streak}</div>
                    </div>
                    ${!preselectedId ? `<button class="btn-icon" onclick="event.stopPropagation(); App.showUserProfile('${u.id}')" title="Xem thông tin">👤</button>` : ''}
                </div>
            `;
        }).join('');
    },
    
    // Select opponent
    selectedOpponentId: null,
    
    selectOpponent(userId) {
        this.selectedOpponentId = userId;
        
        // Update UI
        document.querySelectorAll('.opponent-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.uid === userId);
        });
    },
    
    // Send challenge from modal
    async sendChallenge() {
        const opponentId = this.selectedOpponentId;
        const topicId = document.getElementById('challengeTopicSelect').value;
        const wordCount = parseInt(document.getElementById('challengeWordCount').value) || 10;
        
        if (!opponentId || !topicId) {
            App.showToast('Vui lòng chọn đối thủ và topic', 'error');
            return;
        }
        
        await this.createChallenge(opponentId, topicId, wordCount);
        document.getElementById('challengeModal').classList.remove('active');
        
        await this.fetchChallenges();
        this.render();
    },
    
    // Render challenges list
    render() {
        const container = document.getElementById('challengesList');
        if (!container) return;
        
        const pending = this.challenges.filter(c => c.status === 'pending');
        const active = this.challenges.filter(c => c.status === 'active');
        const completed = this.challenges.filter(c => c.status === 'completed' || c.status === 'declined');
        
        let html = '';
        
        // Online users to challenge
        const onlineUsers = (Leaderboard.users || [])
            .filter(u => u.id !== Auth.user?.uid && u.isOnline)
            .slice(0, 10);
        
        if (onlineUsers.length > 0) {
            html += `<h3>🟢 Người dùng đang online</h3>`;
            html += `<div class="online-users-grid">`;
            html += onlineUsers.map(u => `
                <div class="user-card" onclick="App.showUserProfile('${u.id}')">
                    <img src="${u.avatar || ''}" class="user-card-avatar" alt="">
                    <div class="user-card-info">
                        <div class="user-card-name">${u.name}</div>
                        <div class="user-card-xp">${u.xp} XP</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); Challenges.openCreateModal('${u.id}')">⚔️</button>
                </div>
            `).join('');
            html += `</div>`;
        }
        
        // Pending challenges (received)
        const received = pending.filter(c => !c.isCreator);
        if (received.length > 0) {
            html += `<h3>📩 Lời mời thách đấu</h3>`;
            html += received.map(c => `
                <div class="challenge-card pending">
                    <div class="challenge-info">
                        <img src="${c.creatorAvatar}" class="challenge-avatar" alt="">
                        <div>
                            <div class="challenge-name">${c.creatorName} thách đấu bạn</div>
                            <div class="challenge-meta">📁 ${c.topicName} • ${c.wordCount} từ</div>
                        </div>
                    </div>
                    <div class="challenge-actions">
                        <button class="btn btn-primary btn-sm" onclick="Challenges.acceptChallenge('${c.id}')">Chấp nhận</button>
                        <button class="btn btn-secondary btn-sm" onclick="Challenges.declineChallenge('${c.id}')">Từ chối</button>
                    </div>
                </div>
            `).join('');
        }
        
        // Pending challenges (sent)
        const sent = pending.filter(c => c.isCreator);
        if (sent.length > 0) {
            html += `<h3>📤 Đang chờ đối thủ</h3>`;
            html += sent.map(c => `
                <div class="challenge-card waiting">
                    <div class="challenge-info">
                        <div class="challenge-name">Đang chờ phản hồi...</div>
                        <div class="challenge-meta">📁 ${c.topicName} • ${c.wordCount} từ</div>
                    </div>
                    <div class="challenge-actions">
                        <button class="btn btn-secondary btn-sm" onclick="Challenges.cancelChallenge('${c.id}')">Hủy</button>
                    </div>
                </div>
            `).join('');
        }
        
        // Active challenges
        if (active.length > 0) {
            html += `<h3>⚔️ Đang diễn ra</h3>`;
            html += active.map(c => {
                const opponent = c.isCreator ? c.opponentName : c.creatorName;
                const myScore = c.isCreator ? c.creatorScore : c.opponentScore;
                const hasPlayed = myScore !== null;
                
                return `
                    <div class="challenge-card active">
                        <div class="challenge-info">
                            <img src="${c.isCreator ? c.opponentAvatar : c.creatorAvatar}" class="challenge-avatar" alt="">
                            <div>
                                <div class="challenge-name">vs ${opponent}</div>
                                <div class="challenge-meta">📁 ${c.topicName} • ${c.wordCount} từ</div>
                            </div>
                        </div>
                        <div class="challenge-actions">
                            ${hasPlayed 
                                ? `<span class="challenge-score">Điểm của bạn: ${myScore}</span>` 
                                : `<button class="btn btn-primary btn-sm" onclick="Challenges.startChallenge('${c.id}')">Bắt đầu</button>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Completed challenges
        if (completed.length > 0) {
            html += `<h3>📊 Lịch sử</h3>`;
            html += completed.slice(0, 10).map(c => {
                if (c.status === 'declined') {
                    return `
                        <div class="challenge-card declined">
                            <div class="challenge-info">
                                <div class="challenge-name">Đã từ chối</div>
                                <div class="challenge-meta">📁 ${c.topicName}</div>
                            </div>
                        </div>
                    `;
                }
                
                const myScore = c.isCreator ? c.creatorScore : c.opponentScore;
                const theirScore = c.isCreator ? c.opponentScore : c.creatorScore;
                const opponent = c.isCreator ? c.opponentName : c.creatorName;
                const won = myScore > theirScore;
                const tie = myScore === theirScore;
                
                return `
                    <div class="challenge-card completed ${won ? 'won' : tie ? 'tie' : 'lost'}">
                        <div class="challenge-info">
                            <div class="challenge-name">vs ${opponent}</div>
                            <div class="challenge-meta">📁 ${c.topicName}</div>
                        </div>
                        <div class="challenge-result">
                            <span class="score">${myScore} - ${theirScore}</span>
                            <span class="result-badge">${won ? '🏆 Thắng' : tie ? '🤝 Hòa' : '💔 Thua'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        if (html === '') {
            html = '<p class="empty-state">Chưa có thách đấu nào. Tạo thách đấu mới để bắt đầu!</p>';
        }
        
        container.innerHTML = html;
    },
    
    // Initialize
    init() {
        // Bind create challenge button
        const createBtn = document.getElementById('createChallengeBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCreateModal());
        }
        
        // Bind send challenge button
        const sendBtn = document.getElementById('sendChallengeBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendChallenge());
        }
        
        // Start real-time listener if logged in
        if (Auth.isLoggedIn()) {
            this.listenToChallenges();
        }
        
        console.log('Challenges module initialized');
    },
    
    // Real-time challenges listener
    unsubscribeChallenges: null,
    
    listenToChallenges() {
        if (!Auth.isLoggedIn() || !FirebaseDB.initialized) return;
        
        // Unsubscribe if already listening
        if (this.unsubscribeChallenges) {
            this.unsubscribeChallenges();
        }
        
        try {
            const { collection, query, orderBy, onSnapshot } = FirebaseDB.firestore;
            
            const q = query(
                collection(db, 'challenges'),
                orderBy('createdAt', 'desc')
            );
            
            this.unsubscribeChallenges = onSnapshot(q, (snapshot) => {
                this.challenges = [];
                const uid = Auth.user.uid;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Only include challenges involving current user
                    if (data.creatorId === uid || data.opponentId === uid) {
                        this.challenges.push({
                            id: doc.id,
                            ...data,
                            createdAt: data.createdAt?.toDate() || new Date(),
                            isCreator: data.creatorId === uid
                        });
                    }
                });
                
                // Check for new challenges and update badge/sound
                if (typeof Notifications !== 'undefined') {
                    Notifications.checkNewChallenges(this.challenges);
                }
                
                // Re-render if on challenges view
                const challengesView = document.getElementById('challengesView');
                if (challengesView && challengesView.classList.contains('active')) {
                    this.render();
                }
            });
            
            console.log('Real-time challenges listener started');
            
        } catch (error) {
            console.error('Listen to challenges error:', error);
        }
    },
    
    // Stop listening
    stopListening() {
        if (this.unsubscribeChallenges) {
            this.unsubscribeChallenges();
            this.unsubscribeChallenges = null;
        }
    }
};
