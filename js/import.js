/**
 * Import Module - Import vocabulary from CSV/Excel files
 */

const Import = {
    // Parsed data ready to import
    pendingData: [],
    selectedTopicId: null,
    
    // Parse CSV text
    parseCSV(text) {
        const lines = text.trim().split('\n');
        const results = [];
        
        // Skip header if exists
        let startIndex = 0;
        const firstLine = lines[0].toLowerCase();
        if (firstLine.includes('english') || firstLine.includes('vietnamese') || 
            firstLine.includes('tiếng anh') || firstLine.includes('nghĩa')) {
            startIndex = 1;
        }
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Handle both comma and semicolon separators
            let parts;
            if (line.includes(';')) {
                parts = line.split(';');
            } else {
                // Handle quoted CSV
                parts = this.parseCSVLine(line);
            }
            
            if (parts.length >= 2) {
                const english = parts[0].trim().replace(/^["']|["']$/g, '');
                const vietnamese = parts[1].trim().replace(/^["']|["']$/g, '');
                
                if (english && vietnamese) {
                    results.push({ english, vietnamese });
                }
            }
        }
        
        return results;
    },
    
    // Parse a single CSV line (handles quoted values)
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' || char === "'") {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    },
    
    // Validate imported data
    validateData(data) {
        const errors = [];
        const valid = [];
        
        data.forEach((item, index) => {
            if (!item.english || item.english.length < 1) {
                errors.push(`Dòng ${index + 1}: Thiếu từ tiếng Anh`);
            } else if (!item.vietnamese || item.vietnamese.length < 1) {
                errors.push(`Dòng ${index + 1}: Thiếu nghĩa tiếng Việt`);
            } else if (item.english.length > 100 || item.vietnamese.length > 200) {
                errors.push(`Dòng ${index + 1}: Nội dung quá dài`);
            } else {
                valid.push(item);
            }
        });
        
        return { valid, errors };
    },
    
    // Import data to topic
    async importToTopic(data, topicId) {
        if (!topicId || !data || data.length === 0) {
            App.showToast('Không có dữ liệu để import', 'error');
            return 0;
        }
        
        let imported = 0;
        
        for (const item of data) {
            const word = {
                english: item.english,
                vietnamese: item.vietnamese,
                topicId: topicId,
                level: 0,
                nextReview: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };
            
            // Save to storage and Firebase
            Storage.saveWord(word);
            await FirebaseDB.saveWord(word);
            imported++;
        }
        
        return imported;
    },
    
    // Open import modal
    openModal(topicId = null) {
        this.pendingData = [];
        this.selectedTopicId = topicId || Topics.currentTopicId;
        
        // Reset modal
        document.getElementById('importFile').value = '';
        document.getElementById('importPreview').innerHTML = '<p class="empty-state">Chọn file CSV để xem trước</p>';
        document.getElementById('importCount').textContent = '0';
        document.getElementById('executeImportBtn').disabled = true;
        
        // Populate topic dropdown
        this.populateTopicDropdown();
        
        document.getElementById('importModal').classList.add('active');
    },
    
    // Populate topic dropdown
    populateTopicDropdown() {
        const select = document.getElementById('importTopicSelect');
        const topics = Storage.getTopics();
        
        // If no topic selected, use first available topic
        if (!this.selectedTopicId && topics.length > 0) {
            this.selectedTopicId = topics[0].id;
        }
        
        console.log('Populating topics, selectedTopicId:', this.selectedTopicId, 'topics:', topics.length);
        
        select.innerHTML = topics.map(t => `
            <option value="${t.id}" ${t.id === this.selectedTopicId ? 'selected' : ''}>
                ${t.icon} ${t.name}
            </option>
        `).join('');
        
        if (topics.length === 0) {
            select.innerHTML = '<option value="">Chưa có topic - Tạo topic trước</option>';
        }
    },
    
    // Handle file selection
    handleFileSelect(input) {
        const file = input.files[0];
        if (!file) return;
        
        const fileName = file.name.toLowerCase();
        
        if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
            this.readCSVFile(file);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            this.readExcelFile(file);
        } else {
            App.showToast('Chỉ hỗ trợ file .csv hoặc .xlsx', 'error');
        }
    },
    
    // Read Excel file using SheetJS
    async readExcelFile(file) {
        const self = this; // Save reference to this
        
        try {
            // Load SheetJS if not already loaded
            if (typeof XLSX === 'undefined') {
                await this.loadSheetJS();
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Get first sheet
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    
                    // Parse rows
                    const results = [];
                    let startIndex = 0;
                    
                    // Skip header if exists
                    if (jsonData.length > 0) {
                        const firstRow = jsonData[0].map(cell => String(cell || '').toLowerCase());
                        if (firstRow.some(cell => cell.includes('english') || cell.includes('vietnamese') || 
                            cell.includes('tiếng anh') || cell.includes('nghĩa'))) {
                            startIndex = 1;
                        }
                    }
                    
                    for (let i = startIndex; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row && row.length >= 2) {
                            const english = String(row[0] || '').trim();
                            const vietnamese = String(row[1] || '').trim();
                            if (english && vietnamese) {
                                results.push({ english, vietnamese });
                            }
                        }
                    }
                    
                    const { valid, errors } = self.validateData(results);
                    self.pendingData = valid;
                    console.log('XLSX parsed, pendingData set:', self.pendingData.length);
                    self.renderPreview(valid, errors);
                    
                } catch (err) {
                    console.error('Excel parse error:', err);
                    App.showToast('Lỗi đọc file Excel', 'error');
                }
            };
            
            reader.onerror = () => {
                App.showToast('Lỗi đọc file', 'error');
            };
            
            reader.readAsArrayBuffer(file);
            
        } catch (error) {
            console.error('Excel read error:', error);
            App.showToast('Lỗi tải thư viện Excel', 'error');
        }
    },
    
    // Load SheetJS library dynamically
    loadSheetJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
    
    // Read CSV file
    readCSVFile(file) {
        const self = this; // Save reference to this
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const text = e.target.result;
            const data = self.parseCSV(text);
            const { valid, errors } = self.validateData(data);
            
            self.pendingData = valid;
            console.log('CSV parsed, pendingData set:', self.pendingData.length);
            self.renderPreview(valid, errors);
        };
        
        reader.onerror = () => {
            App.showToast('Lỗi đọc file', 'error');
        };
        
        reader.readAsText(file, 'UTF-8');
    },
    
    // Render preview table
    renderPreview(data, errors) {
        const container = document.getElementById('importPreview');
        const countEl = document.getElementById('importCount');
        const importBtn = document.getElementById('executeImportBtn');
        
        console.log('renderPreview called, data count:', data.length);
        
        countEl.textContent = data.length;
        
        // Enable/disable button
        if (data.length > 0) {
            importBtn.disabled = false;
            importBtn.removeAttribute('disabled');
            console.log('Button enabled, disabled attr:', importBtn.hasAttribute('disabled'));
        } else {
            importBtn.disabled = true;
            importBtn.setAttribute('disabled', 'true');
        }
        
        if (data.length === 0) {
            container.innerHTML = '<p class="empty-state">Không tìm thấy từ vựng hợp lệ trong file</p>';
            return;
        }
        
        let html = '';
        
        // Show errors if any
        if (errors.length > 0) {
            html += `
                <div class="import-errors">
                    <strong>⚠️ Có ${errors.length} lỗi:</strong>
                    <ul>${errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}</ul>
                    ${errors.length > 5 ? `<p>...và ${errors.length - 5} lỗi khác</p>` : ''}
                </div>
            `;
        }
        
        // Preview table
        html += `
            <table class="import-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Tiếng Anh</th>
                        <th>Tiếng Việt</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.slice(0, 20).map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${item.english}</td>
                            <td>${item.vietnamese}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${data.length > 20 ? `<p class="text-muted">...và ${data.length - 20} từ khác</p>` : ''}
        `;
        
        container.innerHTML = html;
    },
    
    // Execute import
    async executeImport() {
        console.log('executeImport called, pendingData:', this.pendingData);
        
        let topicId = document.getElementById('importTopicSelect').value;
        console.log('executeImport topicId from select:', topicId, 'selectedTopicId:', this.selectedTopicId);
        
        // Use selectedTopicId as fallback
        if (!topicId && this.selectedTopicId) {
            topicId = this.selectedTopicId;
        }
        
        // Use first topic from Storage as last resort
        if (!topicId) {
            const topics = Storage.getTopics();
            console.log('Getting topics from Storage:', topics);
            if (topics && topics.length > 0) {
                topicId = topics[0].id;
                console.log('Using first topic:', topicId);
            }
        }
        
        if (!topicId) {
            App.showToast('Vui lòng tạo topic trước', 'error');
            return;
        }
        
        if (!this.pendingData || this.pendingData.length === 0) {
            App.showToast('Không có dữ liệu để import', 'error');
            return;
        }
        
        // Show loading
        const importBtn = document.getElementById('executeImportBtn');
        const originalText = importBtn.textContent;
        importBtn.textContent = 'Đang import...';
        importBtn.disabled = true;
        
        try {
            const count = await this.importToTopic(this.pendingData, topicId);
            
            App.showToast(`Đã import ${count} từ vựng!`, 'success');
            
            // Close modal and refresh
            document.getElementById('importModal').classList.remove('active');
            Topics.render();
            Vocabulary.renderTopicWords(topicId);
            Stats.render();
            
        } catch (error) {
            console.error('Import error:', error);
            App.showToast('Lỗi import dữ liệu', 'error');
        } finally {
            importBtn.textContent = originalText;
            importBtn.disabled = false;
        }
    },
    
    // Initialize
    init() {
        // File input change handler
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target));
        }
        
        // Topic select change handler
        const topicSelect = document.getElementById('importTopicSelect');
        if (topicSelect) {
            topicSelect.addEventListener('change', (e) => {
                this.selectedTopicId = e.target.value;
            });
        }
        
        // Import button handler - use addEventListener for reliability
        const importBtn = document.getElementById('executeImportBtn');
        if (importBtn) {
            // Remove onclick attribute and use addEventListener
            importBtn.removeAttribute('onclick');
            importBtn.addEventListener('click', () => {
                console.log('Import button clicked via addEventListener');
                Import.executeImport();
            });
        }
        
        console.log('Import module initialized');
    }
};
