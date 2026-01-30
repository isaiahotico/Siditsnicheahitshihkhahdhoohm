
// Import Firebase and Firestore modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where, getDocs } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBXYAc9-UAB0DzqYsFKAHR_OsRD2UhVLjs",
  authDomain: "project-ads-app-telegram.firebaseapp.com",
  projectId: "project-ads-app-telegram",
  storageBucket: "project-ads-app-telegram.firebasestorage.app",
  messagingSenderId: "867442007509",
  appId: "1:867442007509:web:3fe7c9872d0ab88c1bf15c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Use getFirestore for Firestore

// Telegram Web App Initialization
const tg = window.Telegram.WebApp;
tg.ready(); // Make sure Telegram app is ready
tg.expand(); // Expand the app to fill the screen

// CONFIG
const REWARD_AMOUNT = 0.0001;
const REF_COMMISSION = 0.08; // 8%
const COOLDOWN_TIME = 12;
const FP_API_KEY = "a92bb3fc17bf8476f2705f613ffc976dff7d8ed8f977c1e80294beb4f131a7f3";

// Get Telegram User Info
const userId = tg.initDataUnsafe?.user?.id?.toString() || "DEBUG_USER_" + Math.random().toString(36).substring(2, 10);
const userName = tg.initDataUnsafe?.user?.first_name || "Anonymous";
const userUsername = tg.initDataUnsafe?.user?.username || ""; // Get username if available

let userData = {};
let adZoneIndex = 0;
const adZones = ['10276123', '10337795', '10337853']; // Monetag Zones

// --- Firestore Collections ---
const usersCollection = collection(db, 'users');
const chatCollection = collection(db, 'chat');
// Leaderboard will be queried from users, no separate collection needed initially.

// --- Utility Functions ---
function updateUI() {
    document.getElementById('userNameDisplay').innerText = userName; // Display Telegram Name
    if (userUsername) { // Add Telegram username if available
        document.getElementById('userNameDisplay').innerText += ` (@${userUsername})`;
    }
    document.getElementById('userBalance').innerText = `${userData.balance.toFixed(5)} USDT`;
    document.getElementById('refCount').innerText = userData.referralsCount || 0;
    document.getElementById('refEarned').innerText = (userData.referralBalance || 0).toFixed(6);
    if (userData.email) document.getElementById('fpEmail').value = userData.email;
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(window.innerWidth < 768) toggleSidebar(); // Close sidebar on mobile after tab switch
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// --- Core App Logic ---

// Initialize User Data from Firestore
async function initUser() {
    const userDocRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        userData = {
            id: userId, // Store ID for easier reference
            name: userName,
            username: userUsername, // Store username
            balance: 0,
            referralBalance: 0,
            totalEarned: 0,
            referralsCount: 0,
            email: "",
            referrer: "", // ID of the user who referred this one
            lastClaim: 0,
            createdAt: serverTimestamp()
        };
        await setDoc(userDocRef, userData);
    } else {
        userData = docSnap.data();
        // Ensure fields exist in case of older user documents
        userData.name = userName; // Update name if it changed on Telegram
        userData.username = userUsername; // Update username if it changed
        if (userData.balance === undefined) userData.balance = 0;
        if (userData.referralBalance === undefined) userData.referralBalance = 0;
        if (userData.totalEarned === undefined) userData.totalEarned = 0;
        if (userData.referralsCount === undefined) userData.referralsCount = 0;
        if (userData.email === undefined) userData.email = "";
        if (userData.referrer === undefined) userData.referrer = "";
        if (userData.lastClaim === undefined) userData.lastClaim = 0;
        
        // If the user document is old and lacks 'id', 'name', 'username', update it
        if (userData.id !== userId || userData.name !== userName || userData.username !== userUsername) {
             await updateDoc(userDocRef, {
                id: userId,
                name: userName,
                username: userUsername
            });
        }
    }
    
    document.getElementById('myCode').innerText = userId; // Display user ID as referral code
    updateUI();
    loadLeaderboard();
    loadChat();
    
    // Set Telegram Main Button for Auto Withdraw
    tg.MainButton.setText("AUTO WITHDRAW").show();
    tg.onEvent('mainButtonClicked', withdrawMain);
}

// Monetag Ad Handling
let watchAdBtn = document.getElementById('adBtn');
let cooldownTimerElement = document.getElementById('timer');
let cooldownTextElement = document.getElementById('cooldownText');

async function watchAd() {
    const now = Date.now();
    const timeSinceLastClaim = now - (userData.lastClaim || 0);

    if (timeSinceLastClaim < COOLDOWN_TIME * 1000) {
        const remaining = COOLDOWN_TIME - Math.floor(timeSinceLastClaim / 1000);
        alert(`Please wait ${remaining} seconds.`);
        return;
    }

    const zone = adZones[adZoneIndex];
    adZoneIndex = (adZoneIndex + 1) % adZones.length;

    try {
        // Dynamically call the Monetag ad function
        const showAdFunc = window[`show_${zone}`];
        if (!showAdFunc) throw new Error(`Monetag SDK function for zone ${zone} not found.`);

        showAdFunc('pop').then(async () => {
            await creditReward();
            startCooldown();
        }).catch(e => {
            console.error("Monetag Ad Error:", e);
            alert("Ad failed to load. Please try again.");
        });
    } catch (e) {
        console.error("Ad Button Error:", e);
        alert("An error occurred. Please try again.");
    }
}

function startCooldown() {
    watchAdBtn.disabled = true;
    cooldownTextElement.classList.remove('hidden');
    let remainingTime = COOLDOWN_TIME;
    
    const intervalId = setInterval(() => {
        remainingTime--;
        cooldownTimerElement.innerText = remainingTime;
        if (remainingTime <= 0) {
            clearInterval(intervalId);
            watchAdBtn.disabled = false;
            cooldownTextElement.classList.add('hidden');
        }
    }, 1000);
}

async function creditReward() {
    const userDocRef = doc(db, 'users', userId);
    const reward = REWARD_AMOUNT;
    let referralBonus = 0;

    // Calculate referral bonus *before* updating user's balance
    if (userData.referrer) {
        const referrerDocRef = doc(db, 'users', userData.referrer);
        try {
            const referrerSnap = await getDoc(referrerDocRef);
            if (referrerSnap.exists()) {
                const referrerData = referrerSnap.data();
                referralBonus = reward * REF_COMMISSION;
                
                // Update referrer's referralBalance and totalEarned
                await updateDoc(referrerDocRef, {
                    referralBalance: (referrerData.referralBalance || 0) + referralBonus,
                    totalEarned: (referrerData.totalEarned || 0) + referralBonus
                });
            }
        } catch (error) {
            console.error("Error updating referrer:", error);
        }
    }

    // Update current user's balance and total earned
    userData.balance += reward;
    userData.totalEarned += reward + referralBonus; // Include bonus in total earned
    userData.lastClaim = Date.now();

    await updateDoc(userDocRef, {
        balance: userData.balance,
        totalEarned: userData.totalEarned,
        lastClaim: userData.lastClaim
    });
    updateUI();
}

// --- FaucetPay Withdrawal ---
async function saveEmail() {
    const emailInput = document.getElementById('fpEmail');
    const warningElement = document.getElementById('fpWarning');
    const email = emailInput.value.trim();

    if (!email || !email.includes('@')) {
        warningElement.classList.remove('hidden');
        return alert("Please enter a valid FaucetPay email address.");
    }

    const userDocRef = doc(db, 'users', userId);
    try {
        await updateDoc(userDocRef, { email: email });
        userData.email = email;
        alert("FaucetPay email updated successfully!");
        warningElement.classList.add('hidden');
    } catch (error) {
        console.error("Error saving email:", error);
        alert("Failed to save email. Please try again.");
    }
}

async function processPayout(amount, type) { // type: 'main' or 'ref'
    if (!userData.email) {
        document.getElementById('fpWarning').classList.remove('hidden');
        alert("Please set your FaucetPay email first!");
        return;
    }
    if (amount <= 0) {
        alert("No funds to withdraw.");
        return;
    }

    tg.MainButton.setText("PROCESSING...").show();

    // **IMPORTANT NOTE ON FAUCETPAY API:**
    // FaucetPay API calls are typically restricted by CORS when made directly from a browser.
    // For a production app, you NEED a backend server (e.g., Node.js) that makes this request.
    // This client-side code simulates the request and assumes success for demo purposes.
    // If you run this locally or on a server without CORS handling, the fetch will likely fail.

    const FaucetPayAPI_URL = `https://faucetpay.io/api/v1/send`;
    const payload = {
        api_key: FP_API_KEY,
        amount: amount,
        currency: 'USDT',
        to: userData.email,
        referral: 'no' // FaucetPay's own referral system
    };

    try {
        // Mocking the API call for demonstration if CORS prevents actual request
        console.log("Attempting FaucetPay Payout:", payload);
        
        // In a real app, use: const response = await fetch(FaucetPayAPI_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        // For demonstration, we'll assume success and log.
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network latency

        // Assuming success for the demo. If you have a backend, uncomment and adapt the fetch call above.
        alert(`Payout of ${amount.toFixed(6)} USDT sent to ${userData.email} (Simulated).`);
        
        const userDocRef = doc(db, 'users', userId);
        if (type === 'main') {
            await updateDoc(userDocRef, { balance: 0 });
            userData.balance = 0;
        } else { // type === 'ref'
            await updateDoc(userDocRef, { referralBalance: 0 });
            userData.referralBalance = 0;
        }
        updateUI();

    } catch (error) {
        console.error("FaucetPay API Error (or CORS issue):", error);
        alert("Payout failed. Check console for details or try again later.");
    } finally {
        tg.MainButton.setText("AUTO WITHDRAW").hide(); // Hide main button after action
        tg.offEvent('mainButtonClicked', withdrawMain); // Detach listener
    }
}

// Handle Main Button Click for Withdrawal
function handleMainButtonClick() {
    if (userData.balance > 0) {
        processPayout(userData.balance, 'main');
    } else {
        alert("No balance to withdraw.");
    }
}

// Event listener for Telegram Main Button
tg.MainButton.onClick(handleMainButtonClick);

// Button for claiming referral balance
async function claimReferralBalance() {
    if (userData.referralBalance > 0) {
        await processPayout(userData.referralBalance, 'ref');
    } else {
        alert("No referral earnings to claim.");
    }
}

// --- Referral System ---
async function applyReferral() {
    const refInput = document.getElementById('refInput');
    const referredById = refInput.value.trim();

    if (!referredById) {
        alert("Please enter a referral code.");
        return;
    }
    if (referredById === userId) {
        alert("You cannot use your own referral code.");
        return;
    }
    if (userData.referrer && userData.referrer !== "") {
        alert("You already have a referrer.");
        return;
    }

    const referrerDocRef = doc(db, 'users', referredById);
    try {
        const referrerSnap = await getDoc(referrerDocRef);
        if (referrerSnap.exists()) {
            // Link this user to the referrer
            await updateDoc(doc(db, 'users', userId), { referrer: referredById });
            
            // Increment referral count for the referrer
            const referrerData = referrerSnap.data();
            await updateDoc(referrerDocRef, {
                referralsCount: (referrerData.referralsCount || 0) + 1
            });

            userData.referrer = referredById; // Update local state
            refInput.value = ""; // Clear input
            alert("Referral linked successfully!");
            updateUI();
        } else {
            alert("Invalid referral code.");
        }
    } catch (error) {
        console.error("Error linking referral:", error);
        alert("Could not link referral. Please try again.");
    }
}

// --- Chat Functionality ---
let chatBox = document.getElementById('chatBox');
let chatInput = document.getElementById('chatInput');

async function sendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    const newMessage = {
        senderId: userId,
        senderName: userName,
        senderUsername: userUsername,
        text: messageText,
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'chat'), newMessage);
        chatInput.value = "";
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message.");
    }
}

// Real-time chat listener
let chatUnsubscribe; // To store the unsubscribe function

function loadChat() {
    const q = query(chatCollection, orderBy('timestamp', 'desc'), limit(20));
    chatUnsubscribe = onSnapshot(q, (querySnapshot) => {
        chatBox.innerHTML = ""; // Clear current messages
        const messages = [];
        querySnapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        
        // Render messages in chronological order
        messages.reverse().forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('bg-white/5', 'p-2', 'rounded-lg');
            
            let senderInfo = msg.senderName;
            if (msg.senderUsername) {
                senderInfo += ` (@${msg.senderUsername})`;
            }
            // Highlight own messages
            if (msg.senderId === userId) {
                senderInfo = `<b>You</b>`;
                messageElement.classList.add('text-yellow-300'); // Style your own messages differently
            } else {
                 messageElement.classList.add('text-gray-300');
            }

            messageElement.innerHTML = `<b class="text-blue-400">${senderInfo}:</b> ${msg.text}`;
            chatBox.appendChild(messageElement);
        });
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
    }, (error) => {
        console.error("Error listening to chat:", error);
    });
}

// --- Leaderboard ---
async function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '<p class="text-center text-gray-500">Loading...</p>';

    const usersRef = collection(db, 'users');
    // Query for users ordered by totalEarned, limited to top 10
    // NOTE: Firestore requires an index for orderBy on a field not in the query.
    // Create an index for 'totalEarned' in descending order.
    const q = query(usersRef, orderBy('totalEarned', 'desc'), limit(10));

    try {
        const querySnapshot = await getDocs(q);
        leaderboardList.innerHTML = ""; // Clear loading indicator
        if (querySnapshot.empty) {
            leaderboardList.innerHTML = '<p class="text-center text-gray-500">No data yet.</p>';
            return;
        }
        
        querySnapshot.forEach((doc, index) => {
            const userData = doc.data();
            const rank = index + 1;
            const listItem = document.createElement('div');
            listItem.classList.add('flex', 'justify-between', 'items-center', 'p-3', 'bg-white/5', 'rounded-xl');
            listItem.innerHTML = `
                <span>${rank}. ${userData.name || 'User'} ${userData.username ? `(@${userData.username})` : ''}</span>
                <span class="font-mono text-green-400">${(userData.totalEarned || 0).toFixed(4)} USDT</span>
            `;
            leaderboardList.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error loading leaderboard:", error);
        leaderboardList.innerHTML = '<p class="text-center text-red-500">Failed to load leaderboard.</p>';
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initUser(); // Initialize user data and UI

    // Make sure Telegram UI elements are configured
    tg.MainButton.setText("AUTO WITHDRAW").show();
    tg.onEvent('mainButtonClicked', handleMainButtonClick);
});

// Cleanup listener when the app is closed (important for SPA)
window.onbeforeunload = () => {
    if (chatUnsubscribe) chatUnsubscribe(); // Stop listening to chat
    tg.offEvent('mainButtonClicked', handleMainButtonClick); // Remove main button listener
};
