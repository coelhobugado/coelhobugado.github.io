const Game = {
    // Game state variables
    state: {
        score: 0,
        time: 30,
        hits: 0,
        isPlaying: false,
        timer: null,
        bunnyTimer: null,
        level: 1,
        highScore: 0,
        audioContext: null,
    },

    // DOM elements
    elements: {
        score: null,
        time: null,
        hits: null,
        level: null,
        highScore: null,
        gameOver: null,
        startBtn: null,
        restartBtn: null,
        finalScore: null,
        finalHits: null,
        gameBoard: null,
        gameContainer: null,
    },

    /**
     * Shows a feedback animation.
     * @param {string} text - The text to display.
     * @param {HTMLElement} element - The element to attach the feedback to.
     */
    showFeedback(text, element) {
        const feedback = document.createElement('div');
        feedback.className = 'feedback-animation';
        feedback.textContent = text;
        element.style.position = 'relative';
        element.appendChild(feedback);

        setTimeout(() => {
            feedback.remove();
        }, 1000);
    },

    /**
     * Initializes the audio context for sound effects.
     */
    initAudio() {
        if (!this.state.audioContext) {
            this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    /**
     * Plays a sound effect.
     * @param {string} type - The type of sound to play ('hit' or 'gameOver').
     */
    playSound(type) {
        if (!this.state.audioContext) return;

        try {
            const oscillator = this.state.audioContext.createOscillator();
            const gainNode = this.state.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.state.audioContext.destination);

            if (type === 'hit') {
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(440, this.state.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, this.state.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.state.audioContext.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(this.state.audioContext.currentTime + 0.2);
            } else if (type === 'gameOver') {
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(220, this.state.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, this.state.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.state.audioContext.currentTime + 0.5);
                oscillator.start();
                oscillator.stop(this.state.audioContext.currentTime + 0.5);
            }
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    },

    /**
     * Creates the bunny SVG structure and appends it to the container.
     * @param {HTMLElement} bunnyContainer - The container for the bunny.
     */
    createBunny(bunnyContainer) {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.classList.add("bunny-svg");

        // Define SVG content using innerHTML for simplicity
        svg.innerHTML = `
            <g class="bunny-ears">
                <path d="M30,50 C10,5 40,5 30,50" class="bunny-ear-left" />
                <path d="M70,50 C90,5 60,5 70,50" class="bunny-ear-right" />
            </g>
            <g class="bunny-head-group">
                <ellipse cx="50" cy="65" rx="35" ry="30" class="bunny-head" />
                <g class="bunny-face">
                    <circle cx="38" cy="60" r="5" class="bunny-eye bunny-eye-left" />
                    <circle cx="62" cy="60" r="5" class="bunny-eye bunny-eye-right" />
                    <path d="M48,68 Q50,72 52,68" class="bunny-nose" />
                    <path d="M45,75 Q50,80 55,75" class="bunny-mouth" />
                </g>
                 <g class="bunny-face-hit">
                    <path d="M33,55 L43,65 M43,55 L33,65" class="bunny-eye-hit bunny-eye-left-hit" />
                    <path d="M57,55 L67,65 M67,55 L57,65" class="bunny-eye-hit bunny-eye-right-hit" />
                </g>
            </g>
        `;

        bunnyContainer.appendChild(svg);
    },

    /**
     * Initializes the game board with holes and bunnies.
     */
    initBoard() {
        this.elements.gameBoard.innerHTML = '';

        for (let i = 0; i < 9; i++) {
            const hole = document.createElement('div');
            hole.className = 'hole';

            const itemContainer = document.createElement('div');
            this.createBunny(itemContainer); // Initially create a bunny structure
            hole.appendChild(itemContainer);

            hole.addEventListener('click', (e) => {
                e.preventDefault();
                this.whackItem(hole);
            });

            hole.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.whackItem(hole);
            }, { passive: false });

            this.elements.gameBoard.appendChild(hole);
        }
    },

    /**
     * Handles the logic when an item (bunny or power-up) is hit.
     * @param {HTMLElement} hole - The hole that was clicked.
     */
    whackItem(hole) {
        const item = hole.querySelector('.clock, .bunny');
        if (!item || !item.classList.contains('up') || !this.state.isPlaying) return;

        if (item.classList.contains('clock')) {
            this.state.time += 5;
            this.elements.time.textContent = this.state.time;
            this.showFeedback('+5s', this.elements.time.parentElement);
        } else { // It's a bunny
            let points = 10;
            if (item.classList.contains('golden')) {
                points = 50;
            } else if (item.classList.contains('bomb')) {
                points = -25;
                this.elements.gameContainer.classList.add('shake');
                setTimeout(() => this.elements.gameContainer.classList.remove('shake'), 500);
            }

            this.state.score += points;
            this.state.hits++;
            this.elements.score.textContent = this.state.score;
            this.elements.hits.textContent = this.state.hits;

            if (this.state.score >= this.state.level * 100) {
                this.state.level++;
                this.elements.level.textContent = this.state.level;
                this.updateGameSpeed();
                this.showFeedback('Level Up!', this.elements.level.parentElement);
            }
        }

        item.classList.add('hit');
        this.playSound('hit');

        setTimeout(() => {
            item.classList.remove('up', 'hit');
        }, 300);
    },

    /**
     * Makes a random item pop up from a hole.
     */
    popUpItem() {
        if (!this.state.isPlaying) return;

        const holes = document.querySelectorAll('.hole');
        const randomHole = holes[Math.floor(Math.random() * holes.length)];
        const item = randomHole.querySelector('div'); // Get the container

        if (item && !item.classList.contains('up')) {
            const random = Math.random();
            let itemType = 'bunny';
            if (random < 0.05) {
                itemType = 'clock';
            } else if (random < 0.15) {
                itemType = 'bunny golden';
            } else if (random < 0.35) {
                itemType = 'bunny bomb';
            }
            // Reset and apply new class
            item.innerHTML = '';
            if (itemType.includes('bunny')) {
                this.createBunny(item);
            }
            item.className = itemType;


            item.classList.add('up');
            const displayTime = Math.max(200, 800 - (this.state.level * 40));

            setTimeout(() => {
                if (item.classList.contains('up')) {
                    item.classList.remove('up');
                }
            }, displayTime);
        }
    },

    /**
     * Starts the game.
     */
    startGame() {
        this.initAudio();

        if (this.state.timer) clearInterval(this.state.timer);
        if (this.state.bunnyTimer) clearInterval(this.state.bunnyTimer);

        this.state.score = 0;
        this.state.time = 30;
        this.state.hits = 0;
        this.state.level = 1;
        this.state.isPlaying = true;

        this.elements.score.textContent = this.state.score;
        this.elements.time.textContent = this.state.time;
        this.elements.hits.textContent = this.state.hits;
        this.elements.level.textContent = this.state.level;
        this.elements.gameOver.classList.remove('show');
        this.elements.startBtn.disabled = true;

        this.state.timer = setInterval(() => {
            this.state.time--;
            this.elements.time.textContent = this.state.time;

            if (this.state.time <= 0) {
                this.endGame();
            }
        }, 1000);

        this.updateGameSpeed();
    },

    /**
    * Updates the speed of the game based on the current level.
    */
    updateGameSpeed() {
        if (this.state.bunnyTimer) clearInterval(this.state.bunnyTimer);
        const bunnyInterval = Math.max(200, 700 - (this.state.level * 40));
        this.state.bunnyTimer = setInterval(() => this.popUpItem(), bunnyInterval);
    },

    /**
     * Ends the game.
     */
    endGame() {
        this.state.isPlaying = false;

        if (this.state.timer) clearInterval(this.state.timer);
        if (this.state.bunnyTimer) clearInterval(this.state.bunnyTimer);

        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('highScore', this.state.highScore);
            this.elements.highScore.textContent = this.state.highScore;
        }

        this.elements.finalScore.textContent = this.state.score;
        this.elements.finalHits.textContent = this.state.hits;
        this.elements.gameOver.classList.add('show');
        this.elements.startBtn.disabled = false;

        this.playSound('gameOver');
    },

    /**
     * Initializes the game, gets DOM elements, and sets up event listeners.
     */
    init() {
        // Get DOM elements
        this.elements.score = document.getElementById('score');
        this.elements.time = document.getElementById('time');
        this.elements.hits = document.getElementById('hits');
        this.elements.level = document.getElementById('level');
        this.elements.highScore = document.getElementById('highScore');
        this.elements.gameOver = document.getElementById('gameOver');
        this.elements.startBtn = document.getElementById('startBtn');
        this.elements.restartBtn = document.getElementById('restartBtn');
        this.elements.finalScore = document.getElementById('finalScore');
        this.elements.finalHits = document.getElementById('finalHits');
        this.elements.gameBoard = document.getElementById('gameBoard');
        this.elements.gameContainer = document.getElementById('gameContainer');

        // Load high score
        this.state.highScore = parseInt(localStorage.getItem('highScore')) || 0;
        this.elements.highScore.textContent = this.state.highScore;

        // Set up event listeners
        this.elements.startBtn.addEventListener('click', () => this.startGame());
        this.elements.restartBtn.addEventListener('click', () => this.startGame());
        window.addEventListener('load', () => this.initBoard());

        // Prevent zoom on mobile
        document.addEventListener('gesturestart', function (e) {
            e.preventDefault();
        });
    }
};

// Initialize the game when the script loads
Game.init();
