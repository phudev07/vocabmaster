/**
 * Vocabulary Module - Manage words
 */

const Vocabulary = {
    // Initialize
    init() {
        this.bindEvents();
    },

    // Bind events
    bindEvents() {
        // Add word button
        document.getElementById('addWordBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Word form submit
        document.getElementById('wordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.search(e.target.value);
        });
    },

    // Render words for a topic
    renderTopicWords(topicId) {
        const container = document.getElementById('wordsList');
        const words = Storage.getWordsByTopic(topicId);
        
        this.renderWordsList(container, words);
    },

    // Render all words
    renderAllWords() {
        const container = document.getElementById('allWordsList');
        const words = Storage.getAllWords();
        
        this.renderWordsList(container, words);
    },

    // Render due words
    renderDueWords() {
        const container = document.getElementById('dueWordsList');
        const words = Storage.getDueWords();
        
        if (words.length === 0) {
            container.innerHTML = '<p class="empty-state">🎉 Tuyệt vời! Không có từ nào cần ôn tập</p>';
            return;
        }
        
        // Use study-word-row layout like review section
        container.innerHTML = words.map((word, index) => {
            const topic = Storage.getTopicById(word.topicId);
            return `
                <div class="study-word-row" data-word-id="${word.id}">
                    <span class="study-word-number">${index + 1}</span>
                    <button class="study-word-speak" onclick="Speech.speak('${this.escapeHtml(word.english)}')">🔊</button>
                    <span class="study-word-english">${this.escapeHtml(word.english)}</span>
                    <span class="study-word-vietnamese">${this.escapeHtml(word.vietnamese)}</span>
                </div>
            `;
        }).join('');
    },

    // Render words list (shared)
    renderWordsList(container, words, showTopicName = false) {
        if (words.length === 0) {
            container.innerHTML = '<p class="empty-state">Chưa có từ vựng nào</p>';
            return;
        }

        container.innerHTML = words.map(word => {
            const status = SRS.getWordStatus(word);
            const statusText = SRS.getStatusText(word);
            const topic = Storage.getTopicById(word.topicId);
            
            return `
                <div class="word-card" data-word-id="${word.id}">
                    <button class="word-speak" onclick="Speech.speak('${this.escapeHtml(word.english)}')">
                        🔊
                    </button>
                    <div class="word-content">
                        <span class="word-english">${this.escapeHtml(word.english)}</span>
                        <span class="word-vietnamese">${this.escapeHtml(word.vietnamese)}</span>
                        ${showTopicName && topic ? `<span style="font-size: 0.75rem; color: var(--text-muted)">${topic.icon} ${topic.name}</span>` : ''}
                    </div>
                    <div class="word-status">
                        <span class="word-status-badge ${status}">${statusText}</span>
                    </div>
                    <div class="word-actions">
                        <button class="btn-icon" onclick="Vocabulary.openModal('${word.id}')" title="Sửa">✏️</button>
                        <button class="btn-icon" onclick="Vocabulary.confirmDelete('${word.id}')" title="Xóa">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Search words
    search(query) {
        const container = document.getElementById('allWordsList');
        const words = Storage.getAllWords();
        
        if (!query.trim()) {
            this.renderWordsList(container, words, true);
            return;
        }
        
        const filtered = words.filter(w => 
            w.english.toLowerCase().includes(query.toLowerCase()) ||
            w.vietnamese.toLowerCase().includes(query.toLowerCase())
        );
        
        this.renderWordsList(container, filtered, true);
    },

    // Open word modal for add/edit
    openModal(wordId = null) {
        const modal = document.getElementById('wordModal');
        const title = document.getElementById('wordModalTitle');
        const englishInput = document.getElementById('wordEnglish');
        const vietnameseInput = document.getElementById('wordVietnamese');
        const idInput = document.getElementById('wordId');
        const topicIdInput = document.getElementById('wordTopicId');
        
        // Reset form
        document.getElementById('wordForm').reset();

        if (wordId) {
            // Edit mode
            const word = Storage.getWordById(wordId);
            if (!word) return;
            
            title.textContent = 'Sửa từ vựng';
            englishInput.value = word.english;
            vietnameseInput.value = word.vietnamese;
            idInput.value = word.id;
            topicIdInput.value = word.topicId;
        } else {
            // Add mode
            title.textContent = 'Thêm từ vựng';
            idInput.value = '';
            topicIdInput.value = Topics.currentTopicId;
        }
        
        modal.classList.add('active');
        englishInput.focus();
    },

    // Save word
    save() {
        const english = document.getElementById('wordEnglish').value.trim();
        const vietnamese = document.getElementById('wordVietnamese').value.trim();
        const id = document.getElementById('wordId').value;
        const topicId = document.getElementById('wordTopicId').value;
        
        if (!english || !vietnamese) {
            App.showToast('Vui lòng nhập đầy đủ thông tin', 'error');
            return;
        }

        if (!topicId) {
            App.showToast('Vui lòng chọn một chủ đề trước', 'error');
            return;
        }
        
        // Check if user is blocked
        if (Security.isBlocked()) {
            App.showToast('Bạn đang bị tạm khóa do hoạt động bất thường', 'error');
            return;
        }
        
        // Rate limiting - different limits for create vs update
        const action = id ? 'update_word' : 'create_word';
        if (!Security.isAllowed(action)) {
            App.showToast('Thao tác quá nhanh, vui lòng chờ', 'warning');
            return;
        }
        
        // Sanitize input
        const sanitizedEnglish = Security.sanitizeText(english, 100);
        const sanitizedVietnamese = Security.sanitizeText(vietnamese, 200);
        
        if (!sanitizedEnglish || !sanitizedVietnamese) {
            App.showToast('Dữ liệu không hợp lệ', 'error');
            return;
        }

        const word = {
            id: id || undefined,
            topicId,
            english: sanitizedEnglish,
            vietnamese: sanitizedVietnamese
        };

        // If editing, preserve SRS data
        if (id) {
            const existingWord = Storage.getWordById(id);
            if (existingWord) {
                word.easeFactor = existingWord.easeFactor;
                word.interval = existingWord.interval;
                word.repetitions = existingWord.repetitions;
                word.nextReview = existingWord.nextReview;
                word.lastReview = existingWord.lastReview;
                word.correctCount = existingWord.correctCount;
                word.wrongCount = existingWord.wrongCount;
            }
        }

        // Save to Firebase (also saves to localStorage)
        FirebaseDB.saveWord(word);
        
        // Close modal
        document.getElementById('wordModal').classList.remove('active');
        
        // Refresh UI
        if (Topics.currentTopicId) {
            this.renderTopicWords(Topics.currentTopicId);
        }
        Topics.render(); // Update word count
        Stats.render();
        
        App.showToast(id ? 'Đã cập nhật từ vựng' : 'Đã thêm từ vựng mới', 'success');
    },

    // Confirm delete
    confirmDelete(wordId) {
        const word = Storage.getWordById(wordId);
        if (!word) return;
        
        App.showConfirm(
            `Bạn có chắc muốn xóa từ "${word.english}"?`,
            () => this.delete(wordId)
        );
    },

    // Delete word
    delete(wordId) {
        FirebaseDB.deleteWord(wordId);
        
        // Refresh UI
        if (Topics.currentTopicId) {
            this.renderTopicWords(Topics.currentTopicId);
        }
        this.renderAllWords();
        this.renderDueWords();
        Topics.render();
        Stats.render();
        
        App.showToast('Đã xóa từ vựng', 'success');
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
