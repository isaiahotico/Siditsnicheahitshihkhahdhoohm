
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

let user = null, uid = null, profileUid = null;
const AD_ZONES = ['10276123', '10337795', '10337853'];
const PROVERBS = [
    "Your habits define your future.", "Understanding yourself is wisdom.", "Small wins lead to big goals.",
    "Discipline is freedom.", "Empathy heals the world.", "Master your mind, master your life.",
    "Failure is just data.", "Consistency beats talent.", "Stay calm in the storm.", "Knowledge needs action.",
    "Choose long term over short term.", "Your reality is your perception.", "Gratitude doubles happiness.",
    "Focus is a superpower.", "Learn something new every day."
];

window.app = {
    toggleMenu: () => document.getElementById('sidebar').classList.toggle('open'),

    login: async () => {
        const name = document.getElementById('username').value.trim();
        if(!name) return;
        uid = name.toLowerCase().replace(/\s/g, '') + "_" + Math.floor(1000 + Math.random()*9000);
        
        const params = new URLSearchParams(window.location.search);
        const refBy = params.get('startapp') || null;

        await setDoc(doc(db, "users", uid), {
            name, id: uid, balance: 0, totalEarned: 0, adsWatched: 0,
            refBy, refCount: 0, refEarned: 0, lastSeen: Date.now()
        });

        if(refBy) await updateDoc(doc(db, "users", refBy), { refCount: increment(1) });

        user = name;
        document.getElementById('my-uid').innerText = `ACCOUNT ID: ${uid}`;
        document.getElementById('login-screen').classList.add('hidden');
        app.init();
    },

    init: () => {
        // Online Heartbeat
        setInterval(() => updateDoc(doc(db, "users", uid), { lastSeen: Date.now() }), 30000);

        // UI Listeners
        onSnapshot(doc(db, "users", uid), s => {
            const d = s.data();
            document.getElementById('m-balance').innerText = document.getElementById('balance').innerText = d.balance.toFixed(4);
            document.getElementById('ref-count').innerText = d.refCount;
            document.getElementById('ref-earn').innerText = d.refEarned.toFixed(2);
        });

        onSnapshot(query(collection(db, "users"), where("lastSeen", ">", Date.now() - 60000)), s => {
            document.getElementById('online-list').innerHTML = s.docs.map(d => `<div class="p-1 border-b border-black/5">🟢 ${d.data().name}</div>`).join('');
        });

        onSnapshot(query(collection(db, "chat"), orderBy("ts", "desc"), limit(25)), s => {
            const chat = document.getElementById('chat-messages');
            chat.innerHTML = s.docs.reverse().map(d => {
                const m = d.data();
                return `<div class="bg-white/40 p-4 rounded-2xl glass-card"><b class="cursor-pointer text-blue-800 underline" onclick="app.viewProfile('${m.uid}')">${m.name}:</b> ${m.text}</div>`;
            }).join('');
            chat.scrollTop = chat.scrollHeight;
        });

        onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(15)), s => {
            document.getElementById('leaderboard').innerHTML = s.docs.map((d, i) => {
                const u = d.data();
                return `<div class="p-5 glass-card flex justify-between cursor-pointer" onclick="app.viewProfile('${u.id}')">
                    <span>${i+1}. ${u.name}</span><b class="text-green-900">₱${u.totalEarned.toFixed(3)}</b>
                </div>`;
            }).join('');
        });

        onSnapshot(collection(db, "videos"), s => {
            document.getElementById('video-list').innerHTML = s.docs.map(d => {
                const v = d.data();
                return `<div class="glass-card p-4"><iframe width="100%" height="180" src="https://www.youtube.com/embed/${v.ytId}" class="rounded-lg"></iframe>
                <button onclick="app.claimVideo('${d.id}')" class="w-full btn-main mt-4 py-3 rounded-xl">WATCH & CLAIM ₱0.0001</button></div>`;
            }).join('');
        });

        onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid)), s => {
            document.getElementById('history-list').innerHTML = s.docs.map(d => {
                const w = d.data();
                return `<div class="p-3 glass-card flex justify-between text-xs mb-1"><span>₱${w.amt}</span><b class="${w.status === 'Paid' ? 'text-green-800' : 'text-orange-800'}">${w.status.toUpperCase()}</b></div>`;
            }).join('');
        });

        // Initialize Background Ads
        AD_ZONES.forEach(z => {
            if(window[`show_${z}`]) {
                window[`show_${z}`]({ type: 'inApp', inAppSettings: { frequency: 1, interval: 60 } });
                app.credit(0.0002, false);
            }
        });
    },

    watchAd: () => {
        document.getElementById('bg-layer').className = 'lagoon-bg';
        const z = AD_ZONES[Math.floor(Math.random() * 3)];
        const format = Math.random() > 0.5 ? 'pop' : '';
        
        window[`show_${z}`](format).then(() => {
            app.credit(0.0065, true);
            app.showProverb();
        }).catch(() => app.credit(0.0065, true));
        
        setTimeout(() => document.getElementById('bg-layer').className = 'gold-armor', 6000);
    },

    credit: async (amt, isAd) => {
        const uRef = doc(db, "users", uid);
        await updateDoc(uRef, { balance: increment(amt), totalEarned: increment(amt), adsWatched: isAd ? increment(1) : increment(0) });
        
        const snap = await getDoc(uRef);
        const refBy = snap.data().refBy;
        if(refBy) {
            const comm = amt * 0.08;
            await updateDoc(doc(db, "users", refBy), { balance: increment(comm), refEarned: increment(comm) });
        }
    },

    showProverb: () => {
        const p = document.getElementById('proverb-box');
        p.innerText = PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
        p.classList.remove('hidden');
        setTimeout(() => p.classList.add('hidden'), 5000);
    },

    viewProfile: async (id) => {
        profileUid = id;
        const d = (await getDoc(doc(db, "users", id))).data();
        document.getElementById('p-name').innerText = d.name;
        document.getElementById('p-ads').innerText = d.adsWatched || 0;
        document.getElementById('p-earned').innerText = d.totalEarned.toFixed(3);
        document.getElementById('profile-modal').classList.remove('hidden');
        
        onSnapshot(query(collection(db, "private_messages"), where("chatId", "in", [`${uid}_${id}`, `${id}_${uid}`]), orderBy("ts", "desc"), limit(10)), s => {
            document.getElementById('dm-box').innerHTML = s.docs.reverse().map(m => `<div><b>${m.data().fromName}:</b> ${m.data().text}</div>`).join('');
        });
    },

    sendDM: async () => {
        const txt = document.getElementById('dm-input').value;
        if(!txt) return;
        await addDoc(collection(db, "private_messages"), { chatId: `${uid}_${profileUid}`, from: uid, fromName: user, text: txt, ts: Date.now() });
        document.getElementById('dm-input').value = '';
    },

    closeProfile: () => document.getElementById('profile-modal').classList.add('hidden'),

    copyRef: () => {
        const link = `https://t.me/shihkhahdhoohm_bot/app?startapp=${uid}`;
        navigator.clipboard.writeText(link);
        alert("REFERRAL LINK COPIED TO CLIPBOARD!");
    },

    uploadVideo: async () => {
        const ytId = document.getElementById('yt-url').value.trim();
        if(!ytId) return;
        await addDoc(collection(db, "videos"), { ytId, owner: uid });
        document.getElementById('yt-url').value = '';
    },

    claimVideo: (id) => { app.credit(0.0001, false); alert("VIDEO TRADE REWARD CLAIMED!"); },

    sendChat: async () => {
        const txt = document.getElementById('chat-input').value;
        if(!txt) return;
        await addDoc(collection(db, "chat"), { uid, name: user, text: txt, ts: Date.now() });
        document.getElementById('chat-input').value = '';
    },

    withdraw: async () => {
        const amt = parseFloat(document.getElementById('withdraw-amt').value);
        const num = document.getElementById('gcash-num').value;
        if(amt < 0.02) return alert("MINIMUM PAYOUT IS 0.02 PESO");
        await addDoc(collection(db, "withdrawals"), { uid, name: user, amt, gcash: num, status: 'Pending', ts: Date.now() });
        await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
        alert("WITHDRAWAL REQUEST SENT TO OWNER!");
    },

    adminLogin: () => {
        if(document.getElementById('admin-pass').value === "Propetas12") {
            document.getElementById('admin-lock').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending")), s => {
                document.getElementById('admin-panel').innerHTML = s.docs.map(d => `<div class="p-4 glass-card flex justify-between items-center">
                <span><b>${d.data().name}</b><br>₱${d.data().amt} (${d.data().gcash})</span><button onclick="app.approve('${d.id}')" class="bg-green-600 text-white px-6 py-2 rounded-xl">APPROVE</button></div>`).join('');
            });
        }
    },

    approve: (id) => updateDoc(doc(db, "withdrawals", id), { status: 'Paid' }),

    switchTab: (id) => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        document.getElementById('tab-'+id).classList.add('active-tab');
        if(window.innerWidth < 768) app.toggleMenu();
    }
};
