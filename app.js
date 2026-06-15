/**
 * Font Duel - A minimal font preference discovery app
 * Uses ELO rating system with exploration/exploitation match selection
 */

// --- Font Detection & Categorization ---

const SYSTEM_FONTS = {
    'sans-serif': [
        'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
        'Helvetica Neue', 'Arial', 'Noto Sans', 'Liberation Sans', 'sans-serif',
        'Arial Narrow', 'Arial Black', 'Impact', 'Tahoma', 'Verdana', 'Geneva',
        'Helvetica', 'Arial Unicode MS', 'Calibri', 'Candara', 'Optima',
        'Futura', 'Gill Sans', 'Avenir', 'Frutiger', 'Myriad Pro', 'Open Sans',
        'Lato', 'Montserrat', 'Raleway', 'Poppins', 'Nunito', 'Work Sans',
        'Inter', 'Roboto Mono', 'Source Sans Pro', 'Noto Sans JP', 'Noto Sans KR',
        'Noto Sans SC', 'Noto Sans TC', 'Ubuntu', 'Cantarell', 'DejaVu Sans',
        'Oxygen', 'Fira Sans', 'Droid Sans', 'PT Sans', 'Merriweather Sans',
        'Exo', 'Titillium Web', 'Quicksand', 'Manrope', 'Space Grotesk',
        'DM Sans', 'Karla', 'Rubik', 'Oswald', 'Barlow', 'Heebo', 'Mukta',
        'Muli', 'IBM Plex Sans', 'Cabin', 'Josefin Sans', 'Libre Franklin'
    ],
    'serif': [
        'Georgia', 'Times New Roman', 'Times', 'Liberation Serif', 'serif',
        'Palatino', 'Palatino Linotype', 'Book Antiqua', 'Garamond', 'Baskerville',
        'Bodoni MT', 'Didot', 'Times', 'Cambria', 'Charter', 'Iowan Old Style',
        'Hoefler Text', 'Constantia', 'Lucida Bright', 'Linux Libertine',
        'Noto Serif', 'Merriweather', 'Libre Baskerville', 'Playfair Display',
        'Crimson Text', 'Source Serif Pro', 'PT Serif', 'Lora', 'Bitter',
        'Domine', 'Vollkorn', 'EB Garamond', 'Spectral', 'Literata',
        'Newsreader', 'STIX Two Text', 'Lustria', 'Sorts Mill Goudy',
        'Unna', 'Faustina', 'Marcellus', 'Cormorant', 'Alegreya'
    ],
    'mono': [
        'Courier New', 'Courier', 'Lucida Console', 'Liberation Mono', 'monospace',
        'Monaco', 'Consolas', 'Andale Mono', 'Menlo', 'SF Mono', 'Fira Mono',
        'Ubuntu Mono', 'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono',
        'Cousine', 'Space Mono', 'Roboto Mono', 'IBM Plex Mono', 'JetBrains Mono',
        'Fira Code', 'Victor Mono', 'Cascadia Code', 'Inconsolata', 'Anonymous Pro',
        'PT Mono', 'Oxygen Mono', 'Share Tech Mono', 'Cutive Mono', 'Nova Mono',
        'VT323', 'Press Start 2P', 'Ubuntu Mono', 'Noto Sans Mono', 'Overpass Mono'
    ]
};

// Font database with detected availability
class FontDatabase {
    constructor() {
        this.fonts = new Map();
        this.detected = new Set();
    }

    async detectFonts() {
        const testString = 'mmmmmmmmmmlli';
        const testSize = '48px';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const fallbackFonts = {
            'sans-serif': 'Arial',
            'serif': 'Times New Roman',
            'mono': 'Courier New'
        };

        for (const [category, fonts] of Object.entries(SYSTEM_FONTS)) {
            const fallback = fallbackFonts[category];

            for (const font of fonts) {
                const isAvailable = await this.checkFont(font, fallback, testString, testSize, canvas, ctx);
                if (isAvailable) {
                    this.detected.add(font);
                    if (!this.fonts.has(font)) {
                        this.fonts.set(font, {
                            name: font,
                            category,
                            elo: 1500,
                            wins: 0,
                            losses: 0,
                            draws: 0,
                            comparisons: 0,
                            lastCompared: null
                        });
                    }
                }
            }
        }

        // Also detect installed fonts via FontFace API if available
        if (document.fonts) {
            await document.fonts.ready;
            for (const fontFace of document.fonts) {
                const family = fontFace.family.replace(/['"]/g, '');
                if (!this.fonts.has(family)) {
                    const detectedCategory = this.guessCategory(family);
                    this.fonts.set(family, {
                        name: family,
                        category: detectedCategory,
                        elo: 1500,
                        wins: 0,
                        losses: 0,
                        draws: 0,
                        comparisons: 0,
                        lastCompared: null
                    });
                    this.detected.add(family);
                }
            }
        }

        return Array.from(this.fonts.values());
    }

    async checkFont(font, fallback, testString, testSize, canvas, ctx) {
        ctx.font = `${testSize} ${font}, ${fallback}`;
        const width1 = ctx.measureText(testString).width;

        ctx.font = `${testSize} ${fallback}`;
        const width2 = ctx.measureText(testString).width;

        return width1 !== width2;
    }

    guessCategory(fontName) {
        const lower = fontName.toLowerCase();
        if (lower.includes('mono') || lower.includes('code') || lower.includes('console')) return 'mono';
        if (lower.includes('sans') || lower.includes('grotesk') || lower.includes('helvetica') || lower.includes('arial')) return 'sans-serif';
        if (lower.includes('serif') || lower.includes('times') || lower.includes('georgia')) return 'serif';
        return 'sans-serif'; // Default guess
    }

    getFonts(category = 'all') {
        if (category === 'all') return Array.from(this.fonts.values());
        return Array.from(this.fonts.values()).filter(f => f.category === category);
    }

    updateFont(fontName, updates) {
        const font = this.fonts.get(fontName);
        if (font) {
            Object.assign(font, updates);
        }
    }
}

// --- ELO Rating System ---

class ELOSystem {
    constructor(kFactor = 32) {
        this.kFactor = kFactor;
    }

    calculateExpectedScore(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }

    updateRatings(winner, loser, isDraw = false) {
        const expectedWinner = this.calculateExpectedScore(winner.elo, loser.elo);
        const expectedLoser = this.calculateExpectedScore(loser.elo, winner.elo);

        let winnerScore, loserScore;
        if (isDraw) {
            winnerScore = 0.5;
            loserScore = 0.5;
        } else {
            winnerScore = 1;
            loserScore = 0;
        }

        const winnerNewElo = winner.elo + this.kFactor * (winnerScore - expectedWinner);
        const loserNewElo = loser.elo + this.kFactor * (loserScore - expectedLoser);

        return {
            winner: { ...winner, elo: winnerNewElo },
            loser: { ...loser, elo: loserNewElo }
        };
    }
}

// --- Exploration vs Exploitation Match Selection ---

class MatchMaker {
    constructor(fonts, explorationRate = 0.3) {
        this.fonts = fonts;
        this.explorationRate = explorationRate;
        this.history = new Set(); // Track recent matchups to avoid repetition
    }

    selectMatch(category = 'all') {
        const candidates = this.fonts.getFonts(category).filter(f => {
            // Skip recently compared fonts
            if (f.lastCompared) {
                const minutesSince = (Date.now() - f.lastCompared) / (1000 * 60);
                return minutesSince > 5;
            }
            return true;
        });

        if (candidates.length < 2) {
            // Fallback: allow any fonts if too few candidates
            return this.selectRandomPair(this.fonts.getFonts(category));
        }

        // Exploration vs Exploitation
        if (Math.random() < this.explorationRate) {
            return this.exploreMatch(candidates);
        } else {
            return this.exploitMatch(candidates);
        }
    }

    exploreMatch(candidates) {
        // Find fonts with few comparisons or low confidence
        const sorted = candidates.sort((a, b) => a.comparisons - b.comparisons);
        const underexplored = sorted.slice(0, Math.ceil(candidates.length * 0.3));
        return this.selectRandomPair(underexplored.length >= 2 ? underexplored : candidates);
    }

    exploitMatch(candidates) {
        // Find close-ranked fonts for maximum information gain
        const sorted = candidates.sort((a, b) => b.elo - a.elo);

        // Weight pairs by how close their ratings are
        let bestPair = null;
        let bestInfoGain = -1;

        for (let i = 0; i < Math.min(sorted.length, 20); i++) {
            for (let j = i + 1; j < Math.min(sorted.length, 20); j++) {
                const fontA = sorted[i];
                const fontB = sorted[j];

                // Skip if already compared recently
                const pairKey = [fontA.name, fontB.name].sort().join('|');
                if (this.history.has(pairKey)) continue;

                // Information gain is highest when ratings are close
                const eloDiff = Math.abs(fontA.elo - fontB.elo);
                const infoGain = 1 / (1 + eloDiff / 100);

                if (infoGain > bestInfoGain) {
                    bestInfoGain = infoGain;
                    bestPair = [fontA, fontB];
                }
            }
        }

        if (bestPair) {
            const pairKey = [bestPair[0].name, bestPair[1].name].sort().join('|');
            this.history.add(pairKey);
            if (this.history.size > 100) {
                this.history.clear();
            }
            return bestPair;
        }

        return this.selectRandomPair(candidates);
    }

    selectRandomPair(candidates) {
        if (candidates.length < 2) return null;
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        return [shuffled[0], shuffled[1]];
    }
}

// --- Application State ---

class AppState {
    constructor() {
        this.db = new FontDatabase();
        this.elo = new ELOSystem(32);
        this.matchMaker = null;
        this.currentCategory = 'sans-serif';
        this.currentMatch = null;
        this.duelCount = 0;
    }

    async init() {
        await this.db.detectFonts();
        this.matchMaker = new MatchMaker(this.db);
        this.loadFromStorage();
        return this;
    }

    nextMatch() {
        this.currentMatch = this.matchMaker.selectMatch(this.currentCategory);
        this.duelCount++;
        return this.currentMatch;
    }

    recordWinner(winnerSide, isDraw = false) {
        if (!this.currentMatch) return;

        const [left, right] = this.currentMatch;
        const winner = winnerSide === 'left' ? left : right;
        const loser = winnerSide === 'left' ? right : left;

        const now = Date.now();

        if (isDraw) {
            const result = this.elo.updateRatings(left, right, true);
            this.db.updateFont(left.name, {
                elo: result.winner.elo,
                draws: left.draws + 1,
                comparisons: left.comparisons + 1,
                lastCompared: now
            });
            this.db.updateFont(right.name, {
                elo: result.loser.elo,
                draws: right.draws + 1,
                comparisons: right.comparisons + 1,
                lastCompared: now
            });
        } else {
            const result = this.elo.updateRatings(winner, loser, false);
            this.db.updateFont(winner.name, {
                elo: result.winner.elo,
                wins: winner.wins + 1,
                comparisons: winner.comparisons + 1,
                lastCompared: now
            });
            this.db.updateFont(loser.name, {
                elo: result.loser.elo,
                losses: loser.losses + 1,
                comparisons: loser.comparisons + 1,
                lastCompared: now
            });
        }

        this.saveToStorage();
    }

    skipMatch() {
        if (this.currentMatch) {
            const now = Date.now();
            this.currentMatch.forEach(font => {
                this.db.updateFont(font.name, { lastCompared: now });
            });
        }
    }

    getRankings(category = 'all') {
        return this.db.getFonts(category).sort((a, b) => b.elo - a.elo);
    }

    setCategory(category) {
        this.currentCategory = category;
    }

    saveToStorage() {
        const data = {
            fonts: Array.from(this.db.fonts.entries()),
            duelCount: this.duelCount
        };
        localStorage.setItem('fontDuelState', JSON.stringify(data));
    }

    loadFromStorage() {
        const saved = localStorage.getItem('fontDuelState');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.fonts) {
                    for (const [name, fontData] of data.fonts) {
                        if (this.db.fonts.has(name)) {
                            this.db.updateFont(name, fontData);
                        }
                    }
                }
                this.duelCount = data.duelCount || 0;
            } catch (e) {
                console.error('Failed to load saved state:', e);
            }
        }
    }

    exportData() {
        const data = {
            fonts: Array.from(this.db.fonts.entries()),
            duelCount: this.duelCount,
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }

    importData(jsonString) {
        const data = JSON.parse(jsonString);
        if (data.fonts) {
            for (const [name, fontData] of data.fonts) {
                if (this.db.fonts.has(name)) {
                    this.db.updateFont(name, fontData);
                }
            }
        }
        if (data.duelCount) {
            this.duelCount = data.duelCount;
        }
        this.saveToStorage();
    }

    reset() {
        localStorage.removeItem('fontDuelState');
        for (const [name, font] of this.db.fonts) {
            this.db.updateFont(name, {
                elo: 1500,
                wins: 0,
                losses: 0,
                draws: 0,
                comparisons: 0,
                lastCompared: null
            });
        }
        this.duelCount = 0;
    }
}

// --- UI Controller ---

class UIController {
    constructor(state) {
        this.state = state;
        this.elements = {};
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.renderMatch();
    }

    cacheElements() {
        this.elements = {
            leftCard: document.getElementById('left-card'),
            rightCard: document.getElementById('right-card'),
            leftPreview: document.getElementById('left-preview'),
            rightPreview: document.getElementById('right-preview'),
            leftName: document.getElementById('left-name'),
            rightName: document.getElementById('right-name'),
            leftRank: document.getElementById('left-rank'),
            rightRank: document.getElementById('right-rank'),
            duelCounter: document.getElementById('duel-counter'),
            categoryNav: document.getElementById('category-nav'),
            rankingsSection: document.getElementById('rankings-section'),
            duelSection: document.getElementById('duel-section'),
            rankingsList: document.getElementById('rankings-list'),
            viewRankings: document.getElementById('view-rankings'),
            backToDuel: document.getElementById('back-to-duel'),
            skipBtn: document.getElementById('skip-btn'),
            drawBtn: document.getElementById('draw-btn'),
            exportBtn: document.getElementById('export-btn'),
            importInput: document.getElementById('import-input'),
            resetBtn: document.getElementById('reset-btn'),
            toastContainer: document.getElementById('toast-container')
        };
    }

    bindEvents() {
        // Category selection
        this.elements.categoryNav.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                const category = e.target.dataset.category;
                this.state.setCategory(category);
                this.updateCategoryButtons(category);
                this.renderMatch();
            }
        });

        // Reveal overlays
        document.querySelectorAll('.reveal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                const side = overlay.dataset.side;
                this.revealFont(side);
            });
        });

        // Preview area clicks (for voting)
        this.elements.leftPreview.addEventListener('click', () => this.handleWinner('left'));
        this.elements.rightPreview.addEventListener('click', () => this.handleWinner('right'));

        // Control buttons
        this.elements.skipBtn.addEventListener('click', () => this.handleSkip());
        this.elements.drawBtn.addEventListener('click', () => this.handleDraw());

        // View switching
        this.elements.viewRankings.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRankings();
        });
        this.elements.backToDuel.addEventListener('click', (e) => {
            e.preventDefault();
            this.showDuel();
        });

        // Import/Export
        this.elements.exportBtn.addEventListener('click', () => this.exportData());
        this.elements.importInput.addEventListener('change', (e) => this.importData(e));
        this.elements.resetBtn.addEventListener('click', () => this.resetData());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.elements.duelSection.classList.contains('hidden')) return;

            switch (e.key) {
                case 'j':
                case 'ArrowLeft':
                    this.handleWinner('left');
                    break;
                case 'l':
                case 'ArrowRight':
                    this.handleWinner('right');
                    break;
                case 'k':
                case ' ':
                    e.preventDefault();
                    this.handleDraw();
                    break;
                case 'Escape':
                    this.handleSkip();
                    break;
            }
        });
    }

    updateCategoryButtons(activeCategory) {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === activeCategory);
        });
    }

    revealFont(side) {
        const card = side === 'left' ? this.elements.leftCard : this.elements.rightCard;
        const info = card.querySelector('.font-info');
        const overlay = card.querySelector('.reveal-overlay');

        info.classList.remove('hidden');
        info.classList.add('revealed');
        overlay.classList.add('hidden');
    }

    renderMatch() {
        const match = this.state.nextMatch();

        if (!match) {
            this.showToast('Not enough fonts in this category!');
            return;
        }

        const [left, right] = match;
        const rankings = this.state.getRankings(this.state.currentCategory);
        const leftRank = rankings.findIndex(f => f.name === left.name) + 1;
        const rightRank = rankings.findIndex(f => f.name === right.name) + 1;

        // Update names and ranks
        this.elements.leftName.textContent = left.name;
        this.elements.rightName.textContent = right.name;
        this.elements.leftRank.textContent = `Rank: ${leftRank || '--'}`;
        this.elements.rightRank.textContent = `Rank: ${rightRank || '--'}`;

        // Render previews
        this.renderPreview(this.elements.leftPreview, left.name, left.category);
        this.renderPreview(this.elements.rightPreview, right.name, right.category);

        // Update counter
        this.elements.duelCounter.textContent = `Battle ${this.state.duelCount}`;

        // Reset card states
        this.elements.leftCard.classList.remove('winner');
        this.elements.rightCard.classList.remove('winner');

        // Reset reveal states
        document.querySelectorAll('.font-info').forEach(info => {
            info.classList.add('hidden');
            info.classList.remove('revealed');
        });
        document.querySelectorAll('.reveal-overlay').forEach(overlay => {
            overlay.classList.remove('hidden');
        });
    }

    renderPreview(container, fontName, category) {
        const fontFamily = `'${fontName.replace(/'/g, "\\'")}', ${category}`;

        container.innerHTML = `
            <div class="preview-heading" style="font-family: ${fontFamily}">
                The Quick Brown Fox
            </div>
            <div class="preview-subheading" style="font-family: ${fontFamily}">
                Jumps over the lazy dog
            </div>
            <div class="preview-body" style="font-family: ${fontFamily}">
                Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. The arrangement of type involves selecting typefaces, point sizes, line lengths, line-spacing, and letter-spacing.
            </div>
            <div class="preview-body" style="font-family: ${fontFamily}">
                1234567890 $€£¥ ¢% @&# §*()[]{}
            </div>
        `;

        if (category === 'mono') {
            container.innerHTML += `
                <div class="preview-mono" style="font-family: ${fontFamily}">
                    const fib = (n) => n < 2 ? n : fib(n-1) + fib(n-2);
                </div>
            `;
        }
    }

    handleWinner(side) {
        const isLeft = side === 'left';
        const winnerCard = isLeft ? this.elements.leftCard : this.elements.rightCard;
        const winnerName = isLeft ? this.elements.leftName.textContent : this.elements.rightName.textContent;

        // Visual feedback
        winnerCard.classList.add('winner');

        // Record result
        this.state.recordWinner(side);

        // Show toast
        this.showToast(`${winnerName} wins!`);

        // Next match with animation delay
        setTimeout(() => this.renderMatch(), 300);
    }

    handleDraw() {
        this.state.recordWinner(null, true);
        this.showToast('Draw recorded');
        setTimeout(() => this.renderMatch(), 300);
    }

    handleSkip() {
        this.state.skipMatch();
        this.showToast('Skipped');
        this.renderMatch();
    }

    showRankings() {
        const rankings = this.state.getRankings(this.state.currentCategory);
        const categoryLabel = this.state.currentCategory === 'all' ? 'All' :
            this.state.currentCategory.charAt(0).toUpperCase() + this.state.currentCategory.slice(1);

        let html = '';
        rankings.forEach((font, index) => {
            const winRate = font.comparisons > 0
                ? Math.round(((font.wins + font.draws * 0.5) / font.comparisons) * 100)
                : 0;

            html += `
                <div class="ranking-item">
                    <span class="ranking-rank">${index + 1}</span>
                    <span class="ranking-font" style="font-family: "${font.name}", ${font.category}">${font.name}</span>
                    <span class="ranking-score">${Math.round(font.elo)}</span>
                    <span class="ranking-wins">${font.wins}W ${font.losses}L ${winRate}%</span>
                </div>
            `;
        });

        this.elements.rankingsList.innerHTML = `
            <div style="margin-bottom: 1rem; color: var(--muted-text); font-size: 0.85rem;">
                Showing ${rankings.length} ${categoryLabel.toLowerCase()} fonts
            </div>
            ${html}
        `;

        this.elements.duelSection.classList.add('hidden');
        this.elements.rankingsSection.classList.remove('hidden');
    }

    showDuel() {
        this.elements.rankingsSection.classList.add('hidden');
        this.elements.duelSection.classList.remove('hidden');
    }

    exportData() {
        const data = this.state.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `font-duel-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Data exported!');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.state.importData(e.target.result);
                this.showToast('Data imported successfully!');
                this.renderMatch();
            } catch (err) {
                this.showToast('Failed to import data');
                console.error(err);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    resetData() {
        if (confirm('Reset all rankings and start over? This cannot be undone.')) {
            this.state.reset();
            this.showToast('All data reset');
            this.renderMatch();
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        this.elements.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// --- Initialization ---

(async () => {
    const state = await new AppState().init();
    const ui = new UIController(state);
    ui.init();
})();
