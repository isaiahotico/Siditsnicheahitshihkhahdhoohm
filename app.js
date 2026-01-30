
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBXYAc9-UAB0DzqYsFKAHR_OsRD2UhVLjs",
    authDomain: "project-ads-app-telegram.firebaseapp.com",
    projectId: "project-ads-app-telegram",
    storageBucket: "project-ads-app-telegram.firebasestorage.app",
    messagingSenderId: "867442007509",
    appId: "1:867442007509:web:3fe7c9872d0ab88c1bf15c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let cooldown = false;
const REWARD = 0.0001;
const FP_API_KEY = "a92bb3fc17bf8476f2705f613ffc976dff7d8ed8f977c1e80294beb4f131a7f3";

window.loginUser = async () => {
    const email = document.getElementById('fpEmail').value;
    const refBy = document.getElementById('refBy').value;
    if(!email.includes('@')) return alert("Enter valid FaucetPay Email");

    const cred = await signInAnonymously(auth);
    const uid = cred.user.uid;
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if(!snap.exists()){
        await setDoc(userRef, {
            email: email,
            balance: 0,
            referralEarnings: 0,
            totalRefs: 0,
            refCode: uid.substring(0,6).toUpperCase(),
            referredBy: refBy || null,
            lastAd: 0
        });
        if(refBy) {
            // Logic to increment totalRefs for the referrer could be added here
        }
    }
    document.getElementById('loginPopup').style.display = 'none';
};

onAuthStateChanged(auth, (user) => {
    if(user) {
        currentUser = user;
        listenUserData();
        loadLeaderboard();
        loadChat();
        document.getElementById('loginPopup').style.display = 'none';
    }
});

function listenUserData() {
    onSnapshot(doc(db, "users", currentUser.uid), (doc) => {
        const data = doc.data();
        document.getElementById('balanceDisplay').innerText = data.balance.toFixed(8);
        document.getElementById('myCodeDisplay').innerText = data.refCode;
        document.getElementById('totalRefs').innerText = data.totalRefs;
        document.getElementById('refEarned').innerText = data.referralEarnings.toFixed(8);
    });
}

window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
};

window.watchAd = async (zoneId) => {
    if(cooldown) return alert("Wait for cooldown!");
    
    const showAd = zoneId === 1 ? show_10276123 : (zoneId === 2 ? show_10337795 : show_10337853);

    showAd().then(async () => {
        cooldown = true;
        await rewardProcess();
        startCooldown();
    }).catch(e => alert("Ad failed to load. Check AdBlocker."));
};

async function rewardProcess() {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    // Credit User
    await updateDoc(userRef, { balance: increment(REWARD) });

    // Credit Referrer (8%)
    if(userData.referredBy) {
        const q = query(collection(db, "users"), where("refCode", "==", userData.referredBy));
        // Note: For simplicity, this requires a search. Optimized version uses Referrer UID.
        // Assuming referredBy stores the actual UID for direct credit:
        const refRef = doc(db, "users", userData.referredBy); 
        await updateDoc(refRef, { 
            referralEarnings: increment(REWARD * 0.08) 
        });
    }
}

function startCooldown() {
    let timer = 12;
    document.getElementById('cooldownText').classList.remove('hidden');
    const interval = setInterval(() => {
        timer--;
        document.getElementById('timer').innerText = timer;
        if(timer <= 0) {
            clearInterval(interval);
            cooldown = false;
            document.getElementById('cooldownText').classList.add('hidden');
        }
    }, 1000);
}

window.withdrawNow = async () => {
    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);
    const bal = snap.data().balance;
    const email = snap.data().email;

    if(bal <= 0) return alert("Balance too low");

    // FaucetPay API Call via Proxy (to avoid CORS)
    const url = `https://corsproxy.io/?https://faucetpay.io/api/v1/send?api_key=${FP_API_KEY}&amount=${bal}&currency=USDT&to=${email}`;
    
    const res = await fetch(url);
    const data = await res.json();

    if(data.status === 200) {
        await updateDoc(userRef, { balance: 0 });
        alert("Payment Sent Successfully!");
    } else {
        alert("Payment Error: " + data.message);
    }
};

// Chat Logic
window.sendMessage = async () => {
    const msg = document.getElementById('chatInput').value;
    if(!msg) return;
    await addDoc(collection(db, "messages"), {
        text: msg,
        sender: auth.currentUser.uid.substring(0,5),
        timestamp: serverTimestamp()
    });
    document.getElementById('chatInput').value = "";
};

function loadChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(20));
    onSnapshot(q, (snap) => {
        const box = document.getElementById('chatBox');
        box.innerHTML = "";
        snap.docs.reverse().forEach(d => {
            box.innerHTML += `<div class="bg-slate-800 p-2 rounded">
                <span class="text-blue-400 font-bold">${d.data().sender}:</span> ${d.data().text}
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function loadLeaderboard() {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('leaderboardList');
        list.innerHTML = "";
        snap.forEach(d => {
            list.innerHTML += `
                <tr class="border-b border-gray-800">
                    <td class="p-4">${d.data().email.substring(0,3)}...</td>
                    <td class="p-4 text-right text-green-400">${d.data().balance.toFixed(4)} USDT</td>
                </tr>`;
        });
    });
}

window.copyRef = () => {
    const code = document.getElementById('myCodeDisplay').innerText;
    navigator.clipboard.writeText(code);
    alert("Code Copied!");
};
