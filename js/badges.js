const Badges = {
    // Custom SVG icons for badges
    SVG_ICONS: {
        // Facebook-style verified checkmark
        verified: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg verified-svg">
            <circle cx="12" cy="12" r="10" fill="#1877F2"/>
            <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        // Diamond (cyan/purple)
        diamond: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg diamond-svg">
            <path d="M12 2L2 9l10 13L22 9L12 2z" fill="#00D4FF"/>
            <path d="M12 2L7 9l5 13 5-13L12 2z" fill="#7B68EE" opacity="0.5"/>
        </svg>`,
        // Fire flame (orange/yellow)
        flame: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg flame-svg">
            <path d="M12 2c0 4-4 6-4 10 0 3.5 2.5 6 6 6s6-2.5 6-6c0-6-8-10-8-10z" fill="#FF6B35"/>
            <path d="M12 8c0 2-2 3-2 5 0 1.5 1 2.5 2.5 2.5s2.5-1 2.5-2.5c0-2.5-3-4-3-5z" fill="#FFD700"/>
        </svg>`,
        // Rainbow circle (multi-color segments)
        rainbow: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg rainbow-svg">
            <circle cx="12" cy="12" r="10" fill="#FF0000"/>
            <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#FF8C00" stroke-width="3"/>
            <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="#00FF00" stroke-width="3"/>
            <path d="M12 22a10 10 0 0 1-10-10" fill="none" stroke="#0088FF" stroke-width="3"/>
            <path d="M2 12a10 10 0 0 1 10-10" fill="none" stroke="#8800FF" stroke-width="3"/>
            <circle cx="12" cy="12" r="5" fill="#1a1a2e"/>
        </svg>`,
        // Unique star (purple)
        unique: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg unique-svg">
            <path d="M12 2l3 7h7l-5.5 5 2 7.5L12 17l-6.5 4.5 2-7.5L2 9h7l3-7z" fill="#B44AC0"/>
            <path d="M12 5l2 5h5l-4 3.5 1.5 5L12 15l-4.5 3.5 1.5-5-4-3.5h5l2-5z" fill="#8B5CF6"/>
        </svg>`,
        // VIP (gold crown)
        vip: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg vip-svg">
            <circle cx="12" cy="12" r="10" fill="#FFD700"/>
            <path d="M6 14l2-5 4 3 4-3 2 5H6z" fill="white"/>
            <circle cx="8" cy="9" r="1.2" fill="white"/>
            <circle cx="12" cy="7" r="1.2" fill="white"/>
            <circle cx="16" cy="9" r="1.2" fill="white"/>
        </svg>`,
        // Creator (camera)
        creator: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg creator-svg">
            <circle cx="12" cy="12" r="10" fill="#3B82F6"/>
            <rect x="6" y="8" width="12" height="9" rx="2" fill="white"/>
            <circle cx="12" cy="12" r="3" stroke="#3B82F6" stroke-width="1.5" fill="none"/>
            <path d="M8 6h3l1 2h-5l1-2z" fill="white"/>
        </svg>`,
        // Developer (code brackets)
        developer: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg developer-svg">
            <circle cx="12" cy="12" r="10" fill="#10B981"/>
            <path d="M8 8l-3 4 3 4M16 8l3 4-3 4M10 17l4-10" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        // Supporter (heart)
        supporter: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg supporter-svg">
            <circle cx="12" cy="12" r="10" fill="#EC4899"/>
            <path d="M12 7c-2-2-5-2-6 1s1 5 6 9c5-4 7-6 6-9s-4-3-6-1z" fill="white"/>
        </svg>`,
        // Champion (medal)
        champion: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg champion-svg">
            <circle cx="12" cy="12" r="10" fill="#DC2626"/>
            <circle cx="12" cy="11" r="5" fill="#FFD700"/>
            <path d="M10 16l2 4 2-4" fill="#FFD700"/>
            <text x="12" y="13" font-size="6" fill="#DC2626" text-anchor="middle" font-weight="bold">1</text>
        </svg>`,
        // Level badges - unique icons for each level
        // Level 1: Sparkle (green)
        level_1: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg level-svg">
            <circle cx="12" cy="12" r="10" fill="#4ADE80"/>
            <path d="M12 4l1 4h4l-3 3 1 4-3-2-3 2 1-4-3-3h4l1-4z" fill="white"/>
        </svg>`,
        // Level 2: Book (blue)
        level_2: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg level-svg">
            <circle cx="12" cy="12" r="10" fill="#60A5FA"/>
            <path d="M7 6h10v12H7z" fill="white"/>
            <path d="M12 6v12M7 6c0 0 2 1 5 1s5-1 5-1" stroke="#60A5FA" stroke-width="1"/>
        </svg>`,
        // Level 3: Star (yellow) - spinning
        level_3: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg level-svg">
            <circle cx="12" cy="12" r="10" fill="#FBBF24"/>
            <path d="M12 4l2 5h5l-4 3.5 1.5 5.5-4.5-3-4.5 3 1.5-5.5L5 9h5l2-5z" fill="white"/>
        </svg>`,
        // Level 4: Target (pink)
        level_4: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg level-svg">
            <circle cx="12" cy="12" r="10" fill="#F472B6"/>
            <circle cx="12" cy="12" r="6" fill="none" stroke="white" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="3" fill="white"/>
        </svg>`,
        // Level 5: Trophy (purple)
        level_5: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg level-svg">
            <circle cx="12" cy="12" r="10" fill="#A78BFA"/>
            <path d="M8 6h8v4c0 2-2 4-4 4s-4-2-4-4V6z" fill="white"/>
            <path d="M10 14v2h4v-2M9 18h6" stroke="white" stroke-width="1.5"/>
            <path d="M6 6c0 2 1 3 2 3M18 6c0 2-1 3-2 3" stroke="white" stroke-width="1"/>
        </svg>`,
        // Level 6: Lightning (pink)
        level_6: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg level-svg">
            <circle cx="12" cy="12" r="10" fill="#EC4899"/>
            <path d="M13 4l-5 8h4l-1 8 6-10h-4l2-6z" fill="white"/>
        </svg>`,
        // Level 7: Crown (gold) - master
        level_7: `<svg viewBox="0 0 24 24" fill="none" class="badge-svg level-svg">
            <circle cx="12" cy="12" r="10" fill="url(#level7Grad)"/>
            <path d="M6 15l2-6 4 3 4-3 2 6H6z" fill="white"/>
            <circle cx="8" cy="9" r="1.5" fill="white"/>
            <circle cx="12" cy="7" r="1.5" fill="white"/>
            <circle cx="16" cy="9" r="1.5" fill="white"/>
            <defs><linearGradient id="level7Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFD700"/>
                <stop offset="100%" style="stop-color:#FFA500"/>
            </linearGradient></defs>
        </svg>`
    },
    
    // Level badges - unlocked via XP
    LEVEL_BADGES: [
        { id: 'level_1', name: 'Người mới', level: 1, minXP: 0, cssClass: 'badge-level-1' },
        { id: 'level_2', name: 'Học viên', level: 2, minXP: 2000, cssClass: 'badge-level-2' },
        { id: 'level_3', name: 'Chăm chỉ', level: 3, minXP: 5000, cssClass: 'badge-level-3' },
        { id: 'level_4', name: 'Thành thạo', level: 4, minXP: 10000, cssClass: 'badge-level-4' },
        { id: 'level_5', name: 'Chuyên gia', level: 5, minXP: 20000, cssClass: 'badge-level-5' },
        { id: 'level_6', name: 'Cao thủ', level: 6, minXP: 40000, cssClass: 'badge-level-6' },
        { id: 'level_7', name: 'Bậc thầy', level: 7, minXP: 80000, cssClass: 'badge-level-7' }
    ],
    
    // Premium badges - admin granted only
    PREMIUM_BADGES: [
        { id: 'verified', name: 'Verified', description: 'Tài khoản xác thực', cssClass: 'badge-verified' },
        { id: 'diamond', name: 'Diamond', description: 'VIP Exclusive', cssClass: 'badge-diamond' },
        { id: 'flame', name: 'Flame', description: 'Top Contributor', cssClass: 'badge-flame' },
        { id: 'rainbow', name: 'Rainbow', description: 'Special Events', cssClass: 'badge-rainbow' },
        { id: 'unique', name: 'Unique', description: 'Limited Edition', cssClass: 'badge-unique' },
        { id: 'vip', name: 'VIP', description: 'VIP Member', cssClass: 'badge-vip' },
        { id: 'creator', name: 'Creator', description: 'Content Creator', cssClass: 'badge-creator' },
        { id: 'developer', name: 'Developer', description: 'Developer', cssClass: 'badge-developer' },
        { id: 'supporter', name: 'Supporter', description: 'Supporter', cssClass: 'badge-supporter' },
        { id: 'champion', name: 'Champion', description: 'Challenge Champion', cssClass: 'badge-champion' }
    ],
    
    // Get user's current level based on XP
    getUserLevel(xp) {
        let level = 1;
        for (const badge of this.LEVEL_BADGES) {
            if (xp >= badge.minXP) {
                level = badge.level;
            }
        }
        return level;
    },
    
    // Get all unlocked level badges for user
    getUnlockedLevelBadges(xp) {
        return this.LEVEL_BADGES.filter(badge => xp >= badge.minXP);
    },
    
    // Get premium badges for user (from Firestore)
    getPremiumBadges(userBadges) {
        if (!userBadges || !userBadges.premium) return [];
        return this.PREMIUM_BADGES.filter(badge => userBadges.premium.includes(badge.id));
    },
    
    // Get all available badges for user
    getAllBadges(xp, userBadges) {
        const levelBadges = this.getUnlockedLevelBadges(xp);
        const premiumBadges = this.getPremiumBadges(userBadges);
        return { levelBadges, premiumBadges };
    },
    
    // Get currently selected badge
    getSelectedBadge(userBadges, xp) {
        // If explicitly set to 'none', return null
        if (userBadges?.selected === 'none') {
            return null;
        }
        
        // Check if a specific badge is selected
        if (userBadges?.selected) {
            // Check if it's a level badge
            if (userBadges.selected.startsWith('level_')) {
                const levelBadge = this.LEVEL_BADGES.find(b => b.id === userBadges.selected);
                if (levelBadge && xp >= levelBadge.minXP) {
                    return levelBadge;
                }
            }
            
            // Check if it's a premium badge
            if (userBadges.selected.startsWith('premium_')) {
                const premiumId = userBadges.selected.replace('premium_', '');
                if (userBadges.premium && userBadges.premium.includes(premiumId)) {
                    return this.PREMIUM_BADGES.find(b => b.id === premiumId);
                }
            }
            
            // Check direct premium ID
            if (userBadges?.premium && userBadges.premium.includes(userBadges.selected)) {
                return this.PREMIUM_BADGES.find(b => b.id === userBadges.selected);
            }
        }
        
        // Default: return highest unlocked level badge
        const unlockedBadges = this.getUnlockedLevelBadges(xp);
        if (unlockedBadges.length > 0) {
            return unlockedBadges[unlockedBadges.length - 1]; // Highest level
        }
        
        return null;
    },
    
    // Render badge HTML (CSS animation fallback, Lottie if available)
    renderBadge(badge, size = 'small') {
        if (!badge) return '';
        
        const sizeClass = size === 'large' ? 'badge-lg' : size === 'medium' ? 'badge-md' : 'badge-sm';
        const cssClass = badge.cssClass || '';
        
        // Use SVG icon
        const svgIcon = this.SVG_ICONS[badge.id] || '';
        return `<span class="animated-badge ${sizeClass} ${cssClass}" title="${badge.name}" data-badge-id="${badge.id}">
            ${svgIcon}
        </span>`;
    },
    
    // Render badge with Lottie (for profile/large displays)
    renderLottieBadge(badge, size = 'small') {
        if (!badge) return '';
        
        const sizeMap = { small: 'badge-sm', medium: 'badge-md', large: 'badge-lg' };
        const sizeClass = sizeMap[size] || 'badge-sm';
        const cssClass = badge.cssClass || '';
        
        // Use SVG icon
        const svgIcon = this.SVG_ICONS[badge.id] || '';
        return `<span class="animated-badge ${sizeClass} ${cssClass}" title="${badge.name}">
            ${svgIcon}
        </span>`;
    },
    
    // Get badge HTML for a user (by user data)
    getBadgeHtml(userData, size = 'small') {
        if (!userData) return '';
        
        const xp = userData.xp || 0;
        const userBadges = userData.badges || {};
        
        const selectedBadge = this.getSelectedBadge(userBadges, xp);
        return this.renderBadge(selectedBadge, size);
    },
    
    // Save selected badge for current user
    async selectBadge(badgeId) {
        if (!Auth.isLoggedIn()) return;
        
        try {
            // Save to localStorage first
            const stats = Storage.getStats();
            if (!stats.badges) stats.badges = {};
            stats.badges.selected = badgeId;
            Storage.saveStats(stats);
            
            // Save to Firestore if available
            if (FirebaseDB.initialized) {
                const { doc, updateDoc, setDoc } = FirebaseDB.firestore;
                
                // Update in users collection
                await updateDoc(doc(db, 'users', Auth.user.uid), {
                    'badges.selected': badgeId
                });
                
                // Also update in settings
                await setDoc(doc(db, `users/${Auth.user.uid}/settings`, 'stats'), {
                    badges: stats.badges
                }, { merge: true });
            }
            
            App.showToast('Đã cập nhật badge!', 'success');
            
            // Close modal and refresh profile
            const modal = document.getElementById('badgeSelectorModal');
            if (modal) modal.remove();
            
            // Refresh profile if open
            if (document.getElementById('profileModal')?.classList.contains('active')) {
                App.showProfileModal();
            }
            
            // Force re-fetch Leaderboard from Firestore to get fresh badge data
            await Leaderboard.fetchUsers();
            Leaderboard.renderLandingLeaderboard();
            Leaderboard.renderDashboardLeaderboard();
            
            // Re-render chat to show updated badge (with small delay for Firestore sync)
            setTimeout(() => {
                Chat.render();
                console.log('Chat re-rendered with new badge');
            }, 300);
            
            console.log('Badge updated and views refreshed');
            
            return true;
        } catch (error) {
            console.error('Select badge error:', error);
            App.showToast('Lỗi cập nhật badge', 'error');
            return false;
        }
    },
    
    // Render badge selector modal
    renderBadgeSelector(xp, userBadges) {
        const { levelBadges, premiumBadges } = this.getAllBadges(xp, userBadges);
        const selected = userBadges?.selected || 'none';
        
        let html = '<div class="badge-selector">';
        
        // None option
        html += `
            <div class="badge-option ${selected === 'none' ? 'selected' : ''}" onclick="Badges.selectBadge('none')">
                <span class="badge-icon">❌</span>
                <span class="badge-name">Không hiển thị</span>
            </div>
        `;
        
        // Level badges
        html += '<h4>🎯 Badge cấp độ</h4>';
        for (const badge of this.LEVEL_BADGES) {
            const unlocked = xp >= badge.minXP;
            const isSelected = selected === badge.id;
            
            html += `
                <div class="badge-option ${isSelected ? 'selected' : ''} ${!unlocked ? 'locked' : ''}" 
                     onclick="${unlocked ? `Badges.selectBadge('${badge.id}')` : ''}">
                    ${this.renderBadge(badge, 'medium')}
                    <span class="badge-name">${badge.name}</span>
                    <span class="badge-level">Cấp ${badge.level}</span>
                    ${!unlocked ? `<span class="badge-locked">🔒 ${badge.minXP.toLocaleString()} XP</span>` : ''}
                </div>
            `;
        }
        
        // Premium badges
        if (premiumBadges.length > 0) {
            html += '<h4>💎 Badge Premium</h4>';
            for (const badge of premiumBadges) {
                const isSelected = selected === badge.id || selected === `premium_${badge.id}`;
                
                html += `
                    <div class="badge-option ${isSelected ? 'selected' : ''}" onclick="Badges.selectBadge('${badge.id}')">
                        ${this.renderBadge(badge, 'medium')}
                        <span class="badge-name">${badge.name}</span>
                        <span class="badge-desc">${badge.description}</span>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        return html;
    },
    
    // Initialize
    init() {
        console.log('Badges module initialized');
    }
};
