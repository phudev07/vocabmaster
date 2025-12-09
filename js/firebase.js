/**
 * Firebase Module - Cloud storage with Firestore
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

// Firebase instances (will be initialized)
let app = null;
let db = null;
let auth = null;
let currentUser = null;

const FirebaseDB = {
    initialized: false,
    
    // Initialize Firebase
    async init() {
        try {
            // Import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            
            // Initialize app
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            
            // Store Firestore functions globally
            this.firestore = { collection, doc, getDocs, setDoc, deleteDoc, query, where };
            
            // Sign in anonymously
            await this.signIn();
            
            this.initialized = true;
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase init error:', error);
            App.showToast('Không thể kết nối Firebase, dùng LocalStorage', 'warning');
            return false;
        }
    },
    
    // Sign in anonymously
    async signIn() {
        const { signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        return new Promise((resolve, reject) => {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    console.log('User signed in:', user.uid);
                    resolve(user);
                } else {
                    try {
                        const result = await signInAnonymously(auth);
                        currentUser = result.user;
                        console.log('Anonymous sign in:', currentUser.uid);
                        resolve(currentUser);
                    } catch (error) {
                        console.error('Sign in error:', error);
                        reject(error);
                    }
                }
            });
        });
    },
    
    // Get user ID
    getUserId() {
        return currentUser ? currentUser.uid : null;
    },
    
    // Get collection reference for current user
    getUserCollection(collectionName) {
        const userId = this.getUserId();
        if (!userId) return null;
        return `users/${userId}/${collectionName}`;
    },

    // ==================== Topics ====================
    async getTopics() {
        if (!this.initialized) return Storage.getTopics();
        
        try {
            const { collection, getDocs } = this.firestore;
            const colPath = this.getUserCollection('topics');
            const snapshot = await getDocs(collection(db, colPath));
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
            const colPath = this.getUserCollection('topics');
            await setDoc(doc(db, colPath, topic.id), topic);
        } catch (error) {
            console.error('Save topic error:', error);
        }
        return topic;
    },

    async deleteTopic(topicId) {
        // Delete from localStorage first
        Storage.deleteTopic(topicId);
        
        if (!this.initialized) return;
        
        try {
            const { doc, deleteDoc, collection, getDocs, query, where } = this.firestore;
            const colPath = this.getUserCollection('topics');
            await deleteDoc(doc(db, colPath, topicId));
            
            // Delete all words in topic
            const wordsPath = this.getUserCollection('words');
            const q = query(collection(db, wordsPath), where('topicId', '==', topicId));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (docSnap) => {
                await deleteDoc(doc(db, wordsPath, docSnap.id));
            });
        } catch (error) {
            console.error('Delete topic error:', error);
        }
    },

    // ==================== Words ====================
    async getAllWords() {
        if (!this.initialized) return Storage.getAllWords();
        
        try {
            const { collection, getDocs } = this.firestore;
            const colPath = this.getUserCollection('words');
            const snapshot = await getDocs(collection(db, colPath));
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
            const colPath = this.getUserCollection('words');
            await setDoc(doc(db, colPath, word.id), word);
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
            const colPath = this.getUserCollection('words');
            await setDoc(doc(db, colPath, word.id), word);
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
            const colPath = this.getUserCollection('words');
            await deleteDoc(doc(db, colPath, wordId));
        } catch (error) {
            console.error('Delete word error:', error);
        }
    },

    // ==================== Settings & Stats ====================
    async saveSettings(settings) {
        const updated = Storage.saveSettings(settings);
        
        if (!this.initialized) return updated;
        
        try {
            const { doc, setDoc } = this.firestore;
            const path = `users/${this.getUserId()}`;
            await setDoc(doc(db, path, 'settings'), updated);
        } catch (error) {
            console.error('Save settings error:', error);
        }
        return updated;
    },

    async saveStats(stats) {
        Storage.saveStats(stats);
        
        if (!this.initialized) return stats;
        
        try {
            const { doc, setDoc } = this.firestore;
            const path = `users/${this.getUserId()}`;
            await setDoc(doc(db, path, 'stats'), stats);
        } catch (error) {
            console.error('Save stats error:', error);
        }
        return stats;
    },

    // ==================== Sync ====================
    async syncFromCloud() {
        if (!this.initialized) return;
        
        try {
            // Fetch all data from cloud
            await this.getTopics();
            await this.getAllWords();
            console.log('Synced from cloud');
        } catch (error) {
            console.error('Sync error:', error);
        }
    },

    async syncToCloud() {
        if (!this.initialized) return;
        
        try {
            const { doc, setDoc } = this.firestore;
            
            // Sync topics
            const topics = Storage.getTopics();
            for (const topic of topics) {
                const colPath = this.getUserCollection('topics');
                await setDoc(doc(db, colPath, topic.id), topic);
            }
            
            // Sync words
            const words = Storage.getAllWords();
            for (const word of words) {
                const colPath = this.getUserCollection('words');
                await setDoc(doc(db, colPath, word.id), word);
            }
            
            console.log('Synced to cloud');
            App.showToast('Đã đồng bộ lên cloud', 'success');
        } catch (error) {
            console.error('Sync to cloud error:', error);
            App.showToast('Lỗi đồng bộ', 'error');
        }
    }
};
