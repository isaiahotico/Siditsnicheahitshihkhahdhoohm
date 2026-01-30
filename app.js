
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
let uid = null;
let profileUid = null; // Currently viewed profile
const AD_ZONES = ['10276123', '10337795', '10337853'];
const PROVERBS = [
    "Your brain is like a muscle; exercise it with hard work.",
    "Small consistent steps lead to giant transformations.",
    "Focus on the solution, not the problem.",
    "Your habits define your destiny; choose them wisely.",
    "The way you do one thing is the way you do everything.",
    "Empathy is the bridge between human souls.",
    "Success is 80% psychology and 20% skill.",
    "Calmness is a superpower in a chaotic world.",
    "Self-discipline is the highest form of self-love.",
    "A growth mindset turns every failure into a lesson.",
    "Comparison is the thief of joy; compete only with yourself.",
    "Knowledge is potential power; action is real power.",
    "Your thoughts create your reality; think big.",
    "Persistence beats resistance every time.",
    "The secret to getting ahead is simply getting started."
];

window.app = {
    login: async () => {
        const name = document.getElementById('username').value.trim();
        if(!name) return;
        
        uid = name.toLowerCase().replace(/\s/g, '_') + "_" + Math.floor(Math.random()*900);
        
        // Handle Referrals from Telegram URL
        const urlParams = new URLSearchParams(window.location.search);
        const refBy = urlParams.get('start') || urlParams.get('tgWebAppStartParam') || null;

        const userRef = doc(db, "users", uid);
        await setDoc(userRef, { 
            name, balance: 0, totalEarned: 0, adsWatched: 0, 
            refBy, refCount: 0, refEarned: 0, lastSeen: Date.now(), id: uid 
        });

        if(refBy) {
            const rRef = doc(db, "users", refBy);
            const rSnap = await getDoc(rRef);
            if(rSnap.exists()) {
                await updateDoc(rRef, { refCount: increment(1) });
            }
        }

        user = name;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
        app.startApp();
    },

    startApp: () => {
        // Heartbeat
        setInterval(() => updateDoc(doc(db, "users", uid), { lastSeen: Date.now() }), 30000);

        // Listeners
        onSnapshot(doc(db, "users", uid), s => {
            const d = s.data();
            document.getElementById('balance').innerText = d.balance.toFixed(4);
            document.getElementById('ref-count').innerText = d.refCount;
            document.getElementById('ref-earn').innerText = d.refEarned.toFixed(2);
        });

        onSnapshot(query(collection(db, "users"), where("lastSeen", ">", Date.now() - 60000)), s => {
            const list = document.getElementById('online-list');
            list.innerHTML = '';
            s.forEach(d => list.innerHTML += `<div class="p-1 glass mb-1 text-xs">🟢 ${d.data().name}</div>`);
        });

        onSnapshot(query(collection(db, "chat"), orderBy("ts", "desc"), limit(20)), s => {
            const box = document.getElementById('chat-messages');
            box.innerHTML = '';
            s.docs.reverse().forEach(d => {
                const m = d.data();
                box.innerHTML += `<div class="text-sm">
                    <b class="text-blue-800 cursor-pointer" onclick="app.viewProfile('${m.uid}')">${m.name}:</b> ${m.text}
                </div>`;
            });
            box.scrollTop = box.scrollHeight;
        });

        onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10)), s => {
            const lb = document.getElementById('leaderboard');
            lb.innerHTML = '';
            let r = 1;
            s.forEach(d => {
                lb.innerHTML += `<div class="p-2 glass flex justify-between cursor-pointer" onclick="app.viewProfile('${d.id}')">
                    <span>${r++}. ${d.data().name}</span><span>₱${d.data().totalEarned.toFixed(2)}</span>
                </div>`;
            });
        });

        onSnapshot(query(collection(db, "videos")), s => {
            const vl = document.getElementById('video-list');
            vl.innerHTML = '';
            s.forEach(d => {
                const v = d.data();
                vl.innerHTML += `<div class="glass p-2">
                    <iframe width="100%" height="150" src="https://www.youtube.com/embed/${v.ytId}"></iframe>
                    <button onclick="app.claimVideo('${d.id}')" class="w-full bg-blue-600 text-white mt-2 py-1 rounded text-xs">Watch & Claim 0.0001</button>
                </div>`;
            });
        });

        onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid)), s => {
            const h = document.getElementById('my-withdrawals');
            h.innerHTML = '';
            s.forEach(d => {
                const w = d.data();
                h.innerHTML += `<div class="glass p-2 text-[10px] flex justify-between"><span>₱${w.amt}</span><b>${w.status}</b></div>`;
            });
        });

        // Trigger Auto InApp
        AD_ZONES.forEach(z => {
            if(window[`show_${z}`]) {
                window[`show_${z}`]({ type: 'inApp', inAppSettings: { frequency: 2, interval: 30 } });
                app.credit(0.0002, false);
            }
        });
    },

    watchAd: () => {
        const bg = document.getElementById('bg-layer');
        bg.className = 'lagoon-bg';
        
        const zone = AD_ZONES[Math.floor(Math.random() * 3)];
        const format = Math.random() > 0.5 ? 'pop' : '';
        
        window[`show_${zone}`](format).then(() => {
            app.credit(0.0065, true);
            app.showProverb();
        }).catch(() => {
            app.credit(0.0065, true); // Crediting fallback
        });

        setTimeout(() => bg.className = 'gold-armor', 5000);
    },

    showProverb: () => {
        const box = document.getElementById('proverb-box');
        box.innerText = PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
        box.classList.remove('hidden');
        setTimeout(() => box.classList.add('hidden'), 5000);
    },

    credit: async (amt, isAd) => {
        const uRef = doc(db, "users", uid);
        await updateDoc(uRef, { balance: increment(amt), totalEarned: increment(amt), adsWatched: isAd ? increment(1) : increment(0) });
        
        const uSnap = await getDoc(uRef);
        const refBy = uSnap.data().refBy;
        if(refBy) {
            const comm = amt * 0.08;
            await updateDoc(doc(db, "users", refBy), { balance: increment(comm), refEarned: increment(comm) });
        }
    },

    viewProfile: async (id) => {
        profileUid = id;
        const s = await getDoc(doc(db, "users", id));
        const d = s.data();
        document.getElementById('p-name').innerText = d.name;
        document.getElementById('p-ads').innerText = d.adsWatched || 0;
        document.getElementById('p-total').innerText = d.totalEarned.toFixed(2);
        document.getElementById('p-refs').innerText = d.refCount || 0;
        document.getElementById('profile-modal').classList.remove('hidden');
        app.loadDMs(id);
    },

    loadDMs: (id) => {
        onSnapshot(query(collection(db, "private_messages"), where("chatId", "in", [`${uid}_${id}`, `${id}_${uid}`]), orderBy("ts", "desc"), limit(10)), s => {
            const box = document.getElementById('dm-box');
            box.innerHTML = '';
            s.docs.reverse().forEach(d => {
                const m = d.data();
                box.innerHTML += `<div><b>${m.fromName}:</b> ${m.text}</div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    sendDM: async () => {
        const txt = document.getElementById('dm-input').value;
        if(!txt) return;
        await addDoc(collection(db, "private_messages"), {
            chatId: `${uid}_${profileUid}`,
            from: uid, fromName: user, to: profileUid,
            text: txt, ts: Date.now()
        });
        document.getElementById('dm-input').value = '';
    },

    closeProfile: () => document.getElementById('profile-modal').classList.add('hidden'),

    copyRef: () => {
        const link = `https://t.me/shihkhahdhoohm_bot/app?startapp=${uid}`;
        navigator.clipboard.writeText(link);
        alert("Referral link copied!");
    },

    uploadVideo: async () => {
        const ytId = document.getElementById('yt-url').value;
        if(!ytId) return;
        await addDoc(collection(db, "videos"), { ytId, owner: uid, views: 0 });
        document.getElementById('yt-url').value = '';
    },

    claimVideo: async (vid) => {
        await updateDoc(doc(db, "videos", vid), { views: increment(1) });
        app.credit(0.0001, false);
        alert("Video reward claimed!");
    },

    sendChat: async () => {
        const txt = document.getElementById('chat-input').value;
        if(!txt) return;
        await addDoc(collection(db, "chat"), { uid, name: user, text: txt, ts: Date.now() });
        document.getElementById('chat-input').value = '';
    },

    withdraw: async () => {
        const amt = parseFloat(document.getElementById('withdraw-amt').value);
        const gcash = document.getElementById('gcash-num').value;
        if(amt < 0.02) return alert("Min. 0.02");
        await addDoc(collection(db, "withdrawals"), { uid, name: user, amt, gcash, status: 'Pending', ts: Date.now() });
        await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
        alert("Withdrawal submitted!");
    },

    adminLogin: () => {
        if(document.getElementById('admin-pass').value === "Propetas12") {
            document.getElementById('admin-panel').classList.remove('hidden');
            onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending")), s => {
                const box = document.getElementById('admin-payouts');
                box.innerHTML = '';
                s.forEach(d => {
                    const w = d.data();
                    box.innerHTML += `<div class="p-2 glass text-xs flex justify-between">
                        <span>${w.name} (₱${w.amt}) - ${w.gcash}</span>
                        <button onclick="app.approvePayout('${d.id}')" class="bg-green-600 text-white px-2 rounded">Paid</button>
                    </div>`;
                });
            });
        }
    },

    approvePayout: async (id) => {
        await updateDoc(doc(db, "withdrawals", id), { status: 'Paid' });
    },

    switchTab: (id) => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        document.getElementById('tab-' + id).classList.add('active-tab');
    }
};
