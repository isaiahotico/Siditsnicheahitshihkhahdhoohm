
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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const analytics = firebase.analytics(); // Initialize analytics

// Constants
const REWARD_PER_AD = 0.0068;
const COOLDOWN_SECONDS = 60; // 1 minute
const MIN_WITHDRAWAL = 0.02;
const ADMIN_PASSWORD = "Propetas12"; // **WARNING: INSECURE IN CLIENT-SIDE CODE**

// Adsterra Smartlinks
const AD_LINKS = [
    "https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981",
    "https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c",
    "https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232",
    "https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf"
];

// DOM Elements
const userBalanceSpan = document.getElementById('userBalance');
const adCardsContainer = document.getElementById('adCardsContainer');
const rewardNotification = document.getElementById('rewardNotification');
const gcashNumberInput = document.getElementById('gcashNumber');
const telegramUsernameInput = document.getElementById('telegramUsername');
const withdrawButton = document.getElementById('withdrawButton');
const withdrawalStatusSpan = document.getElementById('withdrawalStatus');
const leaderboardList = document.getElementById('leaderboardList');
const chatMessagesDiv = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const adminDashboardLink = document.getElementById('adminDashboardLink');
const adminModal = document.getElementById('adminModal');
const adminPasswordInput = document.getElementById('adminPassword');
const adminLoginButton = document.getElementById('adminLoginButton');
const adminDashboardContent = document.getElementById('adminDashboardContent');
const withdrawalRequestsList = document.getElementById('withdrawalRequestsList');
const closeModalButton = adminModal.querySelector('.close-button');


// --- User Management (Simplified - for real app, use Firebase Auth) ---
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = database.ref().push().key; // Generate a unique ID
    localStorage.setItem('userId', userId);
    // Initialize user in database
    database.ref(`users/${userId}`).set({
        balance: 0,
        lastAdClickTimestamps: {}
    });
}

let username = localStorage.getItem('username');
if (!username) {
    username = `User${Math.floor(Math.random() * 10000)}`; // Simple random username
    localStorage.setItem('username', username);
}

// --- Firebase Realtime Database References ---
const userRef = database.ref(`users/${userId}`);
const allUsersRef = database.ref('users');
const withdrawalRequestsRef = database.ref('withdrawalRequests');
const chatMessagesRef = database.ref('chatMessages');

// --- User Balance & Ad Click Logic ---
let userBalance = 0;
let lastAdClickTimestamps = {}; // Stores last click time for each ad button

userRef.on('value', (snapshot) => {
    const userData = snapshot.val();
    if (userData) {
        userBalance = userData.balance || 0;
        lastAdClickTimestamps = userData.lastAdClickTimestamps || {};
        userBalanceSpan.textContent = userBalance.toFixed(4); // Display with 4 decimal places
        updateAdButtonStates();
        updateWithdrawalStatus(userData.lastWithdrawalStatus || 'N/A');
    }
});

function displayRewardNotification(message) {
    rewardNotification.textContent = message;
    rewardNotification.style.display = 'block';
    setTimeout(() => {
        rewardNotification.style.display = 'none';
    }, 3000); // Hide after 3 seconds
}

function updateAdButtonStates() {
    const now = Date.now();
    AD_LINKS.forEach((link, index) => {
        const adButton = document.getElementById(`adButton-${index}`);
        const cooldownTimerSpan = document.getElementById(`cooldownTimer-${index}`);
        const lastClickTime = lastAdClickTimestamps[`ad_${index}`] || 0;
        const timeElapsed = now - lastClickTime;
        const timeLeft = COOLDOWN_SECONDS * 1000 - timeElapsed;

        if (adButton && cooldownTimerSpan) {
            if (timeLeft > 0) {
                adButton.disabled = true;
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);
                cooldownTimerSpan.textContent = `Cooldown: ${minutes}m ${seconds}s`;
                setTimeout(updateAdButtonStates, 1000); // Update every second
            } else {
                adButton.disabled = false;
                cooldownTimerSpan.textContent = 'Ready to click!';
            }
        }
    });
}

function createAdCard(link, index) {
    const adCard = document.createElement('div');
    adCard.className = 'ad-card';
    adCard.innerHTML = `
        <h3>Ad ${index + 1}</h3>
        <button id="adButton-${index}">Watch Ad & Earn</button>
        <div class="cooldown-timer" id="cooldownTimer-${index}">Ready to click!</div>
    `;
    adCardsContainer.appendChild(adCard);

    const adButton = document.getElementById(`adButton-${index}`);
    adButton.addEventListener('click', () => handleAdClick(link, index));
}

function handleAdClick(link, index) {
    const now = Date.now();
    const lastClickTime = lastAdClickTimestamps[`ad_${index}`] || 0;
    const timeElapsed = now - lastClickTime;

    if (timeElapsed >= COOLDOWN_SECONDS * 1000) {
        // Open Adsterra Smartlink in a new tab
        window.open(link, '_blank');

        // Update last click timestamp in Firebase
        userRef.child('lastAdClickTimestamps').child(`ad_${index}`).set(now)
            .then(() => {
                // Reward user
                const newBalance = userBalance + REWARD_PER_AD;
                userRef.update({ balance: parseFloat(newBalance.toFixed(4)) })
                    .then(() => {
                        displayRewardNotification(`+${REWARD_PER_AD.toFixed(4)} PHP earned!`);
                        updateAdButtonStates(); // Immediately disable button and start timer
                    })
                    .catch(error => console.error("Error updating balance:", error));
            })
            .catch(error => console.error("Error updating last click timestamp:", error));

    } else {
        displayRewardNotification("Ad is on cooldown. Please wait.");
    }
}

// Initialize ad cards
AD_LINKS.forEach((link, index) => createAdCard(link, index));
updateAdButtonStates(); // Initial state check

// --- Withdrawal Logic ---
function updateWithdrawalStatus(status) {
    withdrawalStatusSpan.textContent = status;
    if (status === 'approved') {
        withdrawalStatusSpan.className = 'approved';
    } else if (status === 'pending') {
        withdrawalStatusSpan.className = ''; // Remove specific class
        withdrawalStatusSpan.style.color = '#ffc107'; // Yellow for pending
    } else if (status === 'rejected') {
        withdrawalStatusSpan.className = '';
        withdrawalStatusSpan.style.color = '#dc3545'; // Red for rejected
    } else {
        withdrawalStatusSpan.className = '';
        withdrawalStatusSpan.style.color = '#333'; // Default color
    }
}

withdrawButton.addEventListener('click', () => {
    const gcashNumber = gcashNumberInput.value.trim();
    const telegramUsername = telegramUsernameInput.value.trim();

    if (!gcashNumber || !telegramUsername) {
        alert("Please enter both your GCash number and Telegram username.");
        return;
    }
    if (!/^(09|\+639)\d{9}$/.test(gcashNumber)) {
        alert("Please enter a valid Philippine GCash number (e.g., 09123456789).");
        return;
    }
    if (!/^@\w+$/.test(telegramUsername)) {
        alert("Please enter a valid Telegram username starting with '@'.");
        return;
    }

    if (userBalance < MIN_WITHDRAWAL) {
        alert(`You need at least ${MIN_WITHDRAWAL.toFixed(2)} PHP to withdraw.`);
        return;
    }

    if (confirm(`Request withdrawal of ${userBalance.toFixed(4)} PHP to GCash: ${gcashNumber}, Telegram: ${telegramUsername}?`)) {
        const withdrawalId = withdrawalRequestsRef.push().key;
        withdrawalRequestsRef.child(withdrawalId).set({
            userId: userId,
            amount: userBalance,
            gcashNumber: gcashNumber,
            telegramUsername: telegramUsername,
            timestamp: Date.now(),
            status: 'pending'
        })
        .then(() => {
            // Reset user balance to 0 after request
            userRef.update({
                balance: 0,
                lastWithdrawalStatus: 'pending', // Store status for user
                gcashNumber: gcashNumber, // Save for future requests
                telegramUsername: telegramUsername // Save for future requests
            });
            gcashNumberInput.value = ''; // Clear input
            telegramUsernameInput.value = ''; // Clear input
            alert("Withdrawal request submitted successfully! Please wait for admin approval.");
        })
        .catch(error => {
            console.error("Error submitting withdrawal request:", error);
            alert("Failed to submit withdrawal request. Please try again.");
        });
    }
});

// Load saved GCash and Telegram info if available
userRef.once('value').then(snapshot => {
    const userData = snapshot.val();
    if (userData) {
        if (userData.gcashNumber) gcashNumberInput.value = userData.gcashNumber;
        if (userData.telegramUsername) telegramUsernameInput.value = userData.telegramUsername;
    }
});


// --- Leaderboard Logic ---
allUsersRef.orderByChild('balance').limitToLast(10).on('value', (snapshot) => {
    leaderboardList.innerHTML = '';
    const users = [];
    snapshot.forEach(childSnapshot => {
        const userData = childSnapshot.val();
        users.push({
            id: childSnapshot.key,
            balance: userData.balance || 0,
            // For a real app, you'd fetch/store a display name
            // For now, we'll use a generic name or the user's own name if available
            displayName: childSnapshot.key === userId ? `${username} (You)` : `User ${childSnapshot.key.substring(0, 5)}...`
        });
    });

    // Sort in descending order
    users.sort((a, b) => b.balance - a.balance);

    users.forEach((user, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span>${index + 1}. ${user.displayName}</span>
            <span>${user.balance.toFixed(4)} PHP</span>
        `;
        leaderboardList.appendChild(listItem);
    });
});

// --- Chat Room Logic ---
sendMessageButton.addEventListener('click', () => {
    const messageText = chatInput.value.trim();
    if (messageText) {
        chatMessagesRef.push({
            userId: userId,
            username: username, // Using the generated/stored username
            message: messageText,
            timestamp: Date.now()
        })
        .then(() => {
            chatInput.value = '';
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
        })
        .catch(error => console.error("Error sending message:", error));
    }
});

chatMessagesRef.orderByChild('timestamp').limitToLast(50).on('child_added', (snapshot) => {
    const message = snapshot.val();
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    const date = new Date(message.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageElement.innerHTML = `
        <strong>${message.username}</strong> <span style="font-size: 0.8em; color: #888;">(${timeString}):</span> ${message.message}
    `;
    chatMessagesDiv.appendChild(messageElement);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Keep scrolled to bottom
});

// --- Admin Dashboard Logic ---
adminDashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    adminModal.style.display = 'flex'; // Show modal
});

closeModalButton.addEventListener('click', () => {
    adminModal.style.display = 'none';
    adminDashboardContent.style.display = 'none'; // Hide content on close
    adminPasswordInput.value = ''; // Clear password
});

window.addEventListener('click', (event) => {
    if (event.target == adminModal) {
        adminModal.style.display = 'none';
        adminDashboardContent.style.display = 'none'; // Hide content on close
        adminPasswordInput.value = ''; // Clear password
    }
});

adminLoginButton.addEventListener('click', () => {
    const enteredPassword = adminPasswordInput.value;
    if (enteredPassword === ADMIN_PASSWORD) {
        alert("Admin login successful!");
        adminPasswordInput.style.display = 'none';
        adminLoginButton.style.display = 'none';
        adminDashboardContent.style.display = 'block';
        loadWithdrawalRequests();
    } else {
        alert("Incorrect password.");
    }
});

function loadWithdrawalRequests() {
    withdrawalRequestsList.innerHTML = '';
    withdrawalRequestsRef.orderByChild('status').equalTo('pending').on('value', (snapshot) => {
        withdrawalRequestsList.innerHTML = ''; // Clear previous list
        if (!snapshot.exists()) {
            withdrawalRequestsList.innerHTML = '<li>No pending withdrawal requests.</li>';
            return;
        }
        snapshot.forEach(childSnapshot => {
            const request = childSnapshot.val();
            const requestId = childSnapshot.key;
            const listItem = document.createElement('li');
            const date = new Date(request.timestamp);
            const dateTimeString = date.toLocaleString();

            listItem.innerHTML = `
                <p><strong>User ID:</strong> ${request.userId.substring(0, 8)}...</p>
                <p><strong>Amount:</strong> ${request.amount.toFixed(4)} PHP</p>
                <p><strong>GCash:</strong> ${request.gcashNumber}</p>
                <p><strong>Telegram:</strong> ${request.telegramUsername}</p>
                <p><strong>Requested:</strong> ${dateTimeString}</p>
                <div style="display: flex; gap: 5px; margin-top: 10px;">
                    <button class="approve" data-id="${requestId}">Approve</button>
                    <button class="reject" data-id="${requestId}">Reject</button>
                </div>
            `;
            withdrawalRequestsList.appendChild(listItem);
        });

        // Add event listeners for approve/reject buttons
        withdrawalRequestsList.querySelectorAll('.approve').forEach(button => {
            button.onclick = (e) => handleWithdrawalAction(e.target.dataset.id, 'approved');
        });
        withdrawalRequestsList.querySelectorAll('.reject').forEach(button => {
            button.onclick = (e) => handleWithdrawalAction(e.target.dataset.id, 'rejected');
        });
    });
}

function handleWithdrawalAction(requestId, status) {
    if (confirm(`Are you sure you want to ${status} this withdrawal request?`)) {
        withdrawalRequestsRef.child(requestId).update({ status: status })
            .then(() => {
                // Update user's last withdrawal status
                withdrawalRequestsRef.child(requestId).once('value').then(snapshot => {
                    const request = snapshot.val();
                    if (request && request.userId) {
                        database.ref(`users/${request.userId}`).update({
                            lastWithdrawalStatus: status
                        });
                    }
                });
                alert(`Withdrawal request ${status} successfully.`);
            })
            .catch(error => {
                console.error(`Error ${status} withdrawal request:`, error);
                alert(`Failed to ${status} withdrawal request.`);
            });
    }
}

// Show admin link if user is potentially an admin (for testing, in real app this would be server-side)
// For this example, we'll just always show the link.
adminDashboardLink.style.display = 'block';

// Initial load of ad button states and leaderboard
updateAdButtonStates();
