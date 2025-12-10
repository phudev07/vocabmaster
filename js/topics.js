/**
 * Topics Module - Manage topics/folders
 */

const Topics = {
    currentTopicId: null,

    // Initialize
    init() {
        this.bindEvents();
        this.render();
    },

    // Bind events
    bindEvents() {
        // Add topic button
        document.getElementById('addTopicBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Topic form submit
        document.getElementById('topicForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
        });

        // Icon picker
        document.querySelectorAll('#iconPicker .icon-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#iconPicker .icon-option').forEach(b => 
                    b.classList.remove('selected')
                );
                btn.classList.add('selected');
            });
        });

        // Color picker
        document.querySelectorAll('#colorPicker .color-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#colorPicker .color-option').forEach(b => 
                    b.classList.remove('selected')
                );
                btn.classList.add('selected');
            });
        });
    },

    // Render topics list in sidebar
    render() {
        const container = document.getElementById('topicsList');
        const topics = Storage.getTopics();
        
        if (topics.length === 0) {
            container.innerHTML = '<p class="empty-state">Chưa có chủ đề nào</p>';
            return;
        }

        container.innerHTML = topics.map(topic => {
            const wordCount = Storage.getWordCountByTopic(topic.id);
            const isActive = this.currentTopicId === topic.id;
            
            return `
                <button class="topic-item ${isActive ? 'active' : ''}" 
                        data-topic-id="${topic.id}">
                    <span class="topic-color" style="background: ${topic.color}"></span>
                    <span style="margin-right: 0.5rem">${topic.icon}</span>
                    <span class="topic-name">${topic.name}</span>
                    <span class="topic-count">${wordCount}</span>
                    <div class="topic-actions">
                        <span class="btn-icon" onclick="event.stopPropagation(); Topics.openModal('${topic.id}')">✏️</span>
                        <span class="btn-icon" onclick="event.stopPropagation(); Topics.confirmDelete('${topic.id}')">🗑️</span>
                    </div>
                </button>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', () => {
                const topicId = item.dataset.topicId;
                this.selectTopic(topicId);
            });
        });
    },

    // Select a topic
    selectTopic(topicId) {
        this.currentTopicId = topicId;
        const topic = Storage.getTopicById(topicId);
        
        if (!topic) return;

        // Update sidebar
        document.querySelectorAll('.topic-item').forEach(item => {
            item.classList.toggle('active', item.dataset.topicId === topicId);
        });

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Show topic view
        document.getElementById('topicViewIcon').textContent = topic.icon;
        document.getElementById('topicViewTitle').textContent = topic.name;
        
        // Render words
        Vocabulary.renderTopicWords(topicId);
        
        // Switch to topic view
        App.showView('topicView');
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    },

    // Open topic modal for add/edit
    openModal(topicId = null) {
        const modal = document.getElementById('topicModal');
        const title = document.getElementById('topicModalTitle');
        const nameInput = document.getElementById('topicName');
        const idInput = document.getElementById('topicId');
        
        // Reset form
        document.getElementById('topicForm').reset();
        
        // Reset icon selection
        document.querySelectorAll('#iconPicker .icon-option').forEach((btn, i) => {
            btn.classList.toggle('selected', i === 0);
        });
        
        // Reset color selection  
        document.querySelectorAll('#colorPicker .color-option').forEach((btn, i) => {
            btn.classList.toggle('selected', i === 0);
        });

        if (topicId) {
            // Edit mode
            const topic = Storage.getTopicById(topicId);
            if (!topic) return;
            
            title.textContent = 'Sửa chủ đề';
            nameInput.value = topic.name;
            idInput.value = topic.id;
            
            // Select icon
            document.querySelectorAll('#iconPicker .icon-option').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.icon === topic.icon);
            });
            
            // Select color
            document.querySelectorAll('#colorPicker .color-option').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.color === topic.color);
            });
        } else {
            // Add mode
            title.textContent = 'Thêm chủ đề';
            idInput.value = '';
        }
        
        modal.classList.add('active');
        nameInput.focus();
    },

    // Save topic
    save() {
        const name = document.getElementById('topicName').value.trim();
        const id = document.getElementById('topicId').value;
        const icon = document.querySelector('#iconPicker .icon-option.selected')?.dataset.icon || '📁';
        const color = document.querySelector('#colorPicker .color-option.selected')?.dataset.color || '#FF6B6B';
        
        if (!name) {
            App.showToast('Vui lòng nhập tên chủ đề', 'error');
            return;
        }

        const topic = {
            id: id || undefined,
            name,
            icon,
            color
        };

        // Save to Firebase (also saves to localStorage)
        FirebaseDB.saveTopic(topic);
        
        // Close modal
        document.getElementById('topicModal').classList.remove('active');
        
        // Refresh UI
        this.render();
        Stats.render();
        
        App.showToast(id ? 'Đã cập nhật chủ đề' : 'Đã thêm chủ đề mới', 'success');
    },

    // Confirm delete
    confirmDelete(topicId) {
        const topic = Storage.getTopicById(topicId);
        if (!topic) return;
        
        App.showConfirm(
            `Bạn có chắc muốn xóa chủ đề "${topic.name}" và tất cả từ vựng trong đó?`,
            () => this.delete(topicId)
        );
    },

    // Delete topic
    delete(topicId) {
        FirebaseDB.deleteTopic(topicId);
        
        // If viewing this topic, go back to dashboard
        if (this.currentTopicId === topicId) {
            this.currentTopicId = null;
            App.showView('dashboardView');
        }
        
        this.render();
        Stats.render();
        
        App.showToast('Đã xóa chủ đề', 'success');
    }
};
