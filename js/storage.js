/**
 * Storage Module - Handles LocalStorage operations
 */

const Storage = {
    KEYS: {
        TOPICS: 'vocabmaster_topics',
        WORDS: 'vocabmaster_words',
        SETTINGS: 'vocabmaster_settings',
        STATS: 'vocabmaster_stats'
    },

    // ==================== Topics ====================
    getTopics() {
        const data = localStorage.getItem(this.KEYS.TOPICS);
        return data ? JSON.parse(data) : [];
    },

    saveTopic(topic) {
        const topics = this.getTopics();
        const existingIndex = topics.findIndex(t => t.id === topic.id);
        
        if (existingIndex >= 0) {
            topics[existingIndex] = { ...topics[existingIndex], ...topic };
        } else {
            topic.id = this.generateId();
            topic.createdAt = new Date().toISOString();
            topics.push(topic);
        }
        
        localStorage.setItem(this.KEYS.TOPICS, JSON.stringify(topics));
        return topic;
    },

    deleteTopic(topicId) {
        let topics = this.getTopics();
        topics = topics.filter(t => t.id !== topicId);
        localStorage.setItem(this.KEYS.TOPICS, JSON.stringify(topics));
        
        // Also delete all words in this topic
        let words = this.getAllWords();
        words = words.filter(w => w.topicId !== topicId);
        localStorage.setItem(this.KEYS.WORDS, JSON.stringify(words));
    },

    getTopicById(topicId) {
        const topics = this.getTopics();
        return topics.find(t => t.id === topicId);
    },

    // ==================== Words ====================
    getAllWords() {
        const data = localStorage.getItem(this.KEYS.WORDS);
        return data ? JSON.parse(data) : [];
    },

    getWordsByTopic(topicId) {
        const words = this.getAllWords();
        return words.filter(w => w.topicId === topicId);
    },

    saveWord(word) {
        const words = this.getAllWords();
        const existingIndex = words.findIndex(w => w.id === word.id);
        
        if (existingIndex >= 0) {
            words[existingIndex] = { ...words[existingIndex], ...word };
        } else {
            word.id = this.generateId();
            word.createdAt = new Date().toISOString();
            // SRS initial values
            word.easeFactor = 2.5;
            word.interval = 0;
            word.repetitions = 0;
            word.nextReview = new Date().toISOString();
            word.lastReview = null;
            word.correctCount = 0;
            word.wrongCount = 0;
            words.push(word);
        }
        
        localStorage.setItem(this.KEYS.WORDS, JSON.stringify(words));
        return word;
    },

    deleteWord(wordId) {
        let words = this.getAllWords();
        words = words.filter(w => w.id !== wordId);
        localStorage.setItem(this.KEYS.WORDS, JSON.stringify(words));
    },

    getWordById(wordId) {
        const words = this.getAllWords();
        return words.find(w => w.id === wordId);
    },

    updateWord(word) {
        const words = this.getAllWords();
        const index = words.findIndex(w => w.id === word.id);
        if (index >= 0) {
            words[index] = word;
            localStorage.setItem(this.KEYS.WORDS, JSON.stringify(words));
        }
        return word;
    },

    // ==================== Settings ====================
    getSettings() {
        const data = localStorage.getItem(this.KEYS.SETTINGS);
        return data ? JSON.parse(data) : {
            theme: 'dark',
            voiceType: 'US',
            voiceSpeed: 1.0
        };
    },

    saveSettings(settings) {
        const current = this.getSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(updated));
        return updated;
    },

    // ==================== Stats ====================
    getStats() {
        const data = localStorage.getItem(this.KEYS.STATS);
        return data ? JSON.parse(data) : {
            streak: 0,
            lastStudyDate: null,
            weeklyProgress: [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
        };
    },

    saveStats(stats) {
        localStorage.setItem(this.KEYS.STATS, JSON.stringify(stats));
        return stats;
    },

    // ==================== Utilities ====================
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Get words due for review (nextReview <= today)
    getDueWords() {
        const words = this.getAllWords();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return words.filter(w => {
            if (!w.nextReview) return true;
            const reviewDate = new Date(w.nextReview);
            reviewDate.setHours(0, 0, 0, 0);
            return reviewDate <= today;
        });
    },

    // Get word count by topic
    getWordCountByTopic(topicId) {
        return this.getWordsByTopic(topicId).length;
    },

    // Export all data
    exportData() {
        return {
            topics: this.getTopics(),
            words: this.getAllWords(),
            settings: this.getSettings(),
            stats: this.getStats(),
            exportDate: new Date().toISOString()
        };
    },

    // Import data
    importData(data) {
        if (data.topics) {
            localStorage.setItem(this.KEYS.TOPICS, JSON.stringify(data.topics));
        }
        if (data.words) {
            localStorage.setItem(this.KEYS.WORDS, JSON.stringify(data.words));
        }
        if (data.settings) {
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(data.settings));
        }
        if (data.stats) {
            localStorage.setItem(this.KEYS.STATS, JSON.stringify(data.stats));
        }
    },

    // Clear all data
    clearAll() {
        localStorage.removeItem(this.KEYS.TOPICS);
        localStorage.removeItem(this.KEYS.WORDS);
        localStorage.removeItem(this.KEYS.SETTINGS);
        localStorage.removeItem(this.KEYS.STATS);
    }
};
