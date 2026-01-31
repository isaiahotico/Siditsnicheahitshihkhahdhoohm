
// --- CONFIGURATION ---
const REWARD_PER_AD = 0.01; // PHP
const MIN_WITHDRAW = 0.02; // PHP
const ADMIN_PASSWORD = "Propetas12";

let currentUser = null;
let currentUserId = null;

// --- UTILITY FUNCTIONS ---

/**
 * Switches the active tab content.
 * @param {string} tabName - The ID of the content section to show.
 */
function switchTab(tabName) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
}

// Initialize tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
    });
});

// --- FIREBASE AUTH & USER MANAGEMENT ---

/**
 * Simple login/registration using username as a unique identifier (UID).
 */
async function loginOrRegister() {
    const usernameInput = document.getElementById('auth-username').value.trim();
    if (!usernameInput) {
        alert("Please enter a username.");
        return;
    }

    // Use a simplified UID based on the username for this example
    const uid = btoa(usernameInput).replace(/=/g, ''); 

    const userRef = ref(db, 'users/' + uid);
    currentUserId = uid;
    currentUser = usernameInput;

    try {
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            // Login
            console.log("User logged in:", usernameInput);
        } else {
            // Register
            await set(userRef, {
                username: usernameInput,
                balance: 0.00,
                totalEarned: 0.00,
                gcashNumber: ""
            });
            console.log("User registered:", usernameInput);
        }

        // Setup UI and listeners
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Start listening to user data and chat
        listenToUserData(uid);
        listenToChat();
        listenToLeaderboard();
        listenToWithdrawalHistory(uid);

    } catch (error) {
        console.error("Authentication error:", error);
        alert("An error occurred during login/registration.");
    }
}

function logoutUser() {
    currentUser = null;
    currentUserId = null;
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('admin-login').classList.remove('hidden');
    document.getElementById('auth-username').value = '';
    alert("Logged out successfully.");
}

/**
 * Listens for real-time updates to the user's balance and profile.
 * @param {string} uid - The user's ID.
 */
function listenToUserData(uid) {
    const userRef = ref(db, 'users/' + uid);
    onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            document.getElementById('user-balance').textContent = userData.balance.toFixed(2);
            document.getElementById('user-total-earned').textContent = userData.totalEarned.toFixed(2);
            document.getElementById('gcash-number').value = userData.gcashNumber || '';
        }
    });
}

// --- MONETAG AD INTEGRATION ---

function watchRewardedAd() {
    if (!currentUserId) {
        alert("Please log in first.");
        return;
    }

    const adButton = document.getElementById('watch-ad-btn');
    adButton.disabled = true;
    adButton.textContent = "Loading Ad...";

    // Rewarded Interstitial Ad Call
    show_10276123().then(() => {
        // This block executes if the user successfully views the ad.
        rewardUser();
        adButton.textContent = "WATCH AD (0.01 PHP)";
        adButton.disabled = false;
    }).catch(e => {
        // This block executes if the ad fails to load or is closed early (depending on Monetag's exact implementation)
        alert('Ad failed or was closed early. Please try again.');
        adButton.textContent = "WATCH AD (0.01 PHP)";
        adButton.disabled = false;
    });
}

/**
 * Rewards the user by updating their balance in Firebase.
 */
async function rewardUser() {
    if (!currentUserId) return;

    const userRef = ref(db, 'users/' + currentUserId);

    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            const userData = snapshot.val();
            const newBalance = (userData.balance || 0) + REWARD_PER_AD;
            const newTotalEarned = (userData.totalEarned || 0) + REWARD_PER_AD;

            await update(userRef, {
                balance: parseFloat(newBalance.toFixed(2)),
                totalEarned: parseFloat(newTotalEarned.toFixed(2))
            });
            alert(`Success! You earned ${REWARD_PER_AD.toFixed(2)} PHP!`);
        }
    } catch (error) {
        console.error("Error rewarding user:", error);
        alert("Failed to reward user due to a database error.");
    }
}

// --- WITHDRAWAL SYSTEM ---

async function submitWithdrawal() {
    if (!currentUserId) return alert("Please log in.");

    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const gcashNumber = document.getElementById('gcash-number').value.trim();
    const balance = parseFloat(document.getElementById('user-balance').textContent);

    if (isNaN(amount) || amount < MIN_WITHDRAW) {
        return alert(`Minimum withdrawal amount is ${MIN_WITHDRAW.toFixed(2)} PHP.`);
    }
    if (amount > balance) {
        return alert("Insufficient balance.");
    }
    if (!gcashNumber || gcashNumber.length < 10) {
        return alert("Please enter a valid GCash number.");
    }

    if (!confirm(`Confirm withdrawal of ${amount.toFixed(2)} PHP to GCash: ${gcashNumber}?`)) {
        return;
    }

    try {
        const userRef = ref(db, 'users/' + currentUserId);
        const withdrawRef = push(ref(db, 'withdrawRequests'));

        // 1. Deduct balance immediately
        const newBalance = balance - amount;
        await update(userRef, {
            balance: parseFloat(newBalance.toFixed(2)),
            gcashNumber: gcashNumber // Save GCash number
        });

        // 2. Create withdrawal request
        await set(withdrawRef, {
            userId: currentUserId,
            username: currentUser,
            amount: amount,
            gcashNumber: gcashNumber,
            timestamp: serverTimestamp(),
            status: "Pending"
        });

        document.getElementById('withdraw-status').textContent = "Withdrawal request submitted successfully! Pending admin approval.";
        document.getElementById('withdraw-amount').value = '';

    } catch (error) {
        console.error("Withdrawal error:", error);
        // If database error, attempt to revert balance
        alert("Withdrawal failed due to a server error. Please contact support.");
    }
}

/**
 * Listens to the user's withdrawal history.
 */
function listenToWithdrawalHistory(uid) {
    const historyRef = query(ref(db, 'withdrawRequests'), orderByChild('userId'), equalTo(uid));
    
    // Note: Firebase 9 requires `equalTo` if you use `orderByChild`
    // Since we are using simple onValue here, we will filter manually or rely on admin rules for security.
    
    // For simplicity, we read all and filter client-side (less secure, but easier for this example)
    const allRequestsRef = ref(db, 'withdrawRequests');

    onValue(allRequestsRef, (snapshot) => {
        const historyDiv = document.getElementById('withdrawal-history');
        historyDiv.innerHTML = '';
        let found = false;

        snapshot.forEach(childSnapshot => {
            const req = childSnapshot.val();
            if (req.userId === uid) {
                found = true;
                const statusColor = req.status === 'Completed' ? 'green' : (req.status === 'Rejected' ? 'red' : 'orange');
                const item = document.createElement('p');
                item.innerHTML = `
                    Amount: <strong>${req.amount.toFixed(2)} PHP</strong> | GCash: ${req.gcashNumber} <br>
                    Status: <strong style="color: ${statusColor}">${req.status}</strong>
                `;
                historyDiv.appendChild(item);
            }
        });

        if (!found) {
            historyDiv.innerHTML = '<p>No withdrawal history found.</p>';
        }
    });
}


// --- CHAT ROOM ---

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();

    if (!currentUser || !message) return;

    const chatRef = push(ref(db, 'chat'));
    set(chatRef, {
        username: currentUser,
        message: message,
        timestamp: serverTimestamp()
    });

    chatInput.value = '';
}

function listenToChat() {
    // Query the last 50 messages, ordered by timestamp
    const chatQuery = query(ref(db, 'chat'), orderByChild('timestamp'), limitToLast(50));
    const chatWindow = document.getElementById('chat-window');

    onValue(chatQuery, (snapshot) => {
        chatWindow.innerHTML = '';
        snapshot.forEach(childSnapshot => {
            const msg = childSnapshot.val();
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message');
            
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '...';
            
            messageElement.innerHTML = `
                <span class="chat-user">[${time}] ${msg.username}:</span> ${msg.message}
            `;
            chatWindow.appendChild(messageElement);
        });
        // Scroll to the bottom
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });
}

// --- LEADERBOARD ---

function listenToLeaderboard() {
    // Query top 10 users based on totalEarned
    const leaderboardQuery = query(ref(db, 'users'), orderByChild('totalEarned'), limitToLast(10));
    const leaderboardList = document.getElementById('leaderboard-list');

    onValue(leaderboardQuery, (snapshot) => {
        const users = [];
        snapshot.forEach(childSnapshot => {
            users.push(childSnapshot.val());
        });

        // Reverse the array to show highest earners first
        users.reverse();
        leaderboardList.innerHTML = '';

        users.forEach((user, index) => {
            const item = document.createElement('div');
            item.classList.add('leaderboard-item');
            item.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${user.username}</span>
                <span class="score">${user.totalEarned.toFixed(2)} PHP</span>
            `;
            leaderboardList.appendChild(item);
        });
    });
}

// --- ADMIN PANEL ---

function adminLogin() {
    const password = document.getElementById('admin-password').value;
    if (password === ADMIN_PASSWORD) {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        listenToWithdrawalRequests();
        alert("Admin access granted.");
    } else {
        alert("Incorrect Admin Password.");
    }
}

function listenToWithdrawalRequests() {
    const requestsRef = ref(db, 'withdrawRequests');
    const pendingRequestsDiv = document.getElementById('pending-requests');

    onValue(requestsRef, (snapshot) => {
        pendingRequestsDiv.innerHTML = '';
        let foundPending = false;

        snapshot.forEach(childSnapshot => {
            const req = childSnapshot.val();
            const reqId = childSnapshot.key;

            if (req.status === 'Pending') {
                foundPending = true;
                const item = document.createElement('div');
                item.classList.add('request-item');
                item.innerHTML = `
                    <p><strong>User:</strong> ${req.username} (ID: ${req.userId})</p>
                    <p><strong>Amount:</strong> ${req.amount.toFixed(2)} PHP</p>
                    <p><strong>GCash:</strong> ${req.gcashNumber}</p>
                    <button class="btn-success" onclick="processWithdrawal('${reqId}', '${req.userId}', ${req.amount}, 'Completed')">Mark Paid</button>
                    <button class="btn-danger" onclick="processWithdrawal('${reqId}', '${req.userId}', ${req.amount}, 'Rejected')">Reject & Refund</button>
                `;
                pendingRequestsDiv.appendChild(item);
            }
        });

        if (!foundPending) {
            pendingRequestsDiv.innerHTML = '<p>No pending withdrawal requests.</p>';
        }
    });
}

async function processWithdrawal(reqId, userId, amount, status) {
    const requestRef = ref(db, 'withdrawRequests/' + reqId);
    const userRef = ref(db, 'users/' + userId);

    try {
        if (status === 'Rejected') {
            // Refund the user's balance
            const userSnapshot = await get(userRef);
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const newBalance = (userData.balance || 0) + amount;
                await update(userRef, { balance: parseFloat(newBalance.toFixed(2)) });
                alert(`Request rejected. ${amount.toFixed(2)} PHP refunded to ${userData.username}.`);
            }
        }
        
        // Update the request status
        await update(requestRef, {
            status: status,
            processedBy: 'Admin',
            processedAt: serverTimestamp()
        });

        alert(`Request ${reqId} marked as ${status}.`);

    } catch (error) {
        console.error("Processing error:", error);
        alert("Failed to process request due to a database error.");
    }
}

// Ensure global functions are available
window.loginOrRegister = loginOrRegister;
window.watchRewardedAd = watchRewardedAd;
window.submitWithdrawal = submitWithdrawal;
window.sendMessage = sendMessage;
window.adminLogin = adminLogin;
window.processWithdrawal = processWithdrawal;
window.logoutUser = logoutUser;
