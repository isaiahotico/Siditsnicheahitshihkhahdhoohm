
// --- CONFIGURATION ---
const REWARD_PER_AD = 0.01;
const MIN_WITHDRAWAL = 0.02;
const ADMIN_PASSWORD = "Propetas12";

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
const auth = app.auth();
const db = app.database();
const analytics = firebase.analytics();

let currentUserData = null;
let currentUserId = null;
let isAdmin = false;

// --- UTILITY FUNCTIONS ---

/**
 * Switches between content sections based on the navigation bar click.
 * @param {string} targetId 
 */
function switchContent(targetId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(targetId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.nav-item[data-target="${targetId}"]`).classList.add('active');

    // Special handling for sections that need real-time updates
    if (targetId === 'leaderboard') {
        loadLeaderboard();
    }
    if (targetId === 'withdraw') {
        loadWithdrawalHistory();
        document.getElementById('withdraw-balance').textContent = currentUserData.balance.toFixed(2);
        document.getElementById('gcash-number').value = currentUserData.gcash_number || '';
    }
    if (targetId === 'admin-panel' && isAdmin) {
        loadPendingWithdrawals();
    }
}

// Attach navigation listeners
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const target = e.target.getAttribute('data-target');
        if (target) {
            switchContent(target);
        }
    });
});

/**
 * Toggles between Login and Register forms.
 * @param {boolean} showLogin 
 */
function toggleAuth(showLogin) {
    document.getElementById('login-form').classList.toggle('hidden', !showLogin);
    document.getElementById('register-form').classList.toggle('hidden', showLogin);
}

// --- AUTHENTICATION ---

auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadUserData(user.uid);
        setupChatListener();
    } else {
        currentUserId = null;
        currentUserData = null;
        isAdmin = false;
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('admin-nav').style.display = 'none';
    }
});

async function registerUser() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const username = document.getElementById('register-username').value;
    const gcash = document.getElementById('register-gcash').value;

    if (!email || !password || !username || !gcash) {
        alert("Please fill all fields.");
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        await db.ref('users/' + uid).set({
            username: username,
            gcash_number: gcash,
            balance: 0.00,
            ads_watched: 0,
            is_admin: false
        });
        alert("Registration successful! Logging in...");
    } catch (error) {
        alert("Registration failed: " + error.message);
    }
}

function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            alert("Login failed: " + error.message);
        });
}

function loginAdmin() {
    // Simple way to trigger admin login form view
    const adminEmail = prompt("Enter Admin Email:");
    if (!adminEmail) return;
    const adminPassword = prompt("Enter Admin Password:");
    if (!adminPassword) return;

    auth.signInWithEmailAndPassword(adminEmail, adminPassword)
        .then(() => {
            // Check if the user is actually an admin in the database
            db.ref('users/' + auth.currentUser.uid).once('value', snapshot => {
                if (snapshot.val() && snapshot.val().is_admin === true) {
                    alert("Admin Login Successful!");
                } else {
                    alert("User is not registered as Admin. Logging out.");
                    auth.signOut();
                }
            });
        })
        .catch(error => {
            alert("Admin Login failed: " + error.message);
        });
}

function logoutUser() {
    auth.signOut();
}

// --- USER DATA MANAGEMENT ---

function loadUserData(uid) {
    db.ref('users/' + uid).on('value', (snapshot) => {
        currentUserData = snapshot.val();
        if (currentUserData) {
            updateDashboardUI();
        }
    });
}

function updateDashboardUI() {
    document.getElementById('user-balance').textContent = currentUserData.balance.toFixed(2);
    document.getElementById('ads-watched-count').textContent = currentUserData.ads_watched;
    
    // Check for Admin status
    isAdmin = currentUserData.is_admin || false;
    document.getElementById('admin-nav').style.display = isAdmin ? 'block' : 'none';
}

// --- MONETAG AD INTEGRATION & REWARDING ---

function rewardUser() {
    if (!currentUserId || !currentUserData) return;

    const newBalance = currentUserData.balance + REWARD_PER_AD;
    const newAdsWatched = currentUserData.ads_watched + 1;

    // Update Firebase
    db.ref('users/' + currentUserId).update({
        balance: newBalance,
        ads_watched: newAdsWatched
    }).then(() => {
        alert(`Success! You earned ₱${REWARD_PER_AD.toFixed(2)}. New Balance: ₱${newBalance.toFixed(2)}`);
    }).catch(error => {
        console.error("Failed to update user balance:", error);
        alert("Error rewarding user. Please try again.");
    });
}

function watchRewardedAd() {
    const watchButton = document.getElementById('watch-ad-btn');
    watchButton.textContent = "Loading Ad...";
    watchButton.classList.add('btn-disabled');
    watchButton.disabled = true;

    // Monetag Rewarded Interstitial Call
    show_10276123().then(() => {
        // This block executes when the user successfully watches the ad
        rewardUser();
    }).catch(e => {
        // This block executes if there's an error or the ad is closed prematurely (depending on Monetag's specific implementation)
        console.error("Ad failed or closed:", e);
        alert("Ad failed or was closed. Please try again.");
    }).finally(() => {
        // Re-enable the button regardless of the outcome
        watchButton.textContent = "WATCH AD & EARN ₱0.01";
        watchButton.classList.remove('btn-disabled');
        watchButton.disabled = false;
    });
}

// --- WITHDRAWAL LOGIC ---

function submitWithdrawal() {
    if (!currentUserData) return;

    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const gcash = document.getElementById('gcash-number').value;
    const currentBalance = currentUserData.balance;

    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
        alert(`Minimum withdrawal is ₱${MIN_WITHDRAWAL.toFixed(2)}.`);
        return;
    }
    if (amount > currentBalance) {
        alert("Insufficient balance.");
        return;
    }
    if (!gcash || gcash.length !== 11 || !gcash.startsWith('09')) {
        alert("Please enter a valid 11-digit GCash number (starting with 09).");
        return;
    }

    if (!confirm(`Confirm withdrawal of ₱${amount.toFixed(2)} to GCash ${gcash}?`)) {
        return;
    }

    const newBalance = currentBalance - amount;
    const withdrawalRef = db.ref('withdrawals').push();

    // 1. Create the withdrawal request
    withdrawalRef.set({
        userId: currentUserId,
        username: currentUserData.username,
        amount: amount,
        gcash_number: gcash,
        status: 'Pending',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        // 2. Deduct the balance
        return db.ref('users/' + currentUserId).update({
            balance: newBalance
        });
    }).then(() => {
        alert("Withdrawal request submitted successfully! Please wait for admin processing.");
        document.getElementById('withdraw-amount').value = '';
    }).catch(error => {
        console.error("Withdrawal failed:", error);
        alert("Error submitting withdrawal. Please try again.");
    });
}

function loadWithdrawalHistory() {
    const historyList = document.getElementById('withdrawal-history');
    historyList.innerHTML = '<li>Loading history...</li>';

    db.ref('withdrawals').orderByChild('userId').equalTo(currentUserId).limitToLast(10).on('value', snapshot => {
        historyList.innerHTML = '';
        if (!snapshot.exists()) {
            historyList.innerHTML = '<li>No withdrawal history found.</li>';
            return;
        }

        snapshot.forEach(childSnapshot => {
            const req = childSnapshot.val();
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            
            let statusColor = 'yellow';
            if (req.status === 'Completed') statusColor = '#4CAF50';
            if (req.status === 'Rejected') statusColor = 'red';

            li.innerHTML = `
                <span>₱${req.amount.toFixed(2)}</span>
                <span style="color: ${statusColor};">${req.status}</span>
            `;
            historyList.prepend(li); // Show newest first
        });
    });
}

// --- CHAT ROOM LOGIC ---

function setupChatListener() {
    const chatMessages = document.getElementById('chat-messages');
    
    // Listen for new messages
    db.ref('chat').limitToLast(50).on('child_added', (snapshot) => {
        const message = snapshot.val();
        const msgElement = document.createElement('div');
        msgElement.className = 'chat-message';
        
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        msgElement.innerHTML = `
            <span class="chat-user">${message.user} (${time}):</span>
            <span>${message.message}</span>
        `;
        chatMessages.appendChild(msgElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto scroll to bottom
    });
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const messageText = chatInput.value.trim();

    if (!messageText || !currentUserData) return;

    db.ref('chat').push().set({
        user: currentUserData.username || 'Anonymous',
        message: messageText,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        chatInput.value = '';
    }).catch(error => {
        alert("Failed to send message: " + error.message);
    });
}

// --- LEADERBOARD LOGIC ---

function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '<li>Loading top earners...</li>';

    // Query users ordered by ads_watched descending
    db.ref('users').orderByChild('ads_watched').limitToLast(10).once('value', snapshot => {
        const users = [];
        snapshot.forEach(childSnapshot => {
            users.push(childSnapshot.val());
        });

        // Reverse the array to show highest first
        users.reverse();

        leaderboardList.innerHTML = '';
        users.forEach((user, index) => {
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            li.innerHTML = `
                <span>#${index + 1} ${user.username}</span>
                <span>${user.ads_watched} Ads Watched</span>
            `;
            leaderboardList.appendChild(li);
        });
    }).catch(error => {
        leaderboardList.innerHTML = '<li>Error loading leaderboard.</li>';
        console.error("Leaderboard error:", error);
    });
}

// --- ADMIN PANEL LOGIC ---

function authenticateAdmin() {
    const passwordInput = document.getElementById('admin-password-input').value;
    if (passwordInput === ADMIN_PASSWORD && isAdmin) {
        document.getElementById('admin-login-form').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        loadPendingWithdrawals();
    } else {
        alert("Invalid Admin Password or you are not an authorized admin user.");
    }
}

function loadPendingWithdrawals() {
    const list = document.getElementById('pending-withdrawals-list');
    list.innerHTML = '<li>Loading pending requests...</li>';

    db.ref('withdrawals').orderByChild('status').equalTo('Pending').on('value', snapshot => {
        list.innerHTML = '';
        if (!snapshot.exists()) {
            list.innerHTML = '<li>No pending withdrawals.</li>';
            return;
        }

        snapshot.forEach(childSnapshot => {
            const reqId = childSnapshot.key;
            const req = childSnapshot.val();
            const date = new Date(req.timestamp).toLocaleString();
            
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            li.style.flexDirection = 'column';
            li.innerHTML = `
                <strong>User: ${req.username} (ID: ${req.userId.substring(0, 5)}...)</strong>
                <p>Amount: ₱${req.amount.toFixed(2)} | GCash: ${req.gcash_number}</p>
                <small>Requested: ${date}</small>
                <div style="margin-top: 10px;">
                    <button style="background: #4CAF50; color: white; border: none; padding: 5px 10px; margin-right: 5px; cursor: pointer;" 
                        onclick="updateWithdrawalStatus('${reqId}', 'Completed')">Complete</button>
                    <button style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer;"
                        onclick="updateWithdrawalStatus('${reqId}', 'Rejected')">Reject</button>
                </div>
            `;
            list.appendChild(li);
        });
    });
}

function updateWithdrawalStatus(requestId, status) {
    if (!isAdmin) {
        alert("Access denied.");
        return;
    }

    if (confirm(`Are you sure you want to mark request ${requestId} as ${status}?`)) {
        db.ref('withdrawals/' + requestId).update({
            status: status,
            processed_by: currentUserId,
            processed_timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            alert(`Request ${requestId} marked as ${status}.`);
        }).catch(error => {
            alert("Failed to update status: " + error.message);
        });
    }
}
