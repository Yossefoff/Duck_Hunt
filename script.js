const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let score = 0;
let ducksShot = 0; // Ducks shot in current level
const ducksPerLevel = 10;
let isGameOver = false;
let isPlaying = false;
let lastTime = 0;
let ducks = [];
let spawnTimer = 0;
const spawnInterval = 1000; // Spawn a duck every 1 second
let ammo = 20;
let level = 1;

// Level Configuration
const levelConfig = [
    { level: 1, ammo: 20, speedMultiplier: 1.0 },
    { level: 2, ammo: 15, speedMultiplier: 1.3 }, // Increased speed
    { level: 3, ammo: 12, speedMultiplier: 1.6 }, // Increased speed
    { level: 4, ammo: 10, speedMultiplier: 2.0 }, // Increased speed
    { level: 5, ammo: 10, speedMultiplier: 2.5 }  // Much Faster!
];

// UI Elements
const scoreElement = document.getElementById('score');
const ammoElement = document.getElementById('ammo');
const levelElement = document.getElementById('level');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const gameOverTitle = gameOverScreen.querySelector('h1');
const levelUpElement = document.getElementById('level-up');

// Audio Context for simple sound
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playEmptyClickSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
}

function playLevelUpSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

class Duck {
    constructor(speedMultiplier) {
        this.size = 40;
        this.x = -this.size;
        this.y = Math.random() * (canvas.height - 150) + 50; // Random height, keep away from bottom
        this.speed = (Math.random() * 200 + 100) * speedMultiplier; // Pixels per second
        this.direction = 1; // 1 for right
        this.color = '#8B4513'; // SaddleBrown
        this.wingState = 0;
        this.wingSpeed = 10 * speedMultiplier;
        this.isDead = false;
        this.deadTimer = 0;
    }

    update(deltaTime) {
        if (this.isDead) {
            this.deadTimer += deltaTime;
            return; // Don't move if dead
        }

        // Move based on time to be framerate independent
        this.x += this.speed * this.direction * (deltaTime / 1000);
        this.wingState += this.wingSpeed * (deltaTime / 1000);
    }

    draw() {
        if (this.isDead && this.deadTimer > 500) return; // Don't draw if dead for a while

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.isDead) {
            ctx.fillStyle = 'red';
            ctx.font = '30px Arial';
            ctx.fillText('POW!', 0, 0);
        } else {
            // Body
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = '#006400'; // DarkGreen
            ctx.beginPath();
            ctx.arc(15, -10, 10, 0, Math.PI * 2);
            ctx.fill();

            // Beak
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.moveTo(22, -8);
            ctx.lineTo(32, -5);
            ctx.lineTo(22, -2);
            ctx.fill();

            // Wing (Simple animation)
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            const wingOffset = Math.sin(this.wingState) * 10;
            ctx.ellipse(-5, -5 + wingOffset, 12, 8, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    isClicked(mouseX, mouseY) {
        if (this.isDead) return false;
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        // Simple circle collision
        return Math.sqrt(dx * dx + dy * dy) < this.size;
    }
}

function startGame() {
    score = 0;
    level = 1;
    startLevel(level);
    startBtn.style.display = 'none';
    gameOverScreen.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function startLevel(lvl) {
    level = lvl;
    const config = levelConfig[lvl - 1];
    ammo = config.ammo;
    ducksShot = 0; // Reset ducks shot for this level
    ducks = [];
    isPlaying = true;

    scoreElement.textContent = score;
    ammoElement.textContent = ammo;
    levelElement.textContent = level;

    // Show level start message
    showLevelUp();
    console.log(`Starting Level ${level}`);
}

function showLevelUp() {
    if (levelUpElement) {
        levelUpElement.textContent = `LEVEL ${level}`;
        levelUpElement.classList.remove('fade-in-out');
        void levelUpElement.offsetWidth; // Trigger reflow
        levelUpElement.classList.add('fade-in-out');
    }
}

function nextLevel() {
    if (level >= 5) {
        winGame();
    } else {
        playLevelUpSound();
        level++;
        startLevel(level);
        // Fix: Restart the loop because the previous loop ended when calling nextLevel
        requestAnimationFrame(gameLoop);
    }
}

function winGame() {
    isGameOver = true;
    isPlaying = false;
    gameOverTitle.textContent = "YOU WIN!";
    gameOverTitle.style.color = "#00ff00";
    gameOverScreen.classList.remove('hidden');
    finalScoreElement.textContent = score;
}

function endGame() {
    isGameOver = true;
    isPlaying = false;
    gameOverTitle.textContent = "GAME OVER";
    gameOverTitle.style.color = "#ffcc00";
    gameOverScreen.classList.remove('hidden');
    finalScoreElement.textContent = score;
}

function gameLoop(timestamp) {
    if (!isPlaying) return;

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spawn Ducks
    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval && ducks.length < 5) { // Max 5 ducks on screen
        const config = levelConfig[level - 1];
        ducks.push(new Duck(config.speedMultiplier));
        spawnTimer = 0;
    }

    // Update and Draw Ducks
    let activeDucks = 0;
    for (let i = ducks.length - 1; i >= 0; i--) {
        const duck = ducks[i];
        duck.update(deltaTime);
        duck.draw();

        // Remove if off screen or dead for too long
        if (duck.x > canvas.width + 50 || (duck.isDead && duck.deadTimer > 500)) {
            ducks.splice(i, 1);
            if (!duck.isDead) {
                // Missed duck logic
            }
        } else {
            if (!duck.isDead) activeDucks++;
        }
    }

    // Check Level Progression
    if (ducksShot >= ducksPerLevel) {
        nextLevel();
    } else if (ammo <= 0 && activeDucks === 0 && ducksShot < ducksPerLevel) {
        // Fallback game over if somehow we missed the immediate check
        endGame();
    } else {
        requestAnimationFrame(gameLoop);
    }
}

canvas.addEventListener('mousedown', (e) => {
    if (!isPlaying) return;

    if (ammo <= 0) {
        playEmptyClickSound();
        return;
    }

    ammo--;
    ammoElement.textContent = ammo;
    playShootSound();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let hit = false;
    // Check collision in reverse order (topmost first)
    for (let i = ducks.length - 1; i >= 0; i--) {
        if (ducks[i].isClicked(mouseX, mouseY)) {
            ducks[i].isDead = true;
            score += 10;
            ducksShot++;
            scoreElement.textContent = score;
            hit = true;
            break; // One shot, one kill
        }
    }

    // Check for game over immediately if ammo is 0 and we can't possibly win
    // (e.g. need 5 more kills but 0 ammo)
    if (ammo === 0 && ducksShot < ducksPerLevel) {
        endGame();
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Draw initial background/message
ctx.fillStyle = '#333';
ctx.font = '30px Arial';
ctx.textAlign = 'center';
ctx.fillText('Press Start to Play', canvas.width / 2, canvas.height / 2);
