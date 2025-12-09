/**
 * Firebase Module - Shared cloud storage with Firestore
 * All users share the same data (no user separation)
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
    
    // Initialize Firebase
    async init() {
        try {
            // Import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            // Initialize app
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            
            // Store Firestore functions
            this.firestore = { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot };
            
            this.initialized = true;
            console.log('Firebase initialized - shared mode');
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
            const snapshot = await getDocs(collection(db, 'topics'));
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
            await setDoc(doc(db, 'topics', topic.id), topic);
            console.log('Topic saved to cloud:', topic.id);
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
            const { doc, deleteDoc, collection, getDocs } = this.firestore;
            await deleteDoc(doc(db, 'topics', topicId));
            
            // Delete all words in topic
            const snapshot = await getDocs(collection(db, 'words'));
            snapshot.forEach(async (docSnap) => {
                if (docSnap.data().topicId === topicId) {
                    await deleteDoc(doc(db, 'words', docSnap.id));
                }
            });
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
            const snapshot = await getDocs(collection(db, 'words'));
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
            await setDoc(doc(db, 'words', word.id), word);
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
            await setDoc(doc(db, 'words', word.id), word);
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
            await deleteDoc(doc(db, 'words', wordId));
            console.log('Word deleted from cloud:', wordId);
        } catch (error) {
            console.error('Delete word error:', error);
        }
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
                await setDoc(doc(db, 'topics', topic.id), topic);
            }
            
            // Sync words
            const words = Storage.getAllWords();
            for (const word of words) {
                await setDoc(doc(db, 'words', word.id), word);
            }
            
            console.log('Synced to cloud');
            App.showToast('Đã đồng bộ lên cloud', 'success');
        } catch (error) {
            console.error('Sync to cloud error:', error);
            App.showToast('Lỗi đồng bộ', 'error');
        }
    }
};
