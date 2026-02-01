
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const analytics = firebase.analytics();

// DOM Elements
const authSection = document.getElementById('auth-section');
const telegramUsernameInput = document.getElementById('telegram-username');
const loginBtn = document.getElementById('login-btn');
const authStatus = document.getElementById('auth-status');

const mainApp = document.getElementById('main-app');
const displayUsername = document.getElementById('display-username');
const userBalanceSpan = document.getElementById('user-balance');
const adButtonsContainer = document.getElementById('ad-buttons-container');

const gcashNumberInput = document.getElementById('gcash-number');
const requestWithdrawalBtn = document.getElementById('request-withdrawal-btn');
const withdrawalStatusP = document.getElementById('withdrawal-status');
const withdrawalHistoryUl = document.getElementById('withdrawal-history');

const chatMessagesDiv = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

const leaderboardList = document.getElementById('leaderboard-list');

const adminDashboard = document.getElementById('admin-dashboard');
const adminPasswordInput = document.getElementById('admin-password');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminContent = document.getElementById('admin-content');
const pendingWithdrawalsUl = document.getElementById('pending-withdrawals');
const allUsersList = document.getElementById('all-users-list');
const adminChatLogDiv = document.getElementById('admin-chat-log');

// Constants
const REWARD_PER_AD = 0.0068;
const COOLDOWN_SECONDS = 60; // 1 minute
const MIN_WITHDRAWAL = 0.02;
const ADMIN_PASSWORD = "Propetas12";

// Adsterra Smartlinks (Array of objects for easier management)
const adsterraSmartlinks = [
    { id: 'ad1', url: 'https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981' },
    { id: 'ad2', url: 'https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c' },
    { id: 'ad3', url: 'https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232' },
    { id: 'ad4', url: 'https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf' }
];

let currentUser = null;
let userBalance = 0;
let cooldowns = {}; // Stores last click time for each ad button per user

// --- Utility Functions ---
function formatCurrency(amount) {
    return amount.toFixed(4); // Display up to 4 decimal places for small amounts
}

function showPopunder() {
    // This script will automatically trigger the popunder when loaded
    // We can re-insert the script to force it, but often it's tied to page load or user interaction.
    // For demonstration, we'll assume it's active.
    console.log("Popunder ad triggered (if configured by Adsterra to show on interaction).");
    // You might need to dynamically create and append the script tags again
    // to force a new popunder, but this can be aggressive and against ad network policies.
    // A simpler approach is to let the initial script handle it.
}

// --- Authentication ---
loginBtn.addEventListener('click', async () => {
    const username = telegramUsernameInput.value.trim();
    if (!username) {
        authStatus.textContent = "Please enter your Telegram username.";
        return;
    }

    // Use a simple anonymous login for now, associating the username.
    // In a real app, you'd want more robust authentication (e.g., Firebase Email/Password, Google, etc.)
    // and then link the Telegram username.
    try {
        const userCredential = await auth.signInAnonymously();
        const uid = userCredential.user.uid;

        // Check if user exists in database, if not, create them
        const userRef = database.ref(`users/${uid}`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            await userRef.set({
                username: username,
                balance: 0,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastAdClick: {} // Store cooldowns per ad ID
            });
            authStatus.textContent = `Welcome, ${username}! Your account has been created.`;
        } else {
            // Update username if it changed (optional)
            await userRef.update({ username: username });
            authStatus.textContent = `Welcome back, ${username}!`;
        }
        currentUser = { uid: uid, username: username };
    } catch (error) {
        console.error("Authentication error:", error);
        authStatus.textContent = `Error: ${error.message}`;
    }
});

auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        currentUser = user; // Update currentUser object
        const userRef = database.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        if (snapshot.exists()) {
            const userData = snapshot.val();
            currentUser.username = userData.username;
            displayUsername.textContent = currentUser.username;
            userBalance = userData.balance || 0;
            userBalanceSpan.textContent = formatCurrency(userBalance);
            cooldowns = userData.lastAdClick || {};

            authSection.style.display = 'none';
            mainApp.style.display = 'block';
            adminDashboard.style.display = 'block'; // Always show admin login for now

            // Load user-specific data
            listenForBalanceChanges(user.uid);
            renderAdButtons();
            listenForWithdrawalHistory(user.uid);
            listenForChatMessages();
            listenForLeaderboard();
        } else {
            // This case should ideally not happen if user creation is handled correctly
            authStatus.textContent = "User data not found. Please try logging in again.";
            auth.signOut();
        }
    } else {
        // User is signed out.
        currentUser = null;
        authSection.style.display = 'block';
        mainApp.style.display = 'none';
        adminDashboard.style.display = 'block'; // Always show admin login for now
        authStatus.textContent = "";
        telegramUsernameInput.value = "";
    }
});

// --- User Balance & Ad Clicks ---
function listenForBalanceChanges(uid) {
    database.ref(`users/${uid}/balance`).on('value', (snapshot) => {
        userBalance = snapshot.val() || 0;
        userBalanceSpan.textContent = formatCurrency(userBalance);
    });
    database.ref(`users/${uid}/lastAdClick`).on('value', (snapshot) => {
        cooldowns = snapshot.val() || {};
        renderAdButtons(); // Re-render to update cooldown states
    });
}

function renderAdButtons() {
    adButtonsContainer.innerHTML = '';
    adsterraSmartlinks.forEach(ad => {
        const button = document.createElement('button');
        button.classList.add('ad-button');
        button.textContent = `Click Ad ${ad.id.replace('ad', '')}`;
        button.dataset.adId = ad.id;
        button.dataset.adUrl = ad.url;

        const lastClickTime = cooldowns[ad.id] || 0;
        const timeSinceLastClick = (Date.now() - lastClickTime) / 1000; // in seconds
        const timeLeft = COOLDOWN_SECONDS - timeSinceLastClick;

        if (timeLeft > 0) {
            button.disabled = true;
            button.textContent = `Ad ${ad.id.replace('ad', '')} (Cooldown: ${Math.ceil(timeLeft)}s)`;
            // Update cooldown text every second
            const interval = setInterval(() => {
                const newTimeLeft = COOLDOWN_SECONDS - (Date.now() - cooldowns[ad.id]) / 1000;
                if (newTimeLeft <= 0) {
                    button.disabled = false;
                    button.textContent = `Click Ad ${ad.id.replace('ad', '')}`;
                    clearInterval(interval);
                } else {
                    button.textContent = `Ad ${ad.id.replace('ad', '')} (Cooldown: ${Math.ceil(newTimeLeft)}s)`;
                }
            }, 1000);
        }

        button.addEventListener('click', () => handleAdClick(ad.id, ad.url, button));
        adButtonsContainer.appendChild(button);
    });
}

async function handleAdClick(adId, adUrl, buttonElement) {
    if (!currentUser) {
        alert("Please log in first.");
        return;
    }

    // Check cooldown again to prevent double clicks during network latency
    const lastClickTime = cooldowns[adId] || 0;
    const timeSinceLastClick = (Date.now() - lastClickTime) / 1000;
    if (timeSinceLastClick < COOLDOWN_SECONDS) {
        alert(`This ad is on cooldown. Please wait ${Math.ceil(COOLDOWN_SECONDS - timeSinceLastClick)} seconds.`);
        return;
    }

    buttonElement.disabled = true;
    buttonElement.textContent = `Loading Ad...`;

    // Open Adsterra Smartlink in a new tab
    window.open(adUrl, '_blank');

    // Show popunder ad (if Adsterra's script allows programmatic trigger or it's passive)
    showPopunder();

    // Update user balance and cooldown in Firebase
    const userRef = database.ref(`users/${currentUser.uid}`);
    try {
        await userRef.transaction((currentData) => {
            if (currentData) {
                currentData.balance = (currentData.balance || 0) + REWARD_PER_AD;
                if (!currentData.lastAdClick) {
                    currentData.lastAdClick = {};
                }
                currentData.lastAdClick[adId] = Date.now();
            }
            return currentData;
        });
        console.log(`User ${currentUser.username} earned ₱${REWARD_PER_AD} from ad ${adId}.`);
        // The balance listener will update the UI
    } catch (error) {
        console.error("Error updating balance:", error);
        alert("Error earning reward. Please try again.");
    } finally {
        // Cooldown will be re-rendered by the listener
    }
}

// --- Withdrawal System ---
requestWithdrawalBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert("Please log in to request a withdrawal.");
        return;
    }

    const gcashNumber = gcashNumberInput.value.trim();
    if (!gcashNumber || !/^\d{11}$/.test(gcashNumber)) { // Basic GCash number validation
        withdrawalStatusP.textContent = "Please enter a valid 11-digit GCash number.";
        withdrawalStatusP.style.color = 'red';
        return;
    }

    if (userBalance < MIN_WITHDRAWAL) {
        withdrawalStatusP.textContent = `Minimum withdrawal is ₱${MIN_WITHDRAWAL.toFixed(2)}. Your balance is ₱${formatCurrency(userBalance)}.`;
        withdrawalStatusP.style.color = 'red';
        return;
    }

    requestWithdrawalBtn.disabled = true;
    withdrawalStatusP.textContent = "Processing withdrawal request...";
    withdrawalStatusP.style.color = 'orange';

    try {
        const withdrawalRef = database.ref('withdrawals').push();
        await withdrawalRef.set({
            userId: currentUser.uid,
            username: currentUser.username,
            amount: userBalance, // Withdraw full balance
            gcashNumber: gcashNumber,
            status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        // Reset user balance to 0 after request
        await database.ref(`users/${currentUser.uid}/balance`).set(0);

        withdrawalStatusP.textContent = `Withdrawal request for ₱${formatCurrency(userBalance)} to ${gcashNumber} submitted successfully! Status: Pending.`;
        withdrawalStatusP.style.color = 'green';
        gcashNumberInput.value = ''; // Clear input
    } catch (error) {
        console.error("Error requesting withdrawal:", error);
        withdrawalStatusP.textContent = `Error submitting withdrawal: ${error.message}`;
        withdrawalStatusP.style.color = 'red';
    } finally {
        requestWithdrawalBtn.disabled = false;
    }
});

function listenForWithdrawalHistory(uid) {
    database.ref('withdrawals').orderByChild('userId').equalTo(uid).on('value', (snapshot) => {
        withdrawalHistoryUl.innerHTML = '';
        const withdrawals = [];
        snapshot.forEach(childSnapshot => {
            withdrawals.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        withdrawals.sort((a, b) => b.timestamp - a.timestamp); // Newest first

        if (withdrawals.length === 0) {
            withdrawalHistoryUl.innerHTML = '<li>No withdrawal history.</li>';
            return;
        }

        withdrawals.forEach(withdrawal => {
            const li = document.createElement('li');
            const date = new Date(withdrawal.timestamp).toLocaleString();
            li.innerHTML = `
                Amount: ₱${formatCurrency(withdrawal.amount)} | GCash: ${withdrawal.gcashNumber} | Status: <strong>${withdrawal.status}</strong> (${date})
            `;
            withdrawalHistoryUl.appendChild(li);
        });
    });
}

// --- Chat Room ---
sendChatBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert("Please log in to chat.");
        return;
    }
    const message = chatInput.value.trim();
    if (message) {
        try {
            await database.ref('chat').push({
                userId: currentUser.uid,
                username: currentUser.username,
                message: message,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            chatInput.value = '';
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }
});

function listenForChatMessages() {
    database.ref('chat').limitToLast(50).on('child_added', (snapshot) => {
        const messageData = snapshot.val();
        const div = document.createElement('div');
        div.classList.add('chat-message');
        const date = new Date(messageData.timestamp).toLocaleTimeString();
        div.innerHTML = `<strong>${messageData.username}</strong> (${date}): ${messageData.message}`;
        chatMessagesDiv.appendChild(div);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Auto-scroll to bottom
        if (adminContent.style.display === 'block') { // Also update admin chat log
            adminChatLogDiv.appendChild(div.cloneNode(true));
            adminChatLogDiv.scrollTop = adminChatLogDiv.scrollHeight;
        }
    });
}

// --- Leaderboard ---
function listenForLeaderboard() {
    database.ref('users').orderByChild('balance').limitToLast(10).on('value', (snapshot) => {
        leaderboardList.innerHTML = '';
        const users = [];
        snapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            users.push({ username: userData.username, balance: userData.balance || 0 });
        });
        users.sort((a, b) => b.balance - a.balance); // Descending order

        if (users.length === 0) {
            leaderboardList.innerHTML = '<li>No users yet.</li>';
            return;
        }

        users.forEach((user, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${index + 1}. ${user.username}</strong>: ₱${formatCurrency(user.balance)}`;
            leaderboardList.appendChild(li);
        });
    });
}

// --- Admin Dashboard ---
adminLoginBtn.addEventListener('click', () => {
    const password = adminPasswordInput.value;
    if (password === ADMIN_PASSWORD) {
        adminContent.style.display = 'block';
        adminPasswordInput.style.display = 'none';
        adminLoginBtn.style.display = 'none';
        listenForPendingWithdrawals();
        listenForAllUsers();
        listenForAdminChatLog();
    } else {
        alert("Incorrect Admin Password!");
    }
});

function listenForPendingWithdrawals() {
    database.ref('withdrawals').orderByChild('status').equalTo('pending').on('value', (snapshot) => {
        pendingWithdrawalsUl.innerHTML = '';
        const pending = [];
        snapshot.forEach(childSnapshot => {
            pending.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        pending.sort((a, b) => a.timestamp - b.timestamp); // Oldest first

        if (pending.length === 0) {
            pendingWithdrawalsUl.innerHTML = '<li>No pending withdrawals.</li>';
            return;
        }

        pending.forEach(withdrawal => {
            const li = document.createElement('li');
            li.classList.add('withdrawal-item');
            const date = new Date(withdrawal.timestamp).toLocaleString();
            li.innerHTML = `
                <span>
                    User: <strong>${withdrawal.username}</strong> (ID: ${withdrawal.userId.substring(0, 6)}...)<br>
                    Amount: ₱${formatCurrency(withdrawal.amount)} | GCash: ${withdrawal.gcashNumber}<br>
                    Requested: ${date}
                </span>
                <div>
                    <button data-withdrawal-id="${withdrawal.id}" data-action="approve">Approve</button>
                    <button data-withdrawal-id="${withdrawal.id}" data-action="reject" style="background-color: #dc3545;">Reject</button>
                </div>
            `;
            pendingWithdrawalsUl.appendChild(li);
        });
    });
}

pendingWithdrawalsUl.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.tagName === 'BUTTON' && target.dataset.withdrawalId) {
        const withdrawalId = target.dataset.withdrawalId;
        const action = target.dataset.action;

        try {
            await database.ref(`withdrawals/${withdrawalId}`).update({
                status: action === 'approve' ? 'approved' : 'rejected',
                processedBy: 'admin', // Could be current admin user ID if implemented
                processedAt: firebase.database.ServerValue.TIMESTAMP
            });
            alert(`Withdrawal ${withdrawalId} ${action}d.`);
        } catch (error) {
            console.error(`Error ${action}ing withdrawal:`, error);
            alert(`Failed to ${action} withdrawal.`);
        }
    }
});

function listenForAllUsers() {
    database.ref('users').on('value', (snapshot) => {
        allUsersList.innerHTML = '';
        const users = [];
        snapshot.forEach(childSnapshot => {
            users.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        users.sort((a, b) => b.balance - a.balance); // Sort by balance

        if (users.length === 0) {
            allUsersList.innerHTML = '<li>No users registered.</li>';
            return;
        }

        users.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${user.username}</strong> (ID: ${user.id.substring(0, 6)}...)<br>
                Balance: ₱${formatCurrency(user.balance)} | Created: ${new Date(user.createdAt).toLocaleDateString()}
            `;
            allUsersList.appendChild(li);
        });
    });
}

function listenForAdminChatLog() {
    // Admin chat log will be updated by the main chat listener
    // No separate listener needed if `listenForChatMessages` clones to admin log.
}

// Initial render of ad buttons if user is not logged in (they will be disabled)
renderAdButtons();
