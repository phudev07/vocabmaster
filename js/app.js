/**
 * App Module - Main application controller
 */

const App = {
    currentView: 'dashboardView',
    deleteCallback: null,

    // Initialize app
    async init() {
        console.log('VocabMaster initializing...');
        
        // Show loading state
        this.showToast('Đang kết nối...', 'warning');
        
        // Initialize Firebase first
        try {
            await FirebaseDB.init();
            // Sync data from cloud
            await FirebaseDB.syncFromCloud();
            this.showToast('Đã kết nối Firebase ☁️', 'success');
        } catch (error) {
            console.log('Firebase not available, using local storage');
        }
        
        // Initialize modules
        Speech.init();
        Topics.init();
        Vocabulary.init();
        Review.init();
        Test.init();
        
        // Load theme
        this.loadTheme();
        
        // Bind global events
        this.bindEvents();
        
        // Initial render
        Stats.render();
        Topics.render();
        
        console.log('VocabMaster ready!');
    },

    // Bind global events
    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Sync button
        document.getElementById('syncBtn').addEventListener('click', async () => {
            this.showToast('Đang đồng bộ...', 'warning');
            try {
                await FirebaseDB.syncToCloud();
                await FirebaseDB.syncFromCloud();
                // Refresh UI
                Stats.render();
                Topics.render();
                if (Topics.currentTopicId) {
                    Vocabulary.renderTopicWords(Topics.currentTopicId);
                }
            } catch (error) {
                this.showToast('Lỗi đồng bộ', 'error');
            }
        });

        // Mobile menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Close sidebar when clicking outside (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menuToggle');
            
            if (window.innerWidth <= 768 && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target) &&
                sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });

        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                
                // Update active state
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // Clear topic selection
                Topics.currentTopicId = null;
                document.querySelectorAll('.topic-item').forEach(t => t.classList.remove('active'));
                
                // Show view
                if (view === 'dashboard') {
                    this.showView('dashboardView');
                    Stats.render();
                } else if (view === 'all-words') {
                    this.showView('allWordsView');
                    Vocabulary.renderAllWords();
                } else if (view === 'review-due') {
                    this.showView('reviewDueView');
                    Vocabulary.renderDueWords();
                }
                
                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('open');
                }
            });
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
            el.addEventListener('click', () => {
                el.closest('.modal').classList.remove('active');
            });
        });

        // Config form submit
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            Review.processConfig();
        });

        // Confirm delete button
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            if (this.deleteCallback) {
                this.deleteCallback();
                this.deleteCallback = null;
            }
            document.getElementById('confirmModal').classList.remove('active');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });
    },

    // Show view
    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const view = document.getElementById(viewId);
        if (view) {
            view.classList.add('active');
            this.currentView = viewId;
        }
    },

    // Load theme from storage
    loadTheme() {
        const settings = Storage.getSettings();
        const theme = settings.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
    },

    // Toggle theme
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        Storage.saveSettings({ theme: newTheme });
    },

    // Show toast notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '✓'}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Show confirm dialog
    showConfirm(message, callback) {
        document.getElementById('confirmMessage').textContent = message;
        this.deleteCallback = callback;
        document.getElementById('confirmModal').classList.add('active');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
