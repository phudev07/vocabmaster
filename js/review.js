/**
 * Review Module - Two-phase review: Study list first, then spelling test
 */

const Review = {
    words: [],
    currentTestIndex: 0,
    correctCount: 0,
    wrongWords: [],

    // Start review with configuration
    start(words) {
        if (!words || words.length === 0) {
            App.showToast('Không có từ nào để ôn tập', 'warning');
            return;
        }

        this.words = [...words];
        this.currentTestIndex = 0;
        this.correctCount = 0;
        this.wrongWords = [];

        // Phase 1: Show study list first
        this.showStudyList();
        App.showView('reviewView');
    },

    // Phase 1: Show all words as a study list
    showStudyList() {
        const container = document.querySelector('.review-container');
        
        container.innerHTML = `
            <div class="study-header">
                <h2>📖 Ôn tập ${this.words.length} từ</h2>
                <button class="btn-icon" id="closeReviewBtn" aria-label="Đóng">✕</button>
            </div>
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">
                Xem và ghi nhớ các từ bên dưới, sau đó làm bài kiểm tra
            </p>
            <div class="study-list" id="studyList">
                ${this.words.map((word, index) => `
                    <div class="study-word-row">
                        <span class="study-word-number">${index + 1}</span>
                        <button class="study-word-speak" onclick="Speech.speak('${this.escapeHtml(word.english)}')">🔊</button>
                        <span class="study-word-english">${this.escapeHtml(word.english)}</span>
                        <span class="study-word-vietnamese">${this.escapeHtml(word.vietnamese)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="study-actions">
                <button class="btn btn-primary btn-large" id="startTestBtn">
                    ✍️ Bắt đầu kiểm tra (${this.words.length} từ)
                </button>
            </div>
        `;

        // Bind events
        document.getElementById('closeReviewBtn').addEventListener('click', () => {
            App.showView('dashboardView');
        });

        document.getElementById('startTestBtn').addEventListener('click', () => {
            // Shuffle words for test
            this.words = this.shuffle([...this.words]);
            this.startSpellingTest();
        });
    },

    // Shuffle array
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    // Phase 2: Start spelling test for all words
    startSpellingTest() {
        this.currentTestIndex = 0;
        this.correctCount = 0;
        this.wrongWords = [];
        this.renderTestQuestion();
    },

    // Render current test question
    renderTestQuestion() {
        const word = this.words[this.currentTestIndex];
        if (!word) return;

        const container = document.querySelector('.review-container');
        
        container.innerHTML = `
            <div class="test-progress">
                <span>${this.currentTestIndex + 1} / ${this.words.length}</span>
                <span style="color: var(--accent-success)">Đúng: ${this.correctCount}</span>
                <button class="btn-icon" id="closeTestBtn" aria-label="Đóng">✕</button>
            </div>
            <div class="test-card">
                <p class="test-meaning">${this.escapeHtml(word.vietnamese)}</p>
                <button class="word-speak" id="speakHintBtn" style="margin: 1rem auto; display: block;">🔊 Nghe gợi ý</button>
                <input type="text" class="test-input" id="spellInput" placeholder="Viết từ tiếng Anh..." autocomplete="off">
                <div class="test-feedback" id="spellFeedback"></div>
            </div>
            <div class="test-actions" id="testActions">
                <button class="btn btn-secondary" id="showAnswerBtn">Xem đáp án</button>
                <button class="btn btn-primary" id="checkSpellBtn">Kiểm tra</button>
            </div>
        `;

        // Bind events
        const input = document.getElementById('spellInput');
        input.focus();

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkAnswer();
            }
        });

        document.getElementById('checkSpellBtn').addEventListener('click', () => this.checkAnswer());
        document.getElementById('showAnswerBtn').addEventListener('click', () => this.showAnswer(false));
        document.getElementById('speakHintBtn').addEventListener('click', () => Speech.speak(word.english));
        document.getElementById('closeTestBtn').addEventListener('click', () => App.showView('dashboardView'));
    },

    // Check spelling answer
    checkAnswer() {
        const word = this.words[this.currentTestIndex];
        const input = document.getElementById('spellInput');
        const answer = input.value.trim().toLowerCase();
        const correct = word.english.toLowerCase();

        if (!answer) {
            App.showToast('Vui lòng nhập từ', 'warning');
            return;
        }

        this.showAnswer(answer === correct);
    },

    // Show answer and update UI
    showAnswer(isCorrect) {
        const word = this.words[this.currentTestIndex];
        const input = document.getElementById('spellInput');
        const feedback = document.getElementById('spellFeedback');
        
        input.disabled = true;
        
        // Update SRS
        const updatedWord = SRS.updateWordProgress(word, isCorrect);
        FirebaseDB.updateWord(updatedWord);

        const actionsDiv = document.getElementById('testActions');
        const isLast = this.currentTestIndex === this.words.length - 1;
        
        if (isCorrect) {
            // Correct - show feedback and auto advance
            input.className = 'test-input correct';
            feedback.innerHTML = '✓ Chính xác!';
            feedback.className = 'test-feedback correct';
            this.correctCount++;
            
            // Auto advance after 800ms
            actionsDiv.innerHTML = '<span style="color: var(--text-muted)">Đang chuyển...</span>';
            
            setTimeout(() => {
                if (isLast) {
                    this.showResults();
                } else {
                    this.currentTestIndex++;
                    this.renderTestQuestion();
                }
            }, 800);
        } else {
            // Wrong - show answer and wait for user to continue
            input.className = 'test-input wrong';
            feedback.innerHTML = `✗ Đáp án đúng: <strong>${word.english}</strong>`;
            feedback.className = 'test-feedback wrong';
            this.wrongWords.push(word);
            
            // Show continue button for wrong answers
            actionsDiv.innerHTML = `
                <button class="btn btn-primary" id="nextWordBtn">${isLast ? 'Xem kết quả' : 'Tiếp tục →'}</button>
            `;

            document.getElementById('nextWordBtn').addEventListener('click', () => {
                if (isLast) {
                    this.showResults();
                } else {
                    this.currentTestIndex++;
                    this.renderTestQuestion();
                }
            });
        }
    },

    // Show final results
    showResults() {
        Stats.recordStudySession(this.words.length);
        
        const wrongCount = this.words.length - this.correctCount;
        const accuracy = Math.round((this.correctCount / this.words.length) * 100);

        const container = document.querySelector('.review-container');
        
        container.innerHTML = `
            <div class="result-icon">${accuracy >= 70 ? '🎉' : accuracy >= 40 ? '👍' : '💪'}</div>
            <h1>Kết quả ôn tập</h1>
            <div class="result-stats">
                <div class="result-stat">
                    <span class="result-value">${this.correctCount}</span>
                    <span class="result-label">Đúng</span>
                </div>
                <div class="result-stat">
                    <span class="result-value">${wrongCount}</span>
                    <span class="result-label">Sai</span>
                </div>
                <div class="result-stat">
                    <span class="result-value">${accuracy}%</span>
                    <span class="result-label">Tỷ lệ</span>
                </div>
            </div>
            ${this.wrongWords.length > 0 ? `
                <div class="wrong-words">
                    <h3>Các từ cần ôn thêm:</h3>
                    ${this.wrongWords.map(w => `
                        <div class="wrong-word-item">
                            <span><strong>${w.english}</strong></span>
                            <span>${w.vietnamese}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '<p style="color: var(--accent-success)">🎉 Xuất sắc! Bạn đã trả lời đúng tất cả!</p>'}
            <button class="btn btn-primary" id="backBtn">Về Dashboard</button>
        `;

        document.getElementById('backBtn').addEventListener('click', () => {
            App.showView('dashboardView');
            Stats.render();
            Vocabulary.renderDueWords();
        });
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Initialize event listeners
    init() {
        document.getElementById('startReviewBtn').addEventListener('click', () => {
            // Start directly without config modal
            this.start(Storage.getDueWords());
        });

        document.getElementById('startDueReviewBtn').addEventListener('click', () => {
            this.start(Storage.getDueWords());
        });

        document.getElementById('reviewTopicBtn').addEventListener('click', () => {
            if (!Topics.currentTopicId) return;
            const words = Storage.getWordsByTopic(Topics.currentTopicId);
            this.start(words);
        });

        document.getElementById('reviewAllBtn').addEventListener('click', () => {
            this.start(Storage.getAllWords());
        });
    },

    // Open config modal
    openConfigModal(mode, words) {
        const modal = document.getElementById('configModal');
        const title = document.getElementById('configModalTitle');
        const totalCount = document.getElementById('totalWordsCount');
        const modeInput = document.getElementById('configMode');
        const testModeTypeGroup = document.getElementById('testModeTypeGroup');

        title.textContent = mode === 'review' ? 'Cấu hình ôn tập' : 'Cấu hình kiểm tra';
        totalCount.textContent = words.length;
        modeInput.value = mode;

        // Show/hide test mode type selection
        if (testModeTypeGroup) {
            testModeTypeGroup.style.display = mode === 'test' ? 'block' : 'none';
            // Reset to normal mode
            document.querySelector('input[name="testModeType"][value="normal"]').checked = true;
        }

        this.pendingWords = words;

        document.querySelector('input[name="scope"][value="topic"]').checked = true;
        document.querySelector('input[name="count"][value="all"]').checked = true;
        document.getElementById('randomCount').value = Math.min(10, words.length);

        modal.classList.add('active');
    },

    // Process config and start
    processConfig() {
        const countType = document.querySelector('input[name="count"]:checked').value;
        const randomCount = parseInt(document.getElementById('randomCount').value) || 10;
        const mode = document.getElementById('configMode').value;
        const testModeType = document.querySelector('input[name="testModeType"]:checked')?.value || 'normal';

        let words = this.pendingWords || [];

        if (countType === 'random' && randomCount < words.length) {
            words = this.shuffle([...words]).slice(0, randomCount);
        }

        document.getElementById('configModal').classList.remove('active');

        if (mode === 'review') {
            this.start(words);
        } else {
            // Test mode
            if (testModeType === 'listening') {
                Test.startListening(words);
            } else {
                Test.start(words);
            }
        }
    }
};
