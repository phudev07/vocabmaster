/**
 * Topics Module - Manage topics/folders
 */

const Topics = {
    currentTopicId: null,

    // Initialize
    init() {
        this.bindEvents();
        this.bindMobileTopicBtn();
        this.render();
        this.renderTopicPills();
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
            let pressTimer = null;
            let isLongPress = false;
            
            // Click handler (for desktop and non-long-press on mobile)
            item.addEventListener('click', () => {
                if (!isLongPress) {
                    const topicId = item.dataset.topicId;
                    this.selectTopic(topicId);
                }
                isLongPress = false;
            });
            
            // Long press for mobile - show actions
            item.addEventListener('touchstart', (e) => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    // Remove show-actions from all other items
                    container.querySelectorAll('.topic-item').forEach(i => {
                        i.classList.remove('show-actions');
                    });
                    // Add show-actions to this item
                    item.classList.add('show-actions');
                    // Vibrate if supported
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, 500);
            }, { passive: true });
            
            item.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
            });
            
            item.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });
        });
        
        // Click outside to remove show-actions
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.topic-item')) {
                container.querySelectorAll('.topic-item').forEach(item => {
                    item.classList.remove('show-actions');
                });
            }
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
        const publicCheckbox = document.getElementById('topicPublic');
        
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
            publicCheckbox.checked = topic.isPublic || false;
            
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
            // Remember last public preference
            const lastPublicPref = localStorage.getItem('vocabmaster_lastPublicPref');
            publicCheckbox.checked = lastPublicPref === 'true';
        }
        
        modal.classList.add('active');
        nameInput.focus();
    },

    // Save topic
    async save() {
        const name = document.getElementById('topicName').value.trim();
        const id = document.getElementById('topicId').value;
        const icon = document.querySelector('#iconPicker .icon-option.selected')?.dataset.icon || '📁';
        const color = document.querySelector('#colorPicker .color-option.selected')?.dataset.color || '#FF6B6B';
        const isPublic = document.getElementById('topicPublic').checked;
        
        if (!name) {
            App.showToast('Vui lòng nhập tên chủ đề', 'error');
            return;
        }

        // Remember public preference
        localStorage.setItem('vocabmaster_lastPublicPref', isPublic.toString());

        const topic = {
            id: id || undefined,
            name,
            icon,
            color,
            isPublic
        };

        // Check if was public before (for existing topics)
        let wasPublic = false;
        if (id) {
            const existingTopic = Storage.getTopicById(id);
            wasPublic = existingTopic?.isPublic || false;
        }

        // Save to Firebase (also saves to localStorage)
        const savedTopic = await FirebaseDB.saveTopic(topic);
        
        // Handle public topic sync
        if (isPublic && Auth.isLoggedIn()) {
            await Explore.publishTopic(savedTopic.id);
        } else if (wasPublic && !isPublic) {
            // Was public, now private - remove from public
            await Explore.unpublishTopic(id);
        }
        
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
        this.renderTopicPills();
        Stats.render();
        
        App.showToast('Đã xóa chủ đề', 'success');
    },
    
    // ========================================
    // Topic Pills (Mobile)
    // ========================================
    
    // Render topic pills for mobile
    renderTopicPills() {
        const container = document.getElementById('topicPills');
        if (!container) return;
        
        const topics = Storage.getTopics();
        
        // Build pills HTML
        let html = `
            <button class="topic-pill ${!this.currentTopicId ? 'active' : ''}" data-topic-id="all">
                📚 Tất cả
            </button>
        `;
        
        topics.forEach(topic => {
            const wordCount = Storage.getWordCountByTopic(topic.id);
            const isActive = this.currentTopicId === topic.id;
            
            html += `
                <button class="topic-pill ${isActive ? 'active' : ''}" data-topic-id="${topic.id}">
                    <span class="topic-pill-color" style="background: ${topic.color}"></span>
                    ${topic.icon} ${topic.name}
                    <span class="topic-pill-count">(${wordCount})</span>
                </button>
            `;
        });
        
        container.innerHTML = html;
        
        // Bind click events
        container.querySelectorAll('.topic-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const topicId = pill.dataset.topicId;
                
                // Update active state
                container.querySelectorAll('.topic-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                
                if (topicId === 'all') {
                    // Show all words
                    this.currentTopicId = null;
                    Vocabulary.renderAllWords();
                } else {
                    // Filter by topic
                    this.currentTopicId = topicId;
                    Vocabulary.renderAllWords(topicId);
                }
            });
        });
    },
    
    // Bind mobile topic add button
    bindMobileTopicBtn() {
        const addBtnMobile = document.getElementById('addTopicBtnMobile');
        if (addBtnMobile) {
            addBtnMobile.addEventListener('click', () => {
                this.openModal();
            });
        }
        
        // Also bind the add button in topics list view
        const addBtnList = document.getElementById('addTopicBtnList');
        if (addBtnList) {
            addBtnList.addEventListener('click', () => {
                this.openModal();
            });
        }
    },
    
    // Render topics as simple list (for mobile topicsListView)
    renderTopicsList() {
        const container = document.getElementById('topicsList2');
        if (!container) return;
        
        const topics = Storage.getTopics();
        
        if (topics.length === 0) {
            container.innerHTML = `
                <div class="topics-empty">
                    <div class="topics-empty-icon">📚</div>
                    <h3>Chưa có chủ đề nào</h3>
                    <p>Tạo chủ đề đầu tiên để bắt đầu học từ vựng!</p>
                    <button class="btn btn-primary" onclick="Topics.openModal()">+ Tạo chủ đề</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = topics.map(topic => {
            const wordCount = Storage.getWordCountByTopic(topic.id);
            
            return `
                <div class="topic-list-item" data-topic-id="${topic.id}">
                    <div class="topic-list-header">
                        <div class="topic-list-color-bar" style="background: ${topic.color}"></div>
                        <span class="topic-list-icon">${topic.icon}</span>
                        <div class="topic-list-info">
                            <div class="topic-list-name">${topic.name}</div>
                            <div class="topic-list-count">${wordCount} từ</div>
                        </div>
                        <span class="topic-list-arrow">›</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Bind click and long press events
        container.querySelectorAll('.topic-list-item').forEach(item => {
            const topicId = item.dataset.topicId;
            let pressTimer = null;
            let isLongPress = false;
            
            // Click to enter topic
            item.addEventListener('click', () => {
                if (!isLongPress) {
                    this.selectTopic(topicId);
                }
                isLongPress = false;
            });
            
            // Long press to show edit/delete options
            item.addEventListener('touchstart', (e) => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    // Vibrate if supported
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                    // Show context menu
                    this.showTopicContextMenu(topicId, e.touches[0].clientX, e.touches[0].clientY);
                }, 500);
            }, { passive: true });
            
            item.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
            });
            
            item.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });
        });
    },
    
    // Show context menu for topic (edit/delete)
    showTopicContextMenu(topicId, x, y) {
        // Remove existing menu
        const existingMenu = document.getElementById('topicContextMenu');
        if (existingMenu) existingMenu.remove();
        
        const topic = Storage.getTopicById(topicId);
        if (!topic) return;
        
        const menu = document.createElement('div');
        menu.id = 'topicContextMenu';
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-header">${topic.icon} ${topic.name}</div>
            <button class="context-menu-item" onclick="Topics.openModal('${topicId}'); Topics.hideContextMenu();">
                <span>✏️</span> Sửa chủ đề
            </button>
            <button class="context-menu-item danger" onclick="Topics.confirmDelete('${topicId}'); Topics.hideContextMenu();">
                <span>🗑️</span> Xóa chủ đề
            </button>
        `;
        
        document.body.appendChild(menu);
        
        // Position menu
        const menuRect = menu.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Center horizontally, position from touch point
        menu.style.left = '50%';
        menu.style.transform = 'translateX(-50%)';
        menu.style.bottom = '100px';
        
        // Add overlay
        const overlay = document.createElement('div');
        overlay.id = 'topicContextOverlay';
        overlay.className = 'context-menu-overlay';
        overlay.onclick = () => this.hideContextMenu();
        document.body.insertBefore(overlay, menu);
    },
    
    // Hide context menu
    hideContextMenu() {
        const menu = document.getElementById('topicContextMenu');
        const overlay = document.getElementById('topicContextOverlay');
        if (menu) menu.remove();
        if (overlay) overlay.remove();
    }
};
