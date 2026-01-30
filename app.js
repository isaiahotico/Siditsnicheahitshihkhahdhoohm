
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, increment, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

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
let userID = null;
const PROVERBS = [
    "The only way to do great work is to love what you do.",
    "Understanding the mind is the first step to freedom.",
    "Your habits define your future. Watch them closely.",
    "The brain is a muscle; keep it active with new challenges.",
    "Happiness is not a destination, it is a method of life.",
    "Empathy is the ultimate form of intelligence.",
    "Small gains every day lead to massive results.",
    "Don't fear failure; fear being in the same place next year.",
    "Knowledge is power, but application is mastery.",
    "Your perception creates your reality.",
    "Consistency beats talent when talent doesn't work hard.",
    "The strongest mind is the one that stays calm in a storm.",
    "Listen more than you speak; that's where wisdom hides.",
    "Discipline is choosing between what you want now and what you want most.",
    "A growth mindset turns every obstacle into a lesson."
];

window.app = {
    login: async () => {
        const name = document.getElementById('username').value.trim();
        if(!name) return;
        
        userID = name.toLowerCase().replace(/\s/g, '_');
        const urlParams = new URLSearchParams(window.location.search);
        const refBy = urlParams.get('ref') || null;

        const userRef = doc(db, "users", userID);
        const snap = await getDoc(userRef);

        if(!snap.exists()) {
            await setDoc(userRef, { 
                name, id: userID, balance: 0, totalEarned: 0, 
                refBy, refCount: 0, refEarned: 0, lastSeen: Date.now() 
            });
            if(refBy) {
                await updateDoc(doc(db, "users", refBy), { refCount: increment(1) });
            }
        }
        
        user = name;
        document.getElementById('my-name').innerText = name;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
        app.init();
    },

    init: () => {
        // Online Heartbeat
        setInterval(() => {
            updateDoc(doc(db, "users", userID), { lastSeen: Date.now() });
        }, 30000);

        // Listeners
        onSnapshot(doc(db, "users", userID), s => {
            const d = s.data();
            document.getElementById('balance').innerText = d.balance.toFixed(4);
            document.getElementById('ref-count').innerText = d.refCount;
            document.getElementById('ref-earn').innerText = d.refEarned.toFixed(2);
        });

        onSnapshot(query(collection(db, "users"), where("lastSeen", ">", Date.now() - 60000)), s => {
            const list = document.getElementById('online-list');
            list.innerHTML = '';
            s.forEach(d => list.innerHTML += `<div>🟢 ${d.data().name}</div>`);
        });

        onSnapshot(query(collection(db, "chat"), orderBy("ts", "desc"), limit(20)), s => {
            const box = document.getElementById('chat-messages');
            box.innerHTML = '';
            s.docs.reverse().forEach(d => {
                const m = d.data();
                box.innerHTML += `<div class="p-1"><b>${m.name}:</b> ${m.text}</div>`;
            });
            box.scrollTop = box.scrollHeight;
        });

        onSnapshot(query(collection(db, "videos"), limit(10)), s => {
            const vList = document.getElementById('video-list');
            vList.innerHTML = '';
            s.forEach(d => {
                const v = d.data();
                vList.innerHTML += `
                    <div class="glass p-2">
                        <iframe width="100%" height="150" src="https://www.youtube.com/embed/${v.ytId}" frameborder="0"></iframe>
                        <div class="flex justify-between mt-1 text-xs">
                            <span>Views: ${v.views}</span>
                            <button onclick="app.claimVideo('${d.id}')" class="bg-blue-500 px-2 rounded text-white">Watch & Claim 0.0001</button>
                        </div>
                    </div>`;
            });
        });

        onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10)), s => {
            const lb = document.getElementById('leaderboard');
            lb.innerHTML = '';
            let r = 1;
            s.forEach(d => {
                lb.innerHTML += `<div class="p-2 glass mb-1 flex justify-between"><span>${r++}. ${d.data().name}</span><span>₱${d.data().totalEarned.toFixed(2)}</span></div>`;
            });
        });

        app.autoAds();
    },

    autoAds: () => {
        ['10276123', '10337795', '10337853'].forEach(z => {
            if(window[`show_${z}`]) {
                window[`show_${z}`]({ type: 'inApp', inAppSettings: { frequency: 2, interval: 30 } });
                app.credit(0.0002, false);
            }
        });
    },

    watchMainAd: () => {
        document.getElementById('bg-layer').className = 'lagoon-bg';
        const zones = ['10276123', '10337795', '10337853'];
        const z = zones[Math.floor(Math.random()*3)];
        
        window[`show_${z}`]('pop').then(() => {
            app.credit(0.0065, true);
            app.showProverb();
        }).catch(() => { app.credit(0.0065, true); });

        setTimeout(() => document.getElementById('bg-layer').className = 'gold-armor', 5000);
    },

    showProverb: () => {
        const box = document.getElementById('proverb-box');
        box.innerText = PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
        box.classList.remove('hidden');
        setTimeout(() => box.classList.add('hidden'), 6000);
    },

    credit: async (amt, isMain) => {
        const uRef = doc(db, "users", userID);
        await updateDoc(uRef, { balance: increment(amt), totalEarned: increment(amt) });
        
        // Referral Commission (8%)
        const snap = await getDoc(uRef);
        const refBy = snap.data().refBy;
        if(refBy) {
            const comm = amt * 0.08;
            await updateDoc(doc(db, "users", refBy), { balance: increment(comm), refEarned: increment(comm) });
        }
        if(isMain) alert("Earned: ₱" + amt);
    },

    copyRefLink: () => {
        const link = `https://t.me/YourBotName?start=${userID}`;
        navigator.clipboard.writeText(link);
        alert("Copied: " + link);
    },

    postVideo: async () => {
        const ytId = document.getElementById('yt-link').value;
        if(!ytId) return;
        await addDoc(collection(db, "videos"), { ytId, views: 0, owner: userID });
        document.getElementById('yt-link').value = '';
    },

    claimVideo: async (vid) => {
        await updateDoc(doc(db, "videos", vid), { views: increment(1) });
        app.credit(0.0001, false);
        alert("Reward Claimed!");
    },

    sendMessage: async () => {
        const txt = document.getElementById('chat-input').value;
        if(!txt) return;
        await addDoc(collection(db, "chat"), { name: user, text: txt, ts: Date.now() });
        document.getElementById('chat-input').value = '';
    },

    switchTab: (t) => {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
        document.getElementById('tab-'+t).classList.add('active-tab');
    },

    withdraw: async () => {
        const amt = parseFloat(document.getElementById('withdraw-amt').value);
        const gcash = document.getElementById('gcash-num').value;
        if(amt < 0.02) return alert("Min 0.02");
        await addDoc(collection(db, "withdrawals"), { uid: userID, name: user, amt, gcash, status: 'Pending' });
        await updateDoc(doc(db, "users", userID), { balance: increment(-amt) });
        alert("Request Sent");
    },

    adminAuth: () => {
        if(document.getElementById('admin-pass').value === "Propetas12") {
            document.getElementById('admin-reqs').classList.remove('hidden');
            onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending")), s => {
                const d = document.getElementById('admin-reqs');
                d.innerHTML = '';
                s.forEach(req => {
                    d.innerHTML += `<div class="p-2 glass text-xs">${req.data().name}: ₱${req.data().amt} <button onclick="app.approve('${req.id}')" class="bg-green-600 px-1 rounded">Paid</button></div>`;
                });
            });
        }
    },
    approve: async (id) => {
        await updateDoc(doc(db, "withdrawals", id), { status: 'Paid' });
    }
};
