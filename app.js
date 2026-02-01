
// Import Firebase services from the global window object
const app = window.firebaseApp;
const auth = window.firebaseAuth;
const db = window.firebaseDb; // Firestore
const rtdb = window.firebaseRtdb; // Realtime Database

// Firestore Collections
const usersRef = collection(db, "users");
const withdrawalsRef = collection(db, "withdrawals");
const adCooldownsRef = collection(db, "ads_cooldowns");

// Realtime Database Ref for Chat
const chatRef = ref(rtdb, "chat");

// DOM Elements
const authSection = document.getElementById('auth-section');
const telegramUsernameInput = document.getElementById('telegram-username-input');
const loginBtn = document.getElementById('login-btn');
const authStatus = document.getElementById('auth-status');
const appContent = document.getElementById('app-content');
const displayTelegramUsername = document.getElementById('display-telegram-username');
const userBalanceSpan = document.getElementById('user-balance');
const adButtons = document.querySelectorAll('.ad-button');
const adMessage = document.getElementById('ad-message');
const gcashNumberInput = document.getElementById('gcash-number-input');
const withdrawalAmountInput = document.getElementById('withdrawal-amount-input');
const requestWithdrawalBtn = document.getElementById('request-withdrawal-btn');
const withdrawalStatusMessage = document.getElementById('withdrawal-status-message');
const withdrawalHistoryList = document.getElementById('withdrawal-history-list');
const chatMessagesDiv = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const leaderboardList = document.getElementById('leaderboard-list');

const adminDashboard = document.getElementById('admin-dashboard');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginStatus = document.getElementById('admin-login-status');
const adminContent = document.getElementById('admin-content');
const adminWithdrawalRequests = document.getElementById('admin-withdrawal-requests');
const adminUserList = document.getElementById('admin-user-list');

const REWARD_AMOUNT = 0.0068;
const MIN_WITHDRAWAL = 0.02;
const AD_COOLDOWN_SECONDS = 60; // 1 minute

let currentUser = null;
let currentTelegramUsername = null;

// --- Authentication and User Management ---

// Listen for authentication state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Check if user data exists in Firestore, if not, create it
        const userDocRef = doc(usersRef, user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            // New user, prompt for Telegram username
            authSection.style.display = 'block';
            appContent.style.display = 'none';
            authStatus.textContent = 'Please enter your Telegram username to continue.';
            loginBtn.textContent = 'Save Username';
        } else {
            // Existing user
            const userData = userDocSnap.data();
            currentTelegramUsername = userData.telegramUsername;
            displayTelegramUsername.textContent = currentTelegramUsername;
            userBalanceSpan.textContent = userData.balance.toFixed(4); // Display balance
            authSection.style.display = 'none';
            appContent.style.display = 'block';
            loadWithdrawalHistory(user.uid);
            setupRealtimeChat();
            loadLeaderboard();
        }
    } else {
        // No user logged in, show login section
        currentUser = null;
        currentTelegramUsername = null;
        authSection.style.display = 'block';
        appContent.style.display = 'none';
        authStatus.textContent = 'Login or Register with your Telegram Username.';
        loginBtn.textContent = 'Login / Register';
        displayTelegramUsername.textContent = '';
        userBalanceSpan.textContent = '0.00';
    }
});

loginBtn.addEventListener('click', async () => {
    const telegramUsername = telegramUsernameInput.value.trim();
    if (!telegramUsername) {
        authStatus.textContent = 'Please enter a Telegram username.';
        return;
    }

    // If no user is authenticated, sign in anonymously
    if (!currentUser) {
        try {
            const userCredential = await signInAnonymously(auth);
            currentUser = userCredential.user;
            // Now that we have a user, save their Telegram username
            await setDoc(doc(usersRef, currentUser.uid), {
                telegramUsername: telegramUsername,
                balance: 0,
                totalEarned: 0,
                createdAt: serverTimestamp()
            });
            currentTelegramUsername = telegramUsername;
            displayTelegramUsername.textContent = currentTelegramUsername;
            userBalanceSpan.textContent = '0.00';
            authSection.style.display = 'none';
            appContent.style.display = 'block';
            authStatus.textContent = '';
            loadWithdrawalHistory(currentUser.uid);
            setupRealtimeChat();
            loadLeaderboard();
        } catch (error) {
            console.error("Error during anonymous sign-in or user data creation:", error);
            authStatus.textContent = `Error: ${error.message}`;
        }
    } else {
        // User is already anonymously logged in, just update their username if it's a new user flow
        const userDocRef = doc(usersRef, currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists() || !userDocSnap.data().telegramUsername) {
            await updateDoc(userDocRef, {
                telegramUsername: telegramUsername
            });
            currentTelegramUsername = telegramUsername;
            displayTelegramUsername.textContent = currentTelegramUsername;
            authSection.style.display = 'none';
            appContent.style.display = 'block';
            authStatus.textContent = '';
            loadWithdrawalHistory(currentUser.uid);
            setupRealtimeChat();
            loadLeaderboard();
        }
    }
});

// --- Ad Click and Reward System ---

adButtons.forEach(button => {
    button.addEventListener('click', async () => {
        if (!currentUser || !currentTelegramUsername) {
            adMessage.textContent = 'Please log in with your Telegram username first.';
            return;
        }

        const adId = button.dataset.adId;
        const smartlink = button.dataset.smartlink;
        const userAdCooldownDocRef = doc(adCooldownsRef, `${currentUser.uid}_${adId}`);

        try {
            const cooldownDocSnap = await getDoc(userAdCooldownDocRef);
            const now = Date.now();

            if (cooldownDocSnap.exists()) {
                const lastClickTime = cooldownDocSnap.data().timestamp.toDate().getTime();
                const timeElapsed = now - lastClickTime;
                const timeLeft = AD_COOLDOWN_SECONDS * 1000 - timeElapsed;

                if (timeLeft > 0) {
                    const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
                    adMessage.textContent = `Please wait ${minutesLeft} minute(s) before clicking this ad again.`;
                    return;
                }
            }

            // Open the smartlink in a new tab
            window.open(smartlink, '_blank');

            // Reward the user and update cooldown
            await updateDoc(doc(usersRef, currentUser.uid), {
                balance: parseFloat((parseFloat(userBalanceSpan.textContent) + REWARD_AMOUNT).toFixed(4)),
                totalEarned: parseFloat((parseFloat(userBalanceSpan.textContent) + REWARD_AMOUNT).toFixed(4)) // Simplified for now, should be separate
            });
            userBalanceSpan.textContent = (parseFloat(userBalanceSpan.textContent) + REWARD_AMOUNT).toFixed(4);

            await setDoc(userAdCooldownDocRef, {
                timestamp: serverTimestamp()
            });

            adMessage.textContent = `You earned ₱${REWARD_AMOUNT.toFixed(4)}! Cooldown for this ad is 1 minute.`;
            loadLeaderboard(); // Update leaderboard after earning
        } catch (error) {
            console.error("Error processing ad click:", error);
            adMessage.textContent = 'An error occurred while processing your click.';
        }
    });
});

// --- GCash Withdrawal ---

requestWithdrawalBtn.addEventListener('click', async () => {
    if (!currentUser || !currentTelegramUsername) {
        withdrawalStatusMessage.textContent = 'Please log in first.';
        return;
    }

    const gcashNumber = gcashNumberInput.value.trim();
    const amount = parseFloat(withdrawalAmountInput.value);

    if (!gcashNumber || !amount || amount < MIN_WITHDRAWAL) {
        withdrawalStatusMessage.textContent = `Please enter a valid GCash number and an amount of at least ₱${MIN_WITHDRAWAL.toFixed(2)}.`;
        return;
    }

    const userDocRef = doc(usersRef, currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    const userBalance = userDocSnap.data().balance;

    if (userBalance < amount) {
        withdrawalStatusMessage.textContent = 'Insufficient balance.';
        return;
    }

    try {
        // Deduct from user balance
        await updateDoc(userDocRef, {
            balance: parseFloat((userBalance - amount).toFixed(4))
        });
        userBalanceSpan.textContent = (userBalance - amount).toFixed(4);

        // Add withdrawal request
        await addDoc(withdrawalsRef, {
            userId: currentUser.uid,
            telegramUsername: currentTelegramUsername,
            gcashNumber: gcashNumber,
            amount: amount,
            status: 'Pending',
            requestedAt: serverTimestamp()
        });

        withdrawalStatusMessage.textContent = 'Withdrawal request submitted successfully! Status: Pending';
        gcashNumberInput.value = '';
        withdrawalAmountInput.value = '';
        loadWithdrawalHistory(currentUser.uid); // Refresh history
    } catch (error) {
        console.error("Error requesting withdrawal:", error);
        withdrawalStatusMessage.textContent = `Error: ${error.message}`;
    }
});

async function loadWithdrawalHistory(userId) {
    const q = query(withdrawalsRef, where("userId", "==", userId), orderBy("requestedAt", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        withdrawalHistoryList.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement('li');
            li.textContent = `Amount: ₱${data.amount.toFixed(2)}, GCash: ${data.gcashNumber}, Status: ${data.status} (${new Date(data.requestedAt.toDate()).toLocaleString()})`;
            withdrawalHistoryList.appendChild(li);
        });
    });
}

// --- Chat Room ---

function setupRealtimeChat() {
    onValue(chatRef, (snapshot) => {
        chatMessagesDiv.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const message = childSnapshot.val();
            const p = document.createElement('p');
            p.textContent = `[${new Date(message.timestamp).toLocaleTimeString()}] ${message.username}: ${message.text}`;
            chatMessagesDiv.appendChild(p);
        });
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Auto-scroll to bottom
    });
}

sendChatBtn.addEventListener('click', () => {
    const messageText = chatInput.value.trim();
    if (messageText && currentUser && currentTelegramUsername) {
        push(chatRef, {
            username: currentTelegramUsername,
            text: messageText,
            timestamp: Date.now()
        });
        chatInput.value = '';
    } else if (!currentTelegramUsername) {
        alert("Please set your Telegram username to chat.");
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatBtn.click();
    }
});

// --- Leaderboard ---

function loadLeaderboard() {
    const q = query(usersRef, orderBy("totalEarned", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        leaderboardList.innerHTML = '';
        snapshot.forEach((doc) => {
            const userData = doc.data();
            const li = document.createElement('li');
            li.textContent = `${userData.telegramUsername}: ₱${userData.totalEarned.toFixed(4)}`;
            leaderboardList.appendChild(li);
        });
    });
}

// --- Admin Dashboard ---

adminLoginBtn.addEventListener('click', () => {
    const password = adminPasswordInput.value;
    if (password === "Propetas12") {
        adminLoginStatus.textContent = 'Admin logged in!';
        adminContent.style.display = 'block';
        loadAdminWithdrawalRequests();
        loadAdminUsers();
    } else {
        adminLoginStatus.textContent = 'Incorrect password.';
        adminContent.style.display = 'none';
    }
});

function loadAdminWithdrawalRequests() {
    const q = query(withdrawalsRef, orderBy("requestedAt", "desc"));
    onSnapshot(q, (snapshot) => {
        adminWithdrawalRequests.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <span>User: ${data.telegramUsername} (ID: ${data.userId.substring(0, 5)}...), Amount: ₱${data.amount.toFixed(2)}, GCash: ${data.gcashNumber}, Status: <strong>${data.status}</strong></span>
                <div class="admin-action-buttons">
                    ${data.status === 'Pending' ? `
                        <button onclick="approveWithdrawal('${docSnap.id}', '${data.userId}', ${data.amount})">Approve</button>
                        <button onclick="rejectWithdrawal('${docSnap.id}')">Reject</button>
                    ` : ''}
                </div>
            `;
            adminWithdrawalRequests.appendChild(li);
        });
    });
}

async function approveWithdrawal(withdrawalId, userId, amount) {
    try {
        await updateDoc(doc(withdrawalsRef, withdrawalId), {
            status: 'Approved',
            processedAt: serverTimestamp()
        });
        alert(`Withdrawal ${withdrawalId} approved.`);
        // No need to add back to user balance, it was already deducted
    } catch (error) {
        console.error("Error approving withdrawal:", error);
        alert("Error approving withdrawal.");
    }
}

async function rejectWithdrawal(withdrawalId) {
    try {
        // For rejection, you might want to refund the amount to the user
        // This requires getting the amount from the withdrawal request
        const withdrawalDoc = await getDoc(doc(withdrawalsRef, withdrawalId));
        const withdrawalData = withdrawalDoc.data();
        const userId = withdrawalData.userId;
        const amount = withdrawalData.amount;

        await updateDoc(doc(withdrawalsRef, withdrawalId), {
            status: 'Rejected',
            processedAt: serverTimestamp()
        });

        // Refund the user's balance
        const userDocRef = doc(usersRef, userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const currentBalance = userDocSnap.data().balance;
            await updateDoc(userDocRef, {
                balance: parseFloat((currentBalance + amount).toFixed(4))
            });
        }

        alert(`Withdrawal ${withdrawalId} rejected and amount refunded to user.`);
    } catch (error) {
        console.error("Error rejecting withdrawal:", error);
        alert("Error rejecting withdrawal.");
    }
}

function loadAdminUsers() {
    onSnapshot(usersRef, (snapshot) => {
        adminUserList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.textContent = `User: ${data.telegramUsername}, Balance: ₱${data.balance.toFixed(4)}, Total Earned: ₱${data.totalEarned.toFixed(4)}`;
            adminUserList.appendChild(li);
        });
    });
}

// Expose admin functions globally for onclick in HTML
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;

// Initial anonymous login attempt (if no user data is found, it will prompt for username)
signInAnonymously(auth).catch(error => {
    console.error("Initial anonymous sign-in failed:", error);
    authStatus.textContent = `Error during initial login: ${error.message}`;
});
