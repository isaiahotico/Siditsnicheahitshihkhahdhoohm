import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Firebase Config ---
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Adsgram Controller Setup ---
const AdsGram = window.AdsGram || window.SAD;

// Initializing the 3 different controllers with your Block IDs
const controllers = {
    btn1: AdsGram.init({ blockId: "task-21469" }),
    btn2: AdsGram.init({ blockId: "int-21471" }),
    btn3: AdsGram.init({ blockId: "int-21422" })
};

const tg = window.Telegram?.WebApp;
const userId = tg?.initDataUnsafe?.user?.id?.toString() || "local_warrior";
const balanceEl = document.getElementById('balance');
const statusEl = document.getElementById('status-bar');

// Sync balance from Firebase
async function syncBalance() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
        balanceEl.innerText = snap.data().points;
    } else {
        await setDoc(userRef, { points: 0 });
    }
}

// Interstitial Handler
async function triggerInterstitial(btnKey) {
    statusEl.innerText = "Loading golden armor ad...";
    
    try {
        const adController = controllers[btnKey];
        const result = await adController.show();
        
        if (result.done) {
            statusEl.innerText = "Ad Finished! Reward granted.";
            await updateFirebase(10); // Reward 10 gold for watching
        } else {
            statusEl.innerText = "Ad dismissed early.";
        }
    } catch (err) {
        console.error("Adsgram error:", err);
        statusEl.innerText = "Ad Error: " + (err.description || "Failed to load");
    }
}

async function updateFirebase(amount) {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, { 
        points: increment(amount),
        lastUpdated: new Date()
    }, { merge: true });
    
    // Refresh local UI
    const snap = await getDoc(userRef);
    balanceEl.innerText = snap.data().points;
}

// Expose to window for HTML access
window.triggerInterstitial = triggerInterstitial;

// Init
syncBalance();
if(tg) tg.expand();
