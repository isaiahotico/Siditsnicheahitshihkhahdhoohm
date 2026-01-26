
// --- Firebase Configuration ---
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app", // This is for Realtime Database, we'll use Firestore
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.storage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

// Initialize Firebase (using Firestore)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // Get Firestore instance

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const mainContent = document.getElementById('main-content');
const ownerDashboard = document.getElementById('owner-dashboard');
const dashboardContent = document.getElementById('dashboard-content');

const usernameInput = document.getElementById('username');
constgcashUsernameInput = document.getElementById('gcash-username');
const referralCodeInput = document.getElementById('referral-code');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');
const welcomeMessage = document.getElementById('welcome-message');
const balanceSpan = document.getElementById('balance');
const chatPointsSpan = document.getElementById('chat-points');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatRoom = document.getElementById('chat-room');
const chatErrorMessage = document.getElementById('chat-error-message');
const withdrawBtn = document.getElementById('withdraw-btn');
const withdrawalStatus = document.getElementById('withdrawal-status');
const leaderboardList = document.getElementById('leaderboard-list');
const withdrawalHistoryList = document.getElementById('withdrawal-history-list');
const payoutHistoryList = document.getElementById('payout-history-list');
const userBalancesList = document.getElementById('user-balances-list');

const dashboardPasswordInput = document.getElementById('dashboard-password');
const loginDashboardBtn = document.getElementById('login-dashboard-btn');

const rewardedChatPointBtn = document.getElementById('rewarded-chat-point-btn');
const claimCooldownText = document.getElementById('claim-cooldown');
const spinner = document.querySelector('.spinner');

// --- Global Variables ---
let currentUser = null;
const REWARDED_AD_COOLDOWN = 45; // seconds
let lastClaimTime = 0;
let cooldownTimer = null;

// --- Monetag Ad Functions (using your provided script) ---
const monetagSDK = window.show_10276123; // Alias for easier use

function showRewardedAd() {
    spinner.style.display = 'block';
    rewardedChatPointBtn.disabled = true;
    monetagSDK()
        .then(() => {
            // Ad watched successfully
            addChatPoints(1);
            alert('You have earned 1 Chat Point!');
            startCooldown();
        })
        .catch(e => {
            console.error("Rewarded ad failed:", e);
            alert('Ad failed to load or play. Please try again.');
            rewardedChatPointBtn.disabled = false; // Re-enable button on failure
        })
        .finally(() => {
            spinner.style.display = 'none';
        });
}

function showRewardedInterstitialAdForChat() {
    // This is for when sending a message
    spinner.style.display = 'block';
    sendMessageBtn.disabled = true;
    monetagSDK('pop') // Using 'pop' for rewarded interstitial
        .then(() => {
            // Ad watched successfully
            sendMessage();
        })
        .catch(e => {
            console.error("Rewarded interstitial ad failed:", e);
            alert('Ad failed to load or play. Please try again.');
            sendMessageBtn.disabled = false; // Re-enable button on failure
        })
        .finally(() => {
            spinner.style.display = 'none';
        });
}

// Function to start the cooldown timer
function startCooldown() {
    const now = Date.now();
    lastClaimTime = now;
    updateCooldownDisplay();

    cooldownTimer = setInterval(() => {
        updateCooldownDisplay();
    }, 1000);
}

// Function to update the cooldown display
function updateCooldownDisplay() {
    const now = Date.now();
    const timeElapsed = (now - lastClaimTime) / 1000; // seconds
    const timeLeft = REWARDED_AD_COOLDOWN - timeElapsed;

    if (timeLeft <= 0) {
        claimCooldownText.textContent = '';
        rewardedChatPointBtn.disabled = false;
        clearInterval(cooldownTimer);
        cooldownTimer = null;
    } else {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = Math.floor(timeLeft % 60);
        claimCooldownText.textContent = `Cooldown: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        rewardedChatPointBtn.disabled = true;
    }
}

// --- Firebase Functions ---

// Fetch user data
async function getUser(username) {
    try {
        const userDoc = await db.collection('users').doc(username).get();
        return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
        console.error("Error fetching user:", error);
        return null;
    }
}

// Add or update user data
async function setUser(username, data) {
    try {
        await db.collection('users').doc(username).set(data, { merge: true });
        return true;
    } catch (error) {
        console.error("Error setting user data:", error);
        return false;
    }
}

// Add a referral bonus
async function addReferralBonus(referrerUsername) {
    try {
        const referrerDoc = await db.collection('users').doc(referrerUsername).get();
        if (referrerDoc.exists) {
            const referrerData = referrerDoc.data();
            const currentBalance = parseFloat(referrerData.balance || 0);
            const bonusAmount = currentBalance * 0.08; // 8% bonus
            await db.collection('users').doc(referrerUsername).update({
                balance: currentBalance + bonusAmount
            });
            console.log(`Referral bonus of ${bonusAmount.toFixed(2)} added to ${referrerUsername}`);
            // Optionally, log this as a transaction or event
        }
    } catch (error) {
        console.error("Error adding referral bonus:", error);
    }
}

// Update balance
async function updateBalance(amount) {
    if (!currentUser) return;
    const currentBalance = parseFloat(currentUser.balance || 0);
    const newBalance = currentBalance + amount;
    currentUser.balance = newBalance;
    await setUser(currentUser.username, { balance: newBalance });
    balanceSpan.textContent = newBalance.toFixed(2);
}

// Update chat points
async function updateChatPoints(amount) {
    if (!currentUser) return;
    const currentChatPoints = parseInt(currentUser.chatPoints || 0);
    const newChatPoints = currentChatPoints + amount;
    currentUser.chatPoints = newChatPoints;
    await setUser(currentUser.username, { chatPoints: newChatPoints });
    chatPointsSpan.textContent = newChatPoints;
}

// Add chat points (convenience function)
function addChatPoints(amount) {
    updateChatPoints(amount);
}

// Fetch leaderboard data
async function fetchLeaderboard() {
    try {
        const snapshot = await db.collection('users')
            .orderBy('balance', 'desc')
            .limit(10) // Get top 10 users
            .get();
        leaderboardList.innerHTML = ''; // Clear existing list
        snapshot.forEach((doc, index) => {
            const user = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${index + 1}. ${user.username}</span>
                <span>${parseFloat(user.balance || 0).toFixed(2)} Peso</span>
            `;
            leaderboardList.appendChild(li);
        });
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
    }
}

// Fetch user's withdrawal history
async function fetchUserWithdrawalHistory() {
    if (!currentUser) return;
    try {
        const snapshot = await db.collection('withdrawals')
            .where('username', '==', currentUser.username)
            .orderBy('timestamp', 'desc')
            .limit(20) // Limit to last 20
            .get();
        withdrawalHistoryList.innerHTML = ''; // Clear existing list
        if (snapshot.empty) {
            const li = document.createElement('li');
            li.textContent = 'No withdrawal history yet.';
            withdrawalHistoryList.appendChild(li);
        } else {
            snapshot.forEach(doc => {
                const withdrawal = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${new Date(withdrawal.timestamp.seconds * 1000).toLocaleString()}</span>
                    <span>${withdrawal.amount.toFixed(2)} Peso</span>
                    <span>GCash: ${withdrawal.gcashUsername}</span>
                    <span>Status: ${withdrawal.status}</span>
                `;
                withdrawalHistoryList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error fetching withdrawal history:", error);
    }
}

// Fetch all payout history for owner dashboard
async function fetchPayoutHistory() {
    try {
        const snapshot = await db.collection('payouts') // Assuming a 'payouts' collection for admin
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
        payoutHistoryList.innerHTML = '';
        if (snapshot.empty) {
            const li = document.createElement('li');
            li.textContent = 'No payouts recorded yet.';
            payoutHistoryList.appendChild(li);
        } else {
            snapshot.forEach(doc => {
                const payout = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${new Date(payout.timestamp.seconds * 1000).toLocaleString()}</span>
                    <span>${payout.username}</span>
                    <span>${payout.gcashUsername}</span>
                    <span>${payout.amount.toFixed(2)} Peso</span>
                    <span>Status: ${payout.status}</span>
                `;
                payoutHistoryList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error fetching payout history:", error);
    }
}

// Fetch all user balances for owner dashboard
async function fetchUserBalances() {
    try {
        const snapshot = await db.collection('users').get();
        userBalancesList.innerHTML = '';
        if (snapshot.empty) {
            const li = document.createElement('li');
            li.textContent = 'No users found.';
            userBalancesList.appendChild(li);
        } else {
            snapshot.forEach(doc => {
                const user = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${user.username}</span>
                    <span>${parseFloat(user.balance || 0).toFixed(2)} Peso</span>
                `;
                userBalancesList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error fetching user balances:", error);
    }
}

// --- Chat Functions ---
let chatMessagesRef; // To hold reference to chat messages for a specific room

function initializeChatRoom(roomName = 'main_room') {
    // In a real app, you might have multiple chat rooms.
    // For simplicity, we use a fixed room here.
    chatMessagesRef = db.collection('chatMessages').orderBy('timestamp').limit(50); // Limit to last 50 messages

    chatMessagesRef.onSnapshot(snapshot => {
        chatRoom.innerHTML = ''; // Clear existing messages
        snapshot.forEach(doc => {
            const message = doc.data();
            const msgElement = document.createElement('div');
            msgElement.classList.add('message');
            msgElement.innerHTML = `<strong>${message.username}:</strong> ${message.text}`;
            chatRoom.appendChild(msgElement);
        });
        // Scroll to bottom
        chatRoom.scrollTop = chatRoom.scrollHeight;
    }, error => {
        console.error("Error listening to chat messages:", error);
        chatErrorMessage.textContent = "Failed to load chat messages.";
    });
}

async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) {
        chatErrorMessage.textContent = "Message cannot be empty.";
        return;
    }
    if (!currentUser) {
        chatErrorMessage.textContent = "You must be logged in to send messages.";
        return;
    }

    const userChatPoints = parseInt(currentUser.chatPoints || 0);
    if (userChatPoints < 1) {
        chatErrorMessage.textContent = "You need at least 1 Chat Point to send a message.";
        return;
    }

    // --- Trigger Rewarded Interstitial Ad ---
    // First, check if the ad can be shown based on Monetag's rules or custom logic.
    // For this example, we'll just try to show it directly.
    showRewardedInterstitialAdForChat();
    // The actual sending will happen inside the `showRewardedInterstitialAdForChat` callback
}

async function performSendMessage(messageText) {
    if (!currentUser) {
        chatErrorMessage.textContent = "You must be logged in to send messages.";
        return;
    }
    try {
        // Deduct chat point BEFORE sending the message
        await updateChatPoints(-1);

        // Send message to Firestore
        await db.collection('chatMessages').add({
            username: currentUser.username,
            text: messageText,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Earn peso for sending message
        const earnedPeso = 0.016;
        await updateBalance(earnedPeso);

        messageInput.value = ''; // Clear input
        chatErrorMessage.textContent = ''; // Clear previous errors
        sendMessageBtn.disabled = false; // Re-enable send button

        // Show a subtle notification or update the message sending status
        console.log("Message sent successfully!");

    } catch (error) {
        console.error("Error sending message:", error);
        chatErrorMessage.textContent = "Failed to send message. Please try again.";
        sendMessageBtn.disabled = false; // Re-enable send button on error
        // Potentially refund chat point if ad was shown but message failed
    }
}


// --- Withdrawal Functions ---
async function withdrawToGCash() {
    if (!currentUser) {
        withdrawalStatus.textContent = "Please log in first.";
        return;
    }

    const balance = parseFloat(currentUser.balance || 0);
    const MIN_WITHDRAWAL = 0.02;

    if (balance < MIN_WITHDRAWAL) {
        withdrawalStatus.textContent = `You need at least ${MIN_WITHDRAWAL.toFixed(2)} Peso to withdraw.`;
        return;
    }

    const usergcashUsername = currentUser.gcashUsername; // Get from user's profile data
    if (!usergcashUsername) {
        withdrawalStatus.textContent = "Please set your GCash username in your profile first.";
        return;
    }

    // --- Simulate GCash Withdrawal Process ---
    // In a real app, this would involve calling a backend server that communicates with GCash API.
    // We will record the request in Firestore and mark it as "Pending".

    const withdrawalData = {
        username: currentUser.username,
        gcashUsername: usergcashUsername,
        amount: balance, // Withdraw the full balance for this simulation
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'Pending' // Initial status
    };

    try {
        await db.collection('withdrawals').add(withdrawalData);

        // Update user's balance to 0 after initiating withdrawal
        currentUser.balance = 0;
        await setUser(currentUser.username, { balance: 0 });
        balanceSpan.textContent = '0.00';

        withdrawalStatus.textContent = `Withdrawal request of ${balance.toFixed(2)} Peso to ${usergcashUsername} submitted. It will be processed shortly.`;
        // Clear the withdrawal status message after some time
        setTimeout(() => {
            withdrawalStatus.textContent = '';
        }, 5000);

        // Fetch updated withdrawal history
        await fetchUserWithdrawalHistory();

    } catch (error) {
        console.error("Error submitting withdrawal:", error);
        withdrawalStatus.textContent = "Failed to submit withdrawal request. Please try again.";
    }
}

// --- Owner Dashboard Functions ---
const OWNER_PASSWORD = "Propetas12";

function loginToDashboard() {
    if (dashboardPasswordInput.value === OWNER_PASSWORD) {
        ownerDashboard.style.display = 'block';
        dashboardContent.style.display = 'block';
        loginDashboardBtn.disabled = true;
        dashboardPasswordInput.disabled = true;
        fetchPayoutHistory();
        fetchUserBalances();
    } else {
        alert('Incorrect password.');
    }
}

// --- UI Management Functions ---
function showLoginSection() {
    loginSection.classList.remove('hidden');
    mainContent.classList.add('hidden');
    ownerDashboard.classList.add('hidden'); // Ensure owner dashboard is hidden on normal load
}

function showMainContent() {
    loginSection.classList.add('hidden');
    mainContent.classList.remove('hidden');
    ownerDashboard.classList.add('hidden'); // Ensure owner dashboard is hidden
}

function showOwnerDashboard() {
    loginSection.classList.add('hidden');
    mainContent.classList.add('hidden');
    ownerDashboard.style.display = 'block'; // Make the dashboard container visible
}

function updateUI() {
    if (currentUser) {
        welcomeMessage.textContent = `Welcome, ${currentUser.username}!`;
        balanceSpan.textContent = parseFloat(currentUser.balance || 0).toFixed(2);
        chatPointsSpan.textContent = parseInt(currentUser.chatPoints || 0);

        // Enable withdraw button only if balance is sufficient and GCash username is set
        if (parseFloat(currentUser.balance || 0) >= 0.02 && currentUser.gcashUsername) {
            withdrawBtn.disabled = false;
        } else {
            withdrawBtn.disabled = true;
        }

        // Initialize chat room listeners if not already done
        if (!chatMessagesRef) {
            initializeChatRoom();
        }
        fetchUserWithdrawalHistory();
        // Start cooldown if it was previously active for this user session
        if (lastClaimTime > 0) {
            startCooldown();
        }
    } else {
        showLoginSection();
    }
}

// --- Event Listeners ---
loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    constgcashUsername =gcashUsernameInput.value.trim();
    const referralCode = referralCodeInput.value.trim();
    errorMessage.textContent = '';

    if (!username || !gcashUsername) {
        errorMessage.textContent = "Please enter both Username and GCash Username.";
        return;
    }

    try {
        let user = await getUser(username);

        if (!user) {
            // New user signup
            if (referralCode) {
                const referrer = await getUser(referralCode);
                if (referrer) {
                    // Add referral bonus to the referrer
                    await addReferralBonus(referralCode);
                    // Optionally give a small bonus to the new user too
                } else {
                    errorMessage.textContent = "Invalid referral code.";
                    return;
                }
            } else {
                // Prompt user to enter referral code if they skipped and no code was provided
                // This is handled by the initial login pop-up logic.
                // If they log in with no referral code here, they don't get a bonus for this login.
            }

            user = {
                username: username,
                gcashUsername:gcashUsername,
                balance: 0,
                chatPoints: 0,
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await setUser(username, user);
            alert("Account created successfully!");
            // If no referral code was entered and it's a new user, trigger the prompt
            if (!referralCode) {
                promptForReferralCode();
            }
        } else {
            // Existing user login
            // Ensure GCash username is updated if it's different (optional, can be restricted)
            if (user.gcashUsername !==gcashUsername) {
                console.log("Updating GCash username for existing user.");
                user.gcashUsername =gcashUsername;
                await setUser(username, {gcashUsername:gcashUsername });
            }
            // If they are logging in for the first time after signing up without a referral code, prompt them.
            if (!user.referredBy && !referralCode && username === user.username) { // Check if referredBy is not set and no code was used THIS time
                 // This logic is tricky. If they logged in before with a referral, 'referredBy' might be set.
                 // We primarily want to prompt if they *never* had a referral.
                 // A better approach might be to check a flag indicating if they were prompted.
            }
        }

        currentUser = user;
        showMainContent();
        updateUI();
        fetchLeaderboard();
        fetchUserWithdrawalHistory();

    } catch (error) {
        console.error("Login/Signup error:", error);
        errorMessage.textContent = "An error occurred. Please try again.";
    }
});

rewardedChatPointBtn.addEventListener('click', () => {
    const now = Date.now();
    if ((now - lastClaimTime) / 1000 < REWARDED_AD_COOLDOWN) {
        alert('Please wait for the cooldown to finish.');
        return;
    }
    showRewardedAd();
});

sendMessageBtn.addEventListener('click', () => {
    // The actual sending logic will be triggered after the ad is watched.
    const messageText = messageInput.value.trim();
    if (!messageText) {
        chatErrorMessage.textContent = "Message cannot be empty.";
        return;
    }
    if (!currentUser) {
        chatErrorMessage.textContent = "You must be logged in to send messages.";
        return;
    }
    const userChatPoints = parseInt(currentUser.chatPoints || 0);
    if (userChatPoints < 1) {
        chatErrorMessage.textContent = "You need at least 1 Chat Point to send a message.";
        return;
    }
    // Disable the button immediately to prevent multiple clicks
    sendMessageBtn.disabled = true;
    performSendMessage(messageText); // Attempt to send directly, deducting points first
});


withdrawBtn.addEventListener('click', withdrawToGCash);

loginDashboardBtn.addEventListener('click', loginToDashboard);

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if there's a logged-in user session (e.g., from localStorage)
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        // Re-fetch user data from Firestore to ensure it's up-to-date
        getUser(currentUser.username).then(userData => {
            if (userData) {
                currentUser = userData;
                showMainContent();
                updateUI();
                fetchLeaderboard();
                fetchUserWithdrawalHistory();
            } else {
                localStorage.removeItem('currentUser'); // Remove invalid session
                showLoginSection();
            }
        }).catch(() => {
            localStorage.removeItem('currentUser');
            showLoginSection();
        });
    } else {
        showLoginSection();
    }

    // Load initial leaderboard data
    fetchLeaderboard();

    // --- Monetag In-App Interstitial Logic ---
    // The provided Monetag script handles the display.
    // You've configured `frequency: 2`, `capping: 0.1` (6 mins), `interval: 30`.
    // `everyPage: false` means it won't show on every page transition.
    // You might want to adjust these settings based on user feedback and ad performance.

    // --- Initial Cooldown Check ---
    const savedCooldownTime = localStorage.getItem('lastClaimTime');
    if (savedCooldownTime) {
        lastClaimTime = parseInt(savedCooldownTime, 10);
        if ((Date.now() - lastClaimTime) / 1000 < REWARDED_AD_COOLDOWN) {
            startCooldown();
        } else {
            // Cooldown has expired, clear it
            localStorage.removeItem('lastClaimTime');
        }
    }
});

// --- Helper Function to Prompt for Referral Code ---
function promptForReferralCode() {
    let enteredReferralCode = prompt("You haven't entered a referral code yet. Enter one now to get a bonus, or leave blank to skip.");
    if (enteredReferralCode !== null) { // User didn't click cancel
        enteredReferralCode = enteredReferralCode.trim();
        if (enteredReferralCode) {
            referralCodeInput.value = enteredReferralCode; // Set it in the input field
            loginBtn.click(); // Trigger login/signup again with the code
        } else {
            // User entered nothing, proceed without referral code
            // You might want to update a flag in Firestore to indicate they were prompted.
            alert("Skipping referral code for now.");
            loginBtn.click(); // Proceed with login/signup without referral
        }
    } else {
        alert("Login/Signup cancelled.");
    }
}

// --- Override Login Button Logic to Include Referral Prompt ---
loginBtn.addEventListener('click', async (event) => {
    event.preventDefault(); // Prevent default form submission

    const username = usernameInput.value.trim();
    constgcashUsername =gcashUsernameInput.value.trim();
    const referralCode = referralCodeInput.value.trim();
    errorMessage.textContent = '';

    if (!username || !gcashUsername) {
        errorMessage.textContent = "Please enter both Username and GCash Username.";
        return;
    }

    try {
        let user = await getUser(username);

        if (!user) {
            // New user signup
            if (!referralCode) {
                // If no referral code is entered initially, prompt the user
                promptForReferralCode();
                // The prompt's click() will call this handler again with the code.
                // We need to prevent the current handler from proceeding further if prompt is used.
                return; // Exit this current handler execution
            }

            // User entered a referral code (either initially or via prompt)
            const referrer = await getUser(referralCode);
            if (referrer) {
                await addReferralBonus(referralCode);
            } else {
                errorMessage.textContent = "Invalid referral code.";
                return;
            }

            user = {
                username: username,
                gcashUsername:gcashUsername,
                balance: 0,
                chatPoints: 0,
                referredBy: referralCode, // Store who referred them
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await setUser(username, user);
            alert("Account created successfully!");
        } else {
            // Existing user login
            if (user.gcashUsername !==gcashUsername) {
                user.gcashUsername =gcashUsername;
                await setUser(username, {gcashUsername:gcashUsername });
            }
        }

        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser)); // Save session
        showMainContent();
        updateUI();
        fetchLeaderboard();
        fetchUserWithdrawalHistory();

    } catch (error) {
        console.error("Login/Signup error:", error);
        errorMessage.textContent = "An error occurred. Please try again.";
    }
});


// --- Save Cooldown to Local Storage ---
window.addEventListener('beforeunload', () => {
    if (lastClaimTime > 0) {
        localStorage.setItem('lastClaimTime', lastClaimTime);
    }
    // Clear interval to prevent memory leaks if the page is closed
    if (cooldownTimer) {
        clearInterval(cooldownTimer);
    }
});

// --- Real-time Ad Interstitial ---
// The Monetag SDK is loaded and should manage its own in-app interstitials.
// You don't typically need to manually call `show_10276123({ type: 'inApp', ... })`
// unless you have specific trigger points beyond page navigation.
// The script `sdk.js` is responsible for handling the 'inApp' settings you provided.

// --- Function to show rewarded interstitial for chat message ---
// Modified to directly use the `performSendMessage` after ad
sendMessageBtn.addEventListener('click', async () => {
    const messageText = messageInput.value.trim();
    if (!messageText) {
        chatErrorMessage.textContent = "Message cannot be empty.";
        return;
    }
    if (!currentUser) {
        chatErrorMessage.textContent = "You must be logged in to send messages.";
        return;
    }
    const userChatPoints = parseInt(currentUser.chatPoints || 0);
    if (userChatPoints < 1) {
        chatErrorMessage.textContent = "You need at least 1 Chat Point to send a message.";
        return;
    }

    sendMessageBtn.disabled = true; // Disable button to prevent spamming

    // Show the rewarded interstitial ad for sending the message
    spinner.style.display = 'block';
    monetagSDK('pop')
        .then(() => {
            // Ad watched successfully, now perform the send message action
            performSendMessage(messageText);
        })
        .catch(e => {
            console.error("Rewarded interstitial ad failed for chat:", e);
            alert('Ad failed to load or play. Please try again to send message.');
            sendMessageBtn.disabled = false; // Re-enable button on error
            spinner.style.display = 'none';
        });
});
