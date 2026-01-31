
// =================================================================
// 1. FIREBASE CONFIGURATION (REPLACE WITH YOUR ACTUAL CREDENTIALS)
// =================================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =================================================================
// 2. GLOBAL GAME VARIABLES & CONSTANTS
// =================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Dimensions
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Player Settings
const PLAYER_SIZE = 30;
let playerY = HEIGHT - PLAYER_SIZE - 20;
let playerX = 50;
let isJumping = false;
let jumpVelocity = 0;
const GRAVITY = 1.2;
const JUMP_FORCE = -20;

// Game State
let isPlaying = false;
let score = 0;
let obstacles = [];
let frameCount = 0;
let speed = 5;
let obstacleInterval = 90; // Frames between obstacles

// Economy
const BARRIERS_PER_PESO = 1000;
let userBalance = 0; // Stored in Pesos

// User ID (In a real Telegram bot, this would be the Telegram User ID)
// For this demo, we use a simple placeholder or generate a random one.
const USER_ID = "tg_user_" + Math.floor(Math.random() * 10000); 

// =================================================================
// 3. UI ELEMENTS
// =================================================================
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const withdrawalModal = document.getElementById('withdrawalModal');

const currentBarriersDisplay = document.getElementById('currentBarriers');
const pesoBalanceDisplay = document.getElementById('pesoBalance');
const withdrawBalanceDisplay = document.getElementById('withdrawBalanceDisplay');
const finalBarriersDisplay = document.getElementById('finalBarriers');
const pesoEarnedDisplay = document.getElementById('pesoEarned');
const modalBalanceDisplay = document.getElementById('modalBalance');
const withdrawalMessage = document.getElementById('withdrawalMessage');


// =================================================================
// 4. GAME CORE FUNCTIONS
// =================================================================

/** Draws the player (a simple square) */
function drawPlayer() {
    ctx.fillStyle = '#ff5722'; // Orange/Red
    ctx.fillRect(playerX, playerY, PLAYER_SIZE, PLAYER_SIZE);
}

/** Handles the jump physics */
function updatePlayer() {
    if (isJumping) {
        playerY += jumpVelocity;
        jumpVelocity += GRAVITY;

        // Check if player lands back on the ground
        if (playerY >= HEIGHT - PLAYER_SIZE - 20) {
            playerY = HEIGHT - PLAYER_SIZE - 20;
            isJumping = false;
            jumpVelocity = 0;
        }
    }
}

/** Handles the creation and movement of obstacles */
function updateObstacles() {
    // Add new obstacle
    if (frameCount % obstacleInterval === 0) {
        const obstacleHeight = Math.random() * (100 - 30) + 30;
        const obstacleWidth = 20;
        const obstacleY = HEIGHT - obstacleHeight - 20; // Ensure it sits on the ground line
        
        obstacles.push({
            x: WIDTH,
            y: obstacleY,
            width: obstacleWidth,
            height: obstacleHeight,
            passed: false
        });

        // Increase difficulty slightly
        speed += 0.05;
        obstacleInterval = Math.max(60, 90 - Math.floor(score / 50));
    }

    // Move and draw obstacles
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= speed;

        ctx.fillStyle = '#333'; // Dark gray
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // Check if obstacle is passed
        if (obs.x + obs.width < playerX && !obs.passed) {
            obs.passed = true;
            score++;
            currentBarriersDisplay.textContent = score;
        }

        // Collision detection (AABB)
        if (
            playerX < obs.x + obs.width &&
            playerX + PLAYER_SIZE > obs.x &&
            playerY < obs.y + obs.height &&
            playerY + PLAYER_SIZE > obs.y
        ) {
            gameOver();
            return;
        }
    }

    // Remove off-screen obstacles
    obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
}

/** Main game loop */
function gameLoop() {
    if (!isPlaying) return;

    // 1. Clear canvas and draw ground
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#4CAF50'; // Green ground
    ctx.fillRect(0, HEIGHT - 20, WIDTH, 20);

    // 2. Update and draw elements
    updatePlayer();
    updateObstacles();
    drawPlayer();

    frameCount++;
    requestAnimationFrame(gameLoop);
}

/** Starts the game */
function startGame() {
    if (isPlaying) return;

    // Reset state
    isPlaying = true;
    score = 0;
    speed = 5;
    obstacles = [];
    frameCount = 0;
    playerY = HEIGHT - PLAYER_SIZE - 20;
    isJumping = false;
    
    // UI
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    currentBarriersDisplay.textContent = 0;

    gameLoop();
}

/** Ends the game and saves score */
async function gameOver() {
    isPlaying = false;
    
    // Calculate earnings
    const pesoEarned = score / BARRIERS_PER_PESO;

    // Update UI
    finalBarriersDisplay.textContent = score;
    pesoEarnedDisplay.textContent = pesoEarned.toFixed(2);
    gameOverScreen.classList.remove('hidden');

    // Save score and update balance
    await saveGameResult(score, pesoEarned);
}

// =================================================================
// 5. FIREBASE / ECONOMY FUNCTIONS
// =================================================================

/** Saves the game result (barriers and peso earned) to Firestore */
async function saveGameResult(barriers, peso) {
    try {
        // 1. Add game session record (for auditing)
        await db.collection('game_sessions').add({
            userId: USER_ID,
            barriers: barriers,
            pesoEarned: peso,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Update the user's main balance atomically
        const userRef = db.collection('users').doc(USER_ID);

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                // Create new user record
                transaction.set(userRef, {
                    balance: peso,
                    totalBarriers: barriers,
                    gcashNumber: null,
                    lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Update existing user record
                const newBalance = userDoc.data().balance + peso;
                const newTotalBarriers = userDoc.data().totalBarriers + barriers;
                
                transaction.update(userRef, {
                    balance: newBalance,
                    totalBarriers: newTotalBarriers,
                    lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        console.log(`Score saved. Balance updated by ₱${peso.toFixed(2)}.`);
        // Reload balance display after successful save
        await loadUserBalance();

    } catch (error) {
        console.error("Error saving game result:", error);
    }
}

/** Loads the user's current balance from Firestore */
async function loadUserBalance() {
    try {
        const userDoc = await db.collection('users').doc(USER_ID).get();
        if (userDoc.exists) {
            userBalance = userDoc.data().balance || 0;
        } else {
            userBalance = 0;
        }
        
        pesoBalanceDisplay.textContent = userBalance.toFixed(2);
        withdrawBalanceDisplay.textContent = userBalance.toFixed(2);
        modalBalanceDisplay.textContent = userBalance.toFixed(2);

    } catch (error) {
        console.error("Error loading balance:", error);
        userBalance = 0;
    }
}

/** Handles the withdrawal request submission */
async function submitWithdrawalRequest() {
    const amountInput = document.getElementById('withdrawAmount');
    const gcashInput = document.getElementById('gcashNumber');
    
    const amount = parseFloat(amountInput.value);
    const gcashNumber = gcashInput.value.trim();
    
    withdrawalMessage.textContent = '';

    if (isNaN(amount) || amount <= 0) {
        withdrawalMessage.textContent = 'Please enter a valid amount.';
        return;
    }
    if (amount < 50) {
        withdrawalMessage.textContent = 'Minimum withdrawal is ₱50.00.';
        return;
    }
    if (amount > userBalance) {
        withdrawalMessage.textContent = 'Insufficient balance.';
        return;
    }
    if (!gcashNumber || gcashNumber.length < 11) {
        withdrawalMessage.textContent = 'Please enter a valid GCash number.';
        return;
    }

    try {
        // 1. Deduct the amount from the user's balance and submit request atomically
        const userRef = db.collection('users').doc(USER_ID);

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const currentBalance = userDoc.data().balance;

            if (currentBalance < amount) {
                throw new Error("Insufficient funds during transaction.");
            }

            // Update user balance
            const newBalance = currentBalance - amount;
            transaction.update(userRef, {
                balance: newBalance,
                gcashNumber: gcashNumber // Save GCash number for future use
            });

            // Create a withdrawal request record for the admin dashboard
            await db.collection('withdrawals').add({
                userId: USER_ID,
                amount: amount,
                gcash: gcashNumber,
                status: 'Pending', // Admin manually changes this to 'Approved'/'Rejected'
                requestedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        withdrawalMessage.textContent = `Withdrawal request for ₱${amount.toFixed(2)} submitted! Processing...`;
        amountInput.value = '';
        gcashInput.value = gcashNumber; // Keep number filled
        
        // Update UI balance
        await loadUserBalance();

    } catch (error) {
        console.error("Withdrawal error:", error);
        withdrawalMessage.textContent = `Error: ${error.message || 'Failed to submit request.'}`;
    }
}

// =================================================================
// 6. EVENT LISTENERS
// =================================================================

// Keyboard input (Spacebar or Up Arrow for Jump)
document.addEventListener('keydown', (e) => {
    if (isPlaying && (e.code === 'Space' || e.code === 'ArrowUp')) {
        if (!isJumping) {
            isJumping = true;
            jumpVelocity = JUMP_FORCE;
        }
    }
});

// UI Buttons
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('retryButton').addEventListener('click', startGame);

document.getElementById('withdrawalButton').addEventListener('click', () => {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    withdrawalModal.classList.remove('hidden');
    // Ensure modal balance is updated
    modalBalanceDisplay.textContent = userBalance.toFixed(2);
});

document.getElementById('closeModal').addEventListener('click', () => {
    withdrawalModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
    withdrawalMessage.textContent = '';
});

document.getElementById('submitWithdrawal').addEventListener('click', submitWithdrawalRequest);


// =================================================================
// 7. INITIALIZATION
// =================================================================
window.onload = () => {
    // Load initial balance when the app starts
    loadUserBalance();
    console.log(`Initialized for User ID: ${USER_ID}`);
};
