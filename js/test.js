/**
 * Test Module - Spelling test mode
 */

const Test = {
    words: [],
    currentIndex: 0,
    correctCount: 0,
    wrongWords: [],
    isAnswered: false,

    // Start test with words
    start(words) {
        if (!words || words.length === 0) {
            App.showToast('Không có từ nào để kiểm tra', 'warning');
            return;
        }

        this.words = this.shuffle([...words]);
        this.currentIndex = 0;
        this.correctCount = 0;
        this.wrongWords = [];
        this.isAnswered = false;

        this.render();
        App.showView('testView');
    },

    // Challenge mode callback
    challengeCallback: null,

    // Start challenge test with words and callback
    startChallenge(words, onComplete) {
        if (!words || words.length === 0) {
            App.showToast('Không có từ nào để kiểm tra', 'warning');
            if (onComplete) onComplete(0);
            return;
        }

        this.challengeCallback = onComplete;
        this.words = this.shuffle([...words]);
        this.currentIndex = 0;
        this.correctCount = 0;
        this.wrongWords = [];
        this.isAnswered = false;

        this.render();
        App.showView('testView');
    },

    // Shuffle array
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    // Render current question
    render() {
        const word = this.words[this.currentIndex];
        if (!word) return;

        document.getElementById('testProgress').textContent = 
            `${this.currentIndex + 1} / ${this.words.length}`;
        document.getElementById('testScore').textContent = 
            `Đúng: ${this.correctCount}`;
        
        document.getElementById('testMeaning').textContent = word.vietnamese;
        
        const input = document.getElementById('testInput');
        input.value = '';
        input.className = 'test-input';
        input.disabled = false;
        input.focus();
        
        document.getElementById('testFeedback').textContent = '';
        document.getElementById('testFeedback').className = 'test-feedback';
        
        this.isAnswered = false;
        
        // Reset buttons
        const checkBtn = document.getElementById('checkAnswerBtn');
        checkBtn.textContent = 'Kiểm tra';
        checkBtn.disabled = false;
        document.getElementById('skipWordBtn').style.display = 'inline-flex';
    },

    // Check answer
    checkAnswer() {
        if (this.isAnswered) {
            // Move to next
            this.next();
            return;
        }

        const word = this.words[this.currentIndex];
        const input = document.getElementById('testInput');
        const answer = input.value.trim().toLowerCase();
        const correct = word.english.toLowerCase();
        
        const feedback = document.getElementById('testFeedback');
        
        this.isAnswered = true;
        input.disabled = true;
        document.getElementById('skipWordBtn').style.display = 'none';
        
        if (answer === correct) {
            // Correct - auto advance
            this.correctCount++;
            input.className = 'test-input correct';
            feedback.textContent = '✓ Chính xác!';
            feedback.className = 'test-feedback correct';
            
            // Update SRS
            const updatedWord = SRS.updateWordProgress(word, true);
            FirebaseDB.updateWord(updatedWord);
            
            // Auto advance after 800ms
            document.getElementById('checkAnswerBtn').textContent = 'Đang chuyển...';
            document.getElementById('checkAnswerBtn').disabled = true;
            
            setTimeout(() => {
                this.next();
            }, 800);
        } else {
            // Wrong - wait for user to continue
            input.className = 'test-input wrong';
            feedback.textContent = `✗ Đáp án đúng: ${word.english}`;
            feedback.className = 'test-feedback wrong';
            
            this.wrongWords.push({
                word: word,
                userAnswer: answer
            });
            
            // Update SRS
            const updatedWord = SRS.updateWordProgress(word, false);
            FirebaseDB.updateWord(updatedWord);
            
            document.getElementById('checkAnswerBtn').textContent = 
                this.currentIndex === this.words.length - 1 ? 'Xem kết quả' : 'Tiếp tục →';
        }
    },

    // Skip word (count as wrong)
    skip() {
        const word = this.words[this.currentIndex];
        
        this.wrongWords.push({
            word: word,
            userAnswer: '(bỏ qua)'
        });
        
        // Update SRS
        const updatedWord = SRS.updateWordProgress(word, false);
        FirebaseDB.updateWord(updatedWord);
        
        this.next();
    },

    // Next question
    next() {
        if (this.currentIndex < this.words.length - 1) {
            this.currentIndex++;
            this.render();
        } else {
            // Finished - show results
            this.showResults();
        }
    },

    // Show results
    showResults() {
        Stats.recordStudySession(this.words.length);
        
        const wrongCount = this.words.length - this.correctCount;
        const accuracy = Math.round((this.correctCount / this.words.length) * 100);
        
        document.getElementById('resultCorrect').textContent = this.correctCount;
        document.getElementById('resultWrong').textContent = wrongCount;
        document.getElementById('resultAccuracy').textContent = `${accuracy}%`;
        
        // Render wrong words
        const wrongList = document.getElementById('wrongWordsList');
        if (this.wrongWords.length > 0) {
            wrongList.innerHTML = `
                <h3>Các từ cần ôn lại:</h3>
                ${this.wrongWords.map(item => `
                    <div class="wrong-word-item">
                        <span><strong>${item.word.english}</strong> - ${item.word.vietnamese}</span>
                        <span style="color: var(--accent-danger)">${item.userAnswer}</span>
                    </div>
                `).join('')}
            `;
        } else {
            wrongList.innerHTML = '<p style="color: var(--accent-success)">🎉 Xuất sắc! Bạn đã trả lời đúng tất cả!</p>';
        }
        
        // Set result icon based on accuracy
        const icon = document.querySelector('.result-icon');
        if (accuracy >= 80) {
            icon.textContent = '🎉';
        } else if (accuracy >= 50) {
            icon.textContent = '👍';
        } else {
            icon.textContent = '💪';
        }
        
        // Call challenge callback if exists
        if (this.challengeCallback) {
            this.challengeCallback(this.correctCount);
            this.challengeCallback = null;
        }
        
        App.showView('testResultView');
        Stats.render();
    },

    // Initialize event listeners
    init() {
        document.getElementById('checkAnswerBtn').addEventListener('click', () => this.checkAnswer());
        document.getElementById('skipWordBtn').addEventListener('click', () => this.skip());
        document.getElementById('closeTestBtn').addEventListener('click', () => {
            App.showView('dashboardView');
        });
        document.getElementById('backToDashboardBtn').addEventListener('click', () => {
            App.showView('dashboardView');
        });

        // Enter key to check answer
        document.getElementById('testInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkAnswer();
            }
        });

        // Test buttons from views
        document.getElementById('testTopicBtn').addEventListener('click', () => {
            if (!Topics.currentTopicId) return;
            const words = Storage.getWordsByTopic(Topics.currentTopicId);
            Review.openConfigModal('test', words);
        });

        document.getElementById('testAllBtn').addEventListener('click', () => {
            Review.openConfigModal('test', Storage.getAllWords());
        });
    }
};
