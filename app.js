import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Firebase Configuration ---
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// Generate a User ID (From Telegram or fallback)
const userId = tg?.initDataUnsafe?.user?.id?.toString() || "guest_user";

// --- Adsgram Initialization ---
const AdsGram = window.AdsGram || window.SAD;

// Define the controllers using your block IDs
const controller1 = AdsGram.init({ blockId: "task-21469" });
const controller2 = AdsGram.init({ blockId: "21470" });
const controller3 = AdsGram.init({ blockId: "int-21471" });

// UI Elements
const balanceEl = document.getElementById('balance');
const statusEl = document.getElementById('status-msg');

// Load User Data
async function loadUserData() {
    const userRef = doc(db, "users", userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        balanceEl.innerText = docSnap.data().points || 0;
    } else {
        await setDoc(userRef, { points: 0, username: tg?.initDataUnsafe?.user?.username || "Guest" });
    }
}

// Function to handle Ads and Rewards
async function triggerAd(controller, amount) {
    statusEl.innerText = "Loading golden ad...";
    
    try {
        const result = await controller.show();
        if (result.done) {
            // Success! Reward the user in Firestore
            statusEl.innerText = "Reward Confirmed! Updating Armor...";
            const userRef = doc(db, "users", userId);
            
            await setDoc(userRef, { 
                points: increment(amount),
                lastClaim: new Date()
            }, { merge: true });

            // Update UI locally
            const currentPoints = parseInt(balanceEl.innerText);
            balanceEl.innerText = currentPoints + amount;
            statusEl.innerText = `Success! +${amount} points added.`;
        } else {
            statusEl.innerText = "Ad closed early. No points awarded.";
        }
    } catch (e) {
        console.error(e);
        statusEl.innerText = "Ad failed to load. Try again later.";
    }
}

// Event Listeners
document.getElementById('btn-reward-1').addEventListener('click', () => triggerAd(controller1, 10));
document.getElementById('btn-reward-2').addEventListener('click', () => triggerAd(controller2, 10));
document.getElementById('btn-interstitial').addEventListener('click', () => triggerAd(controller3, 5));

// Initial Load
loadUserData();
