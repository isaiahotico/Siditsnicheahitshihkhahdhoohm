
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

let currentUser = null;
let currentUserID = null;
const AD_ZONES = ['10276123', '10337795', '10337853'];

window.app = {
    login: async () => {
        const name = document.getElementById('username').value.trim();
        if(!name) return alert("Enter a name!");
        
        currentUserID = name.toLowerCase().replace(/\s/g, '_') + "_" + Math.floor(1000 + Math.random() * 9000);
        currentUser = name;
        
        const userRef = doc(db, "users", currentUserID);
        await setDoc(userRef, { 
            name, 
            balance: 0, 
            totalEarned: 0, 
            adsWatched: 0,
            isAdmin: false,
            id: currentUserID
        });

        document.getElementById('user-display').innerText = name;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
        app.initListeners();
        app.autoShowInApp();
    },

    initListeners: () => {
        // Balance & Stats
        onSnapshot(doc(db, "users", currentUserID), (s) => {
            const data = s.data();
            if(data) document.getElementById('balance').innerText = data.balance.toFixed(4);
        });

        // Chat
        onSnapshot(query(collection(db, "chat"), orderBy("ts", "desc"), limit(30)), (s) => {
            const chatBox = document.getElementById('chat-messages');
            chatBox.innerHTML = '';
            s.docs.reverse().forEach(d => {
                const m = d.data();
                chatBox.innerHTML += `
                    <div class="glass p-2 rounded-lg bg-white/10">
                        <span class="text-blue-800 cursor-pointer underline" onclick="app.viewProfile('${m.uid}')">@${m.name}</span>: 
                        <span class="font-normal">${m.text}</span>
                    </div>`;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        // Rank
        onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(15)), (s) => {
            const lb = document.getElementById('leaderboard');
            lb.innerHTML = '';
            let rank = 1;
            s.forEach(d => {
                const u = d.data();
                lb.innerHTML += `
                    <div class="flex justify-between items-center p-3 glass mb-2 cursor-pointer" onclick="app.viewProfile('${u.id}')">
                        <span>#${rank++} ${u.name}</span>
                        <span class="text-green-900 font-black">₱${u.totalEarned.toFixed(3)}</span>
                    </div>`;
            });
        });

        // Withdrawal History
        onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", currentUserID)), (s) => {
            const hist = document.getElementById('history-list');
            hist.innerHTML = '';
            s.forEach(d => {
                const w = d.data();
                hist.innerHTML += `<div class="p-2 glass text-xs flex justify-between">
                    <span>₱${w.amount} to GCash</span>
                    <span class="font-black">${w.status}</span>
                </div>`;
            });
        });
    },

    // PROFILE SYSTEM
    viewProfile: async (uid) => {
        const snap = await getDoc(doc(db, "users", uid));
        if(!snap.exists()) return;
        const u = snap.data();
        document.getElementById('p-name').innerText = u.name;
        document.getElementById('p-ads').innerText = u.adsWatched || 0;
        document.getElementById('p-total').innerText = u.totalEarned.toFixed(4);
        document.getElementById('p-bal').innerText = u.balance.toFixed(4);
        document.getElementById('p-msg-btn').onclick = () => {
            app.switchTab('chat');
            document.getElementById('chat-input').value = `@${u.name} `;
            app.closeProfile();
        };
        document.getElementById('profile-modal').classList.remove('hidden');
    },

    openMyProfile: () => app.viewProfile(currentUserID),
    closeProfile: () => document.getElementById('profile-modal').classList.add('hidden'),

    // ADS & REWARDS
    watchMainAd: () => {
        const bg = document.getElementById('bg-layer');
        bg.className = 'lagoon-bg';
        
        const zone = AD_ZONES[Math.floor(Math.random() * AD_ZONES.length)];
        const format = Math.random() > 0.5 ? 'pop' : ''; 
        const adFunc = window[`show_${zone}`];

        if(adFunc) {
            adFunc(format).then(() => {
                app.credit(0.0065, true);
            }).catch(e => {
                console.error("Ad error", e);
                // Credit anyway for testing if adblock is present, remove this in production
                app.credit(0.0065, true); 
            });
        }
        setTimeout(() => bg.className = 'gold-armor', 4000);
    },

    credit: async (amt, isMainAd) => {
        const userRef = doc(db, "users", currentUserID);
        await updateDoc(userRef, {
            balance: increment(amt),
            totalEarned: increment(amt),
            adsWatched: isMainAd ? increment(1) : increment(0)
        });
        if(isMainAd) alert(`Congrats! You earned ₱${amt}`);
    },

    autoShowInApp: () => {
        AD_ZONES.forEach(zone => {
            if(window[`show_${zone}`]) {
                window[`show_${zone}`]({ type: 'inApp', inAppSettings: { frequency: 2, interval: 30 } });
                app.credit(0.0002, false);
            }
        });
    },

    // WALLET
    requestWithdraw: async () => {
        const amt = parseFloat(document.getElementById('withdraw-amount').value);
        const gcash = document.getElementById('gcash-num').value;
        const userRef = doc(db, "users", currentUserID);
        const uData = (await getDoc(userRef)).data();

        if(amt < 0.02 || amt > uData.balance) return alert("Invalid amount or insufficient balance");
        if(gcash.length < 10) return alert("Enter valid GCash number");

        await addDoc(collection(db, "withdrawals"), {
            uid: currentUserID,
            name: currentUser,
            amount: amt,
            gcash: gcash,
            status: "Pending",
            ts: Date.now()
        });
        await updateDoc(userRef, { balance: increment(-amt) });
        alert("Withdrawal Pending Approval!");
    },

    // ADMIN
    unlockAdmin: () => {
        if(document.getElementById('admin-pass').value === "Propetas12") {
            document.getElementById('admin-lock').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            app.initAdmin();
        }
    },

    initAdmin: () => {
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending")), (s) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = '';
            s.forEach(d => {
                const w = d.data();
                list.innerHTML += `
                    <div class="glass p-3 flex justify-between items-center bg-red-100">
                        <span class="text-[10px]">${w.name}<br>${w.gcash}<br>₱${w.amount}</span>
                        <button onclick="app.approve('${d.id}')" class="bg-green-600 text-white p-2 rounded text-xs">PAID</button>
                    </div>`;
            });
        });
    },

    approve: async (id) => {
        await updateDoc(doc(db, "withdrawals", id), { status: "Paid" });
        alert("Marked as Paid!");
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if(!input.value) return;
        await addDoc(collection(db, "chat"), {
            uid: currentUserID,
            name: currentUser,
            text: input.value,
            ts: Date.now()
        });
        input.value = '';
    },

    switchTab: (id) => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        document.getElementById('tab-' + id).classList.add('active-tab');
    }
};
