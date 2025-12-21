/**
 * Stats Module - Learning Statistics
 */

const Stats = {
    // Calculate all statistics
    calculate() {
        const words = Storage.getAllWords();
        const stats = Storage.getStats();
        
        // Total words
        const totalWords = words.length;
        
        // Mastered words (interval >= 21 days)
        const masteredWords = words.filter(w => 
            SRS.getWordStatus(w) === 'mastered'
        ).length;
        
        // Learning words
        const learningWords = words.filter(w => 
            SRS.getWordStatus(w) === 'learning'
        ).length;
        
        // New words
        const newWords = words.filter(w => 
            SRS.getWordStatus(w) === 'new'
        ).length;
        
        // Due words
        const dueWords = Storage.getDueWords().length;
        
        return {
            totalWords,
            masteredWords,
            learningWords,
            newWords,
            dueWords,
            streak: stats.streak || 0,
            weeklyProgress: stats.weeklyProgress || [0, 0, 0, 0, 0, 0, 0]
        };
    },

    // Check and update streak when app loads (auto-reset if missed days)
    checkStreakOnLoad() {
        const stats = Storage.getStats();
        if (!stats.lastStudyDate || !stats.streak) return;
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const lastDate = new Date(stats.lastStudyDate);
        const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        const currentMonth = today.getMonth();
        
        // Reset monthly freezes if new month
        if (stats.freezeMonth !== currentMonth) {
            stats.freezeMonth = currentMonth;
            stats.freezesRemaining = 3;
        }
        
        // Initialize freezes if not set
        if (stats.freezesRemaining === undefined) {
            stats.freezesRemaining = 3;
            stats.freezeMonth = currentMonth;
        }
        
        // Check if streak should be reset
        if (daysDiff > 1) {
            const daysMissed = daysDiff - 1; // Days without studying
            
            if (stats.freezesRemaining >= daysMissed) {
                // Have enough freezes to cover all missed days
                stats.freezesRemaining -= daysMissed;
                stats.freezesUsed = (stats.freezesUsed || 0) + daysMissed;
                App.showToast(`❄️ Đã dùng ${daysMissed} Streak Freeze! Còn ${stats.freezesRemaining} freeze`, 'warning');
            } else if (stats.freezesRemaining > 0) {
                // Have some freezes but not enough
                const freezesUsed = stats.freezesRemaining;
                const oldStreak = stats.streak;
                stats.freezesUsed = (stats.freezesUsed || 0) + freezesUsed;
                stats.freezesRemaining = 0;
                stats.streak = 0;
                stats.lastStudyDate = null;
                App.showToast(`😢 Đã dùng hết ${freezesUsed} freeze nhưng không đủ! Streak ${oldStreak} ngày đã bị reset!`, 'error');
            } else {
                // No freezes left
                const oldStreak = stats.streak;
                stats.streak = 0;
                stats.lastStudyDate = null;
                App.showToast(`😢 Bạn đã nghỉ ${daysMissed} ngày và hết freeze. Streak ${oldStreak} ngày đã bị reset!`, 'error');
            }
            
            Storage.saveStats(stats);
            FirebaseDB.saveStats(stats);
        }
    },

    // Get ISO week number
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    // Update streak and weekly progress
    recordStudySession(wordsStudied = 1) {
        const stats = Storage.getStats();
        const today = new Date();
        const currentWeek = this.getWeekNumber(today);
        const currentYear = today.getFullYear();
        
        // Reset weekly progress if new week
        if (stats.lastWeekNumber !== currentWeek || stats.lastWeekYear !== currentYear) {
            stats.weeklyProgress = [0, 0, 0, 0, 0, 0, 0];
            stats.lastWeekNumber = currentWeek;
            stats.lastWeekYear = currentYear;
        }
        const todayStr = today.toISOString().split('T')[0];
        const currentMonth = today.getMonth();
        
        // Reset monthly freezes if new month
        if (stats.freezeMonth !== currentMonth) {
            stats.freezeMonth = currentMonth;
            stats.freezesRemaining = 3;
        }
        
        // Initialize freezes if not set
        if (stats.freezesRemaining === undefined) {
            stats.freezesRemaining = 3;
            stats.freezeMonth = currentMonth;
        }
        
        // Update streak
        if (stats.lastStudyDate) {
            const lastDate = new Date(stats.lastStudyDate);
            const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 0) {
                // Same day, streak unchanged
            } else if (daysDiff === 1) {
                // Consecutive day, increase streak
                stats.streak = (stats.streak || 0) + 1;
            } else if (daysDiff > 1) {
                const daysMissed = daysDiff - 1;
                
                if (stats.freezesRemaining >= daysMissed) {
                    // Have enough freezes - use them and continue streak
                    stats.freezesRemaining -= daysMissed;
                    stats.freezesUsed = (stats.freezesUsed || 0) + daysMissed;
                    stats.streak = (stats.streak || 0) + 1;
                    App.showToast(`❄️ Đã dùng ${daysMissed} Streak Freeze! Còn ${stats.freezesRemaining} freeze`, 'warning');
                } else if (stats.freezesRemaining > 0) {
                    // Have some freezes but not enough - streak broken
                    const freezesUsed = stats.freezesRemaining;
                    stats.freezesUsed = (stats.freezesUsed || 0) + freezesUsed;
                    stats.freezesRemaining = 0;
                    if (stats.streak > 0) {
                        App.showToast(`😢 Dùng hết ${freezesUsed} freeze nhưng không đủ! Streak ${stats.streak} ngày đã bị reset!`, 'error');
                    }
                    stats.streak = 1;
                } else {
                    // No freezes - streak broken
                    if (stats.streak > 0) {
                        App.showToast(`😢 Streak ${stats.streak} ngày đã bị reset!`, 'error');
                    }
                    stats.streak = 1;
                }
            }
        } else {
            // First study session
            stats.streak = 1;
        }
        
        stats.lastStudyDate = todayStr;
        
        // Update weekly progress (day of week: 0 = Sunday)
        const dayOfWeek = today.getDay();
        if (!stats.weeklyProgress) {
            stats.weeklyProgress = [0, 0, 0, 0, 0, 0, 0];
        }
        stats.weeklyProgress[dayOfWeek] += wordsStudied;
        
        Storage.saveStats(stats);
        
        // Sync to Firebase
        FirebaseDB.saveStats(stats);
        
        // Celebrate streak milestones!
        const milestones = [7, 14, 30, 50, 100, 365];
        if (milestones.includes(stats.streak)) {
            App.showConfetti();
            App.showToast(`🎉 Chúc mừng! Bạn đã đạt ${stats.streak} ngày liên tiếp!`, 'success');
        }
        
        return stats;
    },

    // Reset weekly progress (call at start of new week)
    resetWeeklyProgress() {
        const stats = Storage.getStats();
        stats.weeklyProgress = [0, 0, 0, 0, 0, 0, 0];
        Storage.saveStats(stats);
    },

    // Get accuracy rate
    getAccuracyRate() {
        const words = Storage.getAllWords();
        let totalCorrect = 0;
        let totalWrong = 0;
        
        words.forEach(w => {
            totalCorrect += w.correctCount || 0;
            totalWrong += w.wrongCount || 0;
        });
        
        const total = totalCorrect + totalWrong;
        if (total === 0) return 0;
        
        return Math.round((totalCorrect / total) * 100);
    },

    // Render stats in dashboard
    render() {
        const stats = this.calculate();
        
        // Update stat cards
        document.getElementById('statTotalWords').textContent = stats.totalWords;
        document.getElementById('statMastered').textContent = stats.masteredWords;
        document.getElementById('statLearning').textContent = stats.learningWords;
        document.getElementById('statStreak').textContent = stats.streak;
        
        // Update due badge
        const dueBadge = document.getElementById('dueBadge');
        dueBadge.textContent = stats.dueWords;
        dueBadge.style.display = stats.dueWords > 0 ? 'inline' : 'none';
        
        // Render weekly chart
        this.renderWeeklyChart(stats.weeklyProgress);
        
        // Render due words preview
        this.renderDueWordsPreview();
    },

    renderWeeklyChart(progress) {
        const container = document.getElementById('weeklyChart');
        if (!container) return;
        
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const maxValue = Math.max(...progress, 1);
        
        container.innerHTML = progress.map((value, index) => {
            const height = (value / maxValue) * 100;
            return `
                <div class="chart-bar">
                    <span class="chart-bar-value">${value > 0 ? value : ''}</span>
                    <div class="chart-bar-fill" style="height: ${Math.max(height, 4)}%"></div>
                    <span class="chart-bar-label">${days[index]}</span>
                </div>
            `;
        }).join('');
    },

    renderDueWordsPreview() {
        const container = document.getElementById('dueWordsPreview');
        if (!container) return;
        
        const dueWords = Storage.getDueWords();
        
        if (dueWords.length === 0) {
            container.innerHTML = '<p class="empty-state">Không có từ nào cần ôn tập 🎉</p>';
            return;
        }
        
        // Show first 5 due words
        const previewWords = dueWords.slice(0, 5);
        
        container.innerHTML = `
            <div class="words-list">
                ${previewWords.map(w => `
                    <div class="word-card">
                        <button class="word-speak" onclick="Speech.speak('${w.english}')">🔊</button>
                        <div class="word-content">
                            <span class="word-english">${w.english}</span>
                            <span class="word-vietnamese">${w.vietnamese}</span>
                        </div>
                        <span class="word-status-badge due">Cần ôn</span>
                    </div>
                `).join('')}
            </div>
            ${dueWords.length > 5 ? `<p style="text-align: center; margin-top: 1rem; color: var(--text-muted)">Và ${dueWords.length - 5} từ khác...</p>` : ''}
        `;
    }
};
