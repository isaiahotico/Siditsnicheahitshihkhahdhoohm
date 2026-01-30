
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, increment, where } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const fb = initializeApp(firebaseConfig);
const db = getFirestore(fb);

let user = null;
const AD_ZONES = ['10276123', '10337795', '10337853'];

window.app = {
    login: async () => {
        const name = document.getElementById('username').value.trim();
        if(!name) return;
        user = name.toLowerCase().replace(/\s/g, '_');
        
        const userRef = doc(db, "users", user);
        const snap = await getDoc(userRef);
        
        if(!snap.exists()) {
            await setDoc(userRef, { name, balance: 0, totalEarned: 0, isAdmin: false });
        }
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
        app.initApp();
    },

    initApp: () => {
        // 1. Listen to user data
        onSnapshot(doc(db, "users", user), (s) => {
            const data = s.val() || s.data();
            document.getElementById('balance').innerText = data.balance.toFixed(4);
        });

        // 2. Load History instantly
        onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", user)), (s) => {
            const hist = document.getElementById('history-list');
            hist.innerHTML = '';
            s.forEach(d => {
                const w = d.data();
                hist.innerHTML += `<div class="glass p-2 rounded text-[10px] flex justify-between">
                    <span>₱${w.amount} -> ${w.gcash}</span>
                    <span class="${w.status === 'Paid' ? 'text-green-900' : 'text-orange-900'}">${w.status}</span>
                </div>`;
            });
        });

        // 3. Leaderboard
        onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10)), (s) => {
            const lb = document.getElementById('leaderboard');
            lb.innerHTML = '';
            let i = 1;
            s.forEach(d => {
                const u = d.data();
                lb.innerHTML += `<div class="flex justify-between p-3 glass rounded-xl">
                    <span>${i++}. ${u.name}</span><span>₱${u.totalEarned.toFixed(3)}</span>
                </div>`;
            });
        });

        // 4. Chat
        onSnapshot(query(collection(db, "chat"), orderBy("ts", "desc"), limit(20)), (s) => {
            const chat = document.getElementById('chat-messages');
            chat.innerHTML = '';
            s.docs.reverse().forEach(d => {
                const m = d.data();
                chat.innerHTML += `<div class="text-sm"><b>${m.name}:</b> ${m.text}</div>`;
            });
            chat.scrollTop = chat.scrollHeight;
        });

        // 5. AUTO SHOW IN-APP ADS
        app.showInAppAds();
    },

    showInAppAds: () => {
        AD_ZONES.forEach(zone => {
            const funcName = `show_${zone}`;
            if(window[funcName]) {
                window[funcName]({
                    type: 'inApp',
                    inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
                });
                // Small reward for in-app
                app.reward(0.0002, "Bonus for In-App Ad!");
            }
        });
    },

    watchMainAd: () => {
        // UI Change
        const bg = document.getElementById('bg-layer');
        bg.classList.remove('gold-armor');
        bg.classList.add('lagoon-bg');

        // Pick random zone and random format (Interstitial vs Pop)
        const zone = AD_ZONES[Math.floor(Math.random() * AD_ZONES.length)];
        const format = Math.random() > 0.5 ? 'pop' : ''; 
        const adFunc = window[`show_${zone}`];

        if(adFunc) {
            adFunc(format).then(() => {
                app.reward(0.0065, "Ad Watched Successfully!");
            }).catch(() => alert("Ad failed to load. Try again."));
        }

        setTimeout(() => {
            bg.classList.add('gold-armor');
            bg.classList.remove('lagoon-bg');
        }, 5000);
    },

    reward: async (amt, msg) => {
        await updateDoc(doc(db, "users", user), {
            balance: increment(amt),
            totalEarned: increment(amt)
        });
        if(amt > 0.0002) alert(msg);
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if(!input.value) return;
        await addDoc(collection(db, "chat"), {
            name: user.toUpperCase(),
            text: input.value,
            ts: Date.now()
        });
        input.value = '';
    },

    requestWithdraw: async () => {
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const gcash = document.getElementById('gcash-num').value;
        const userRef = doc(db, "users", user);
        const userData = (await getDoc(userRef)).data();

        if(amount < 0.02) return alert("Min. ₱0.02");
        if(amount > userData.balance) return alert("Low balance");

        await addDoc(collection(db, "withdrawals"), {
            uid: user,
            name: userData.name,
            amount: amount,
            gcash: gcash,
            status: "Pending",
            ts: Date.now()
        });

        await updateDoc(userRef, { balance: increment(-amount) });
        alert("Request sent! Admin will approve manually.");
    },

    switchTab: (id) => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        document.getElementById('tab-' + id).classList.add('active-tab');
    },

    unlockAdmin: () => {
        if(document.getElementById('admin-pass').value === "Propetas12") {
            document.getElementById('admin-lock').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            app.loadAdminPanel();
        }
    },

    loadAdminPanel: () => {
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending")), (s) => {
            const list = document.getElementById('admin-pending-list');
            list.innerHTML = '';
            s.forEach(d => {
                const w = d.data();
                list.innerHTML += `<div class="glass p-2 mb-2 flex justify-between items-center">
                    <span>${w.name}: ₱${w.amount} (${w.gcash})</span>
                    <button onclick="app.approvePayout('${d.id}')" class="bg-green-600 p-1 rounded text-white">APPROVE</button>
                </div>`;
            });
        });
    },

    approvePayout: async (id) => {
        await updateDoc(doc(db, "withdrawals", id), { status: "Paid" });
        alert("Marked as Paid!");
    }
};
