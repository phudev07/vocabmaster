/**
 * Achievements Module - Badges and achievement system
 */

const Achievements = {
    // Badge definitions - synced with level system
    badges: [
        {
            id: 'newcomer',
            name: 'Người mới',
            icon: '🌱',
            description: 'Bắt đầu học (Cấp 1)',
            condition: (stats) => stats.xp >= 0
        },
        {
            id: 'student',
            name: 'Học viên',
            icon: '📖',
            description: 'Đạt 2000 XP (Cấp 2)',
            condition: (stats) => stats.xp >= 2000
        },
        {
            id: 'hardworker',
            name: 'Sinh viên chăm chỉ',
            icon: '📚',
            description: 'Đạt 5000 XP (Cấp 3)',
            condition: (stats) => stats.xp >= 5000
        },
        {
            id: 'proficient',
            name: 'Thành thạo',
            icon: '🎯',
            description: 'Đạt 10000 XP (Cấp 4)',
            condition: (stats) => stats.xp >= 10000
        },
        {
            id: 'expert',
            name: 'Chuyên gia',
            icon: '🎓',
            description: 'Đạt 20000 XP (Cấp 5)',
            condition: (stats) => stats.xp >= 20000
        },
        {
            id: 'master',
            name: 'Cao thủ',
            icon: '⭐',
            description: 'Đạt 40000 XP (Cấp 6)',
            condition: (stats) => stats.xp >= 40000
        },
        {
            id: 'grandmaster',
            name: 'Bậc thầy',
            icon: '👑',
            description: 'Đạt 80000 XP (Cấp 7)',
            condition: (stats) => stats.xp >= 80000
        },
        {
            id: 'week_fire',
            name: 'Tuần lửa',
            icon: '🔥',
            description: 'Streak 7 ngày liên tiếp',
            condition: (stats) => stats.streak >= 7
        },
        {
            id: 'diamond_month',
            name: 'Tháng kim cương',
            icon: '💎',
            description: 'Streak 30 ngày liên tiếp',
            condition: (stats) => stats.streak >= 30
        },
        {
            id: 'champion',
            name: 'Vô địch',
            icon: '🏆',
            description: '100% đúng trong 1 bài test',
            condition: (stats) => stats.perfectTests >= 1
        }
    ],
    
    // Get user's earned badges
    getEarnedBadges() {
        const stats = this.getStats();
        return this.badges.filter(badge => badge.condition(stats));
    },
    
    // Get all badges with earned status
    getAllBadges() {
        const stats = this.getStats();
        return this.badges.map(badge => ({
            ...badge,
            earned: badge.condition(stats)
        }));
    },
    
    // Get stats for checking achievements
    getStats() {
        const localStats = Storage.getStats();
        const words = Storage.getAllWords();
        
        const totalWords = words.length;
        const masteredWords = words.filter(w => w.level >= 5).length;
        const streak = localStats.streak || 0;
        
        // Calculate XP same as level system (include bonusXP)
        const bonusXP = localStats.bonusXP || 0;
        const xp = totalWords * 10 + masteredWords * 50 + streak * 5 + bonusXP;
        
        return {
            totalWords,
            masteredWords,
            streak,
            xp,
            perfectTests: localStats.perfectTests || 0,
            testCount: localStats.testCount || 0
        };
    },
    
    // Check for new achievements (call after actions)
    checkNewAchievements() {
        const earned = this.getEarnedBadges();
        const previouslyEarned = JSON.parse(localStorage.getItem('earnedBadges') || '[]');
        
        // Find newly earned badges
        const newBadges = earned.filter(badge => !previouslyEarned.includes(badge.id));
        
        if (newBadges.length > 0) {
            // Save earned badges
            localStorage.setItem('earnedBadges', JSON.stringify(earned.map(b => b.id)));
            
            // Show notification for each new badge
            newBadges.forEach(badge => {
                this.showBadgeNotification(badge);
            });
        }
        
        return newBadges;
    },
    
    // Show badge earned notification
    showBadgeNotification(badge) {
        App.showToast(`🎉 Huy chương mới: ${badge.icon} ${badge.name}!`, 'success');
        
        // Also show confetti
        if (typeof App.showConfetti === 'function') {
            App.showConfetti();
        }
    },
    
    // Record a perfect test
    recordPerfectTest() {
        const stats = Storage.getStats();
        stats.perfectTests = (stats.perfectTests || 0) + 1;
        Storage.saveStats(stats);
        FirebaseDB.saveStats(stats);
        this.checkNewAchievements();
    },
    
    // Render badges in profile modal
    renderProfileBadges() {
        const container = document.getElementById('profileBadges');
        if (!container) return;
        
        const allBadges = this.getAllBadges();
        
        container.innerHTML = allBadges.map(badge => `
            <div class="badge-item ${badge.earned ? 'earned' : 'locked'}" title="${badge.description}">
                <span class="badge-icon">${badge.icon}</span>
                <span class="badge-name">${badge.name}</span>
            </div>
        `).join('');
    },
    
    // Render badges summary (for dashboard or header)
    renderBadgesSummary() {
        const earned = this.getEarnedBadges();
        const container = document.getElementById('badgesSummary');
        if (!container) return;
        
        if (earned.length === 0) {
            container.innerHTML = '<span class="no-badges">Chưa có huy chương</span>';
        } else {
            container.innerHTML = earned.map(b => `<span class="badge-mini" title="${b.name}">${b.icon}</span>`).join('');
        }
    },
    
    // Initialize
    init() {
        // Check achievements on init
        this.checkNewAchievements();
    }
};
