/**
 * SRS Module - Spaced Repetition System (SM-2 Algorithm)
 */

const SRS = {
    // Minimum ease factor
    MIN_EASE_FACTOR: 1.3,
    
    // Calculate next review based on answer quality
    // quality: 0-5 (0-2: wrong, 3-5: correct with varying difficulty)
    calculateNextReview(word, isCorrect) {
        const now = new Date();
        let { easeFactor, interval, repetitions } = word;
        
        // Default values if not set
        easeFactor = easeFactor || 2.5;
        interval = interval || 0;
        repetitions = repetitions || 0;
        
        if (isCorrect) {
            // Correct answer
            if (repetitions === 0) {
                interval = 1; // 1 day
            } else if (repetitions === 1) {
                interval = 3; // 3 days
            } else {
                interval = Math.round(interval * easeFactor);
            }
            
            repetitions += 1;
            
            // Adjust ease factor (slight increase for correct)
            easeFactor = easeFactor + 0.1;
        } else {
            // Wrong answer - reset
            repetitions = 0;
            interval = 0; // Review again today/tomorrow
            
            // Decrease ease factor
            easeFactor = Math.max(this.MIN_EASE_FACTOR, easeFactor - 0.2);
        }
        
        // Calculate next review date
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + interval);
        
        return {
            easeFactor,
            interval,
            repetitions,
            nextReview: nextReview.toISOString(),
            lastReview: now.toISOString()
        };
    },

    // Update word with SRS data after review/test
    updateWordProgress(word, isCorrect) {
        const srsData = this.calculateNextReview(word, isCorrect);
        
        // Update stats
        if (isCorrect) {
            word.correctCount = (word.correctCount || 0) + 1;
        } else {
            word.wrongCount = (word.wrongCount || 0) + 1;
        }
        
        return {
            ...word,
            ...srsData
        };
    },

    // Get word status based on SRS data
    getWordStatus(word) {
        const { interval, repetitions } = word;
        
        // Check if due for review
        if (this.isDue(word)) {
            return 'due';
        }
        
        if (repetitions === 0 && interval === 0) {
            return 'new';
        }
        
        if (interval >= 21) { // 3 weeks = mastered
            return 'mastered';
        }
        
        return 'learning';
    },

    // Check if word is due for review
    isDue(word) {
        if (!word.nextReview) return true;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const reviewDate = new Date(word.nextReview);
        reviewDate.setHours(0, 0, 0, 0);
        
        return reviewDate <= today;
    },

    // Get days until next review
    getDaysUntilReview(word) {
        if (!word.nextReview) return 0;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const reviewDate = new Date(word.nextReview);
        reviewDate.setHours(0, 0, 0, 0);
        
        const diffTime = reviewDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    },

    // Get human-readable status text
    getStatusText(word) {
        const status = this.getWordStatus(word);
        const daysUntil = this.getDaysUntilReview(word);
        
        switch (status) {
            case 'new':
                return 'Mới';
            case 'due':
                return 'Cần ôn';
            case 'mastered':
                return 'Đã thuộc';
            case 'learning':
                if (daysUntil === 0) return 'Hôm nay';
                if (daysUntil === 1) return 'Ngày mai';
                return `${daysUntil} ngày nữa`;
            default:
                return '';
        }
    },

    // Calculate mastery percentage
    getMasteryPercentage(word) {
        const total = (word.correctCount || 0) + (word.wrongCount || 0);
        if (total === 0) return 0;
        return Math.round((word.correctCount / total) * 100);
    }
};
