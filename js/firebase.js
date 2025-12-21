/**
 * Firebase Module - User-specific cloud storage with Firestore
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDBZz76elwCKWLtGRRiPntj4CFbmty9tmk",
    authDomain: "vocabmaster-4c784.firebaseapp.com",
    projectId: "vocabmaster-4c784",
    storageBucket: "vocabmaster-4c784.firebasestorage.app",
    messagingSenderId: "816895415090",
    appId: "1:816895415090:web:5fcf52a0ea39f49e6d3d2b",
    measurementId: "G-P5S6Z8YENY"
};

// Firebase instances
let app = null;
let db = null;

const FirebaseDB = {
    initialized: false,
    firestore: null,
    userId: null,
    
    // Set user ID (called after login)
    setUserId(uid) {
        this.userId = uid;
        console.log('FirebaseDB userId set:', uid);
    },
    
    // Get collection path (user-specific if logged in)
    getPath(collectionName) {
        if (this.userId) {
            return `users/${this.userId}/${collectionName}`;
        }
        return collectionName; // Fallback to shared (for backwards compatibility)
    },
    
    // Initialize Firebase
    async init() {
        try {
            // Import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, onSnapshot, addDoc, updateDoc, query, orderBy, limit, serverTimestamp, where, increment } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            // Initialize app
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            
            // Store Firestore functions
            this.firestore = { collection, doc, getDocs, getDoc, setDoc, deleteDoc, onSnapshot, addDoc, updateDoc, query, orderBy, limit, serverTimestamp, where, increment };
            
            this.initialized = true;
            console.log('Firebase initialized');
            return true;
        } catch (error) {
            console.error('Firebase init error:', error);
            return false;
        }
    },

    // ==================== Topics ====================
    async getTopics() {
        if (!this.initialized) return Storage.getTopics();
        
        try {
            const { collection, getDocs } = this.firestore;
            const snapshot = await getDocs(collection(db, this.getPath('topics')));
            const topics = [];
            snapshot.forEach(doc => {
                topics.push({ id: doc.id, ...doc.data() });
            });
            // Cache to localStorage
            localStorage.setItem(Storage.KEYS.TOPICS, JSON.stringify(topics));
            return topics;
        } catch (error) {
            console.error('Get topics error:', error);
            return Storage.getTopics();
        }
    },

    async saveTopic(topic) {
        // Save to localStorage first
        topic = Storage.saveTopic(topic);
        
        if (!this.initialized) return topic;
        
        try {
            const { doc, setDoc } = this.firestore;
            await setDoc(doc(db, this.getPath('topics'), topic.id), topic);
            console.log('Topic saved to cloud:', topic.id);
        } catch (error) {
            console.error('Save topic error:', error);
        }
        return topic;
    },

    async deleteTopic(topicId) {
        // Check if topic was public before deleting
        const topic = Storage.getTopicById(topicId);
        const wasPublic = topic?.isPublic || false;
        
        // Delete from localStorage first
        Storage.deleteTopic(topicId);
        
        if (!this.initialized) return;
        
        try {
            const { doc, deleteDoc, collection, getDocs } = this.firestore;
            await deleteDoc(doc(db, this.getPath('topics'), topicId));
            
            // Delete all words in topic
            const snapshot = await getDocs(collection(db, this.getPath('words')));
            snapshot.forEach(async (docSnap) => {
                if (docSnap.data().topicId === topicId) {
                    await deleteDoc(doc(db, this.getPath('words'), docSnap.id));
                }
            });
            
            // Delete from publicTopics if was public
            if (wasPublic) {
                try {
                    await deleteDoc(doc(db, 'publicTopics', topicId));
                    console.log('Deleted from publicTopics:', topicId);
                } catch (e) {
                    console.log('Could not delete from publicTopics');
                }
            }
            
            console.log('Topic deleted from cloud:', topicId);
        } catch (error) {
            console.error('Delete topic error:', error);
        }
    },

    // ==================== Words ====================
    async getAllWords() {
        if (!this.initialized) return Storage.getAllWords();
        
        try {
            const { collection, getDocs } = this.firestore;
            const snapshot = await getDocs(collection(db, this.getPath('words')));
            const words = [];
            snapshot.forEach(doc => {
                words.push({ id: doc.id, ...doc.data() });
            });
            // Cache to localStorage
            localStorage.setItem(Storage.KEYS.WORDS, JSON.stringify(words));
            return words;
        } catch (error) {
            console.error('Get words error:', error);
            return Storage.getAllWords();
        }
    },

    async saveWord(word) {
        // Save to localStorage first
        word = Storage.saveWord(word);
        
        if (!this.initialized) return word;
        
        try {
            const { doc, setDoc } = this.firestore;
            await setDoc(doc(db, this.getPath('words'), word.id), word);
            console.log('Word saved to cloud:', word.id);
        } catch (error) {
            console.error('Save word error:', error);
        }
        return word;
    },

    async updateWord(word) {
        // Update localStorage first
        Storage.updateWord(word);
        
        if (!this.initialized) return word;
        
        try {
            const { doc, setDoc } = this.firestore;
            await setDoc(doc(db, this.getPath('words'), word.id), word);
        } catch (error) {
            console.error('Update word error:', error);
        }
        return word;
    },

    async deleteWord(wordId) {
        // Delete from localStorage first
        Storage.deleteWord(wordId);
        
        if (!this.initialized) return;
        
        try {
            const { doc, deleteDoc } = this.firestore;
            await deleteDoc(doc(db, this.getPath('words'), wordId));
            console.log('Word deleted from cloud:', wordId);
        } catch (error) {
            console.error('Delete word error:', error);
        }
    },

    // ==================== Stats ====================
    async getStats() {
        if (!this.initialized) return Storage.getStats();
        
        try {
            const { doc, getDoc } = this.firestore;
            const docRef = doc(db, this.getPath('settings'), 'stats');
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const stats = docSnap.data();
                console.log('Stats from cloud:', stats);
                localStorage.setItem(Storage.KEYS.STATS, JSON.stringify(stats));
                return stats;
            }
            console.log('No stats in cloud, using local');
            return Storage.getStats();
        } catch (error) {
            console.error('Get stats error:', error);
            return Storage.getStats();
        }
    },

    async saveStats(stats) {
        if (!this.initialized) return;
        
        try {
            const { doc, setDoc } = this.firestore;
            await setDoc(doc(db, this.getPath('settings'), 'stats'), stats);
            console.log('Stats saved to cloud');
        } catch (error) {
            console.error('Save stats error:', error);
        }
    },

    // ==================== Sync ====================
    async syncFromCloud() {
        if (!this.initialized) return;
        
        try {
            // Fetch all data from cloud
            await this.getTopics();
            await this.getAllWords();
            await this.getStats();
            console.log('Synced from cloud');
        } catch (error) {
            console.error('Sync error:', error);
        }
    },

    // Start real-time listeners
    startRealtimeSync() {
        if (!this.initialized) return;
        
        const { collection, onSnapshot } = this.firestore;
        
        // Listen for topics changes
        this.topicsUnsubscribe = onSnapshot(collection(db, this.getPath('topics')), (snapshot) => {
            const topics = [];
            snapshot.forEach(doc => {
                topics.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem(Storage.KEYS.TOPICS, JSON.stringify(topics));
            console.log('Topics updated in real-time:', topics.length);
            // Re-render UI
            Topics.render();
        });
        
        // Listen for words changes
        this.wordsUnsubscribe = onSnapshot(collection(db, this.getPath('words')), (snapshot) => {
            const words = [];
            snapshot.forEach(doc => {
                words.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem(Storage.KEYS.WORDS, JSON.stringify(words));
            console.log('Words updated in real-time:', words.length);
            // Re-render UI based on current view
            Stats.render();
            if (Topics.currentTopicId) {
                Vocabulary.renderTopicWords(Topics.currentTopicId);
            }
        });
        
        console.log('Real-time sync started');
    },
    
    // Stop real-time listeners (cleanup)
    stopRealtimeSync() {
        if (this.topicsUnsubscribe) this.topicsUnsubscribe();
        if (this.wordsUnsubscribe) this.wordsUnsubscribe();
    },

    async syncToCloud() {
        if (!this.initialized) return;
        
        try {
            const { doc, setDoc } = this.firestore;
            
            // Sync topics
            const topics = Storage.getTopics();
            for (const topic of topics) {
                await setDoc(doc(db, 'topics', topic.id), topic);
            }
            
            // Sync words
            const words = Storage.getAllWords();
            for (const word of words) {
                await setDoc(doc(db, 'words', word.id), word);
            }
            
            // Sync stats
            const stats = Storage.getStats();
            await setDoc(doc(db, 'settings', 'stats'), stats);
            
            console.log('Synced to cloud');
            App.showToast('Đã đồng bộ lên cloud', 'success');
        } catch (error) {
            console.error('Sync to cloud error:', error);
            App.showToast('Lỗi đồng bộ', 'error');
        }
    }
};
