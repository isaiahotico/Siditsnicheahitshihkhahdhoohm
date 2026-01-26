
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const fb = initializeApp(firebaseConfig);
const db = getDatabase(fb);

let user = null;
let uid = localStorage.getItem('ph_gold_cp_uid');

const app = {
    init: async () => {
        if (!uid) {
            document.getElementById('login-screen').classList.remove('hidden');
        } else {
            const snap = await get(ref(db, `users/${uid}`));
            if (snap.exists()) {
                user = snap.val();
                app.checkResets();
                app.launch();
            } else {
                localStorage.removeItem('ph_gold_cp_uid');
                location.reload();
            }
        }
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        if (name.length < 3 || gcash.length < 10) return alert("Invalid inputs!");

        uid = 'U' + Math.floor(Math.random() * 9000000);
        user = {
            uid, username: name, gcash, balance: 0, chatPoints: 0,
            totalAds: 0, dailyAds: 0, weeklyAds: 0, dailyEarnings: 0, pendingBonus: 0,
            hourlyTurbo: 0, hourlyPremium: 0, lastHour: Date.now(),
            dailyDate: new Date().toDateString(), weeklyId: app.getWeek(),
            referredBy: null, lastLBClaim: ""
        };
        await set(ref(db, `users/${uid}`), user);
        localStorage.setItem('ph_gold_cp_uid', uid);
        app.launch();
    },

    getWeek: () => {
        const d = new Date();
        const start = new Date(d.getFullYear(), 0, 1);
        return `${d.getFullYear()}-W${Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7)}`;
    },

    checkResets: async () => {
        const today = new Date().toDateString();
        const now = Date.now();
        const updates = {};
        
        if (user.dailyDate !== today) {
            updates[`users/${uid}/dailyAds`] = 0;
            updates[`users/${uid}/dailyEarnings`] = 0;
            updates[`users/${uid}/dailyDate`] = today;
        }
        if (now - (user.lastHour || 0) > 3600000) {
            updates[`users/${uid}/hourlyTurbo`] = 0;
            updates[`users/${uid}/hourlyPremium`] = 0;
            updates[`users/${uid}/lastHour`] = now;
        }
        if (Object.keys(updates).length > 0) await update(ref(db), updates);
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        app.sync();
        app.presence();
        app.nav('home');
    },

    sync: () => {
        onValue(ref(db, `users/${uid}`), s => {
            user = s.val();
            if (!user) return;
            document.getElementById('u-name').innerText = user.username;
            document.getElementById('u-balance').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('u-cp').innerText = user.chatPoints || 0;
            document.getElementById('chat-bal-display').innerText = `₱${user.balance.toFixed(2)}`;
            document.getElementById('chat-cp-display').innerText = user.chatPoints || 0;
            document.getElementById('st-d').innerText = user.dailyAds || 0;
            document.getElementById('st-e').innerText = `₱${(user.dailyEarnings || 0).toFixed(2)}`;
            document.getElementById('p-name').innerText = user.username;
            document.getElementById('p-gcash').innerText = user.gcash;
            document.getElementById('p-bal-large').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('p-bonus').innerText = `₱${(user.pendingBonus || 0).toFixed(4)}`;
            
            const isWeek = user.weeklyId === app.getWeek();
            document.getElementById('lb-progress').innerText = `${isWeek ? (user.weeklyAds || 0) : 0} / 10000`;
        });
    },

    // ADS
    playTurbo: async () => {
        if (app.cd.turbo > 0) return;
        if ((user.hourlyTurbo || 0) >= 40) return alert("Hourly Limit (40 CP) reached!");
        try {
            await show_10276123('pop');
            await show_10337795('pop');
            await show_10337853('pop');
            app.grantPoint('turbo', 1);
            app.startCD('turbo', 60);
        } catch (e) {}
    },

    playPremium: async () => {
        if (app.cd.premium > 0) return;
        if ((user.hourlyPremium || 0) >= 45) return alert("Hourly Limit (45 CP) reached!");
        try {
            await show_10276123('pop');
            app.grantPoint('premium', 1);
            app.startCD('premium', 50);
        } catch (e) {}
    },

    grantPoint: async (type, points) => {
        const w = app.getWeek();
        const updates = {};
        updates[`users/${uid}/chatPoints`] = (user.chatPoints || 0) + points;
        updates[`users/${uid}/totalAds`] = (user.totalAds || 0) + 1;
        updates[`users/${uid}/dailyAds`] = (user.dailyAds || 0) + 1;
        updates[`users/${uid}/weeklyAds`] = (user.weeklyId === w ? user.weeklyAds : 0) + 1;
        if (type === 'turbo') updates[`users/${uid}/hourlyTurbo`] = (user.hourlyTurbo || 0) + 1;
        if (type === 'premium') updates[`users/${uid}/hourlyPremium`] = (user.hourlyPremium || 0) + 1;
        await update(ref(db), updates);
    },

    cd: { turbo: 0, premium: 0, chat: 0 },
    startCD: (t, s) => {
        app.cd[t] = s;
        const box = document.getElementById(`box-${t}`);
        const timer = document.getElementById(`timer-${t}`);
        if(box) box.classList.add('hidden-el');
        if(timer) timer.classList.remove('hidden-el');

        const itv = setInterval(() => {
            app.cd[t]--;
            if(timer) timer.querySelector('.cd-val').innerText = app.cd[t] + 's';
            if(t === 'chat') document.getElementById('chat-cd-label').innerText = `NEXT MSG IN: ${app.cd[t]}s`;
            if (app.cd[t] <= 0) {
                clearInterval(itv);
                if(box) box.classList.remove('hidden-el');
                if(timer) timer.classList.add('hidden-el');
                if(t === 'chat') document.getElementById('chat-cd-label').innerText = "";
            }
        }, 1000);
    },

    // CHAT
    sendChatMessage: async () => {
        const msg = document.getElementById('chat-input').value.trim();
        if(!msg) return;
        if(app.cd.chat > 0) return;
        if((user.chatPoints || 0) < 1) return alert("You need 1 Chat Point! Watch Ads.");

        const reward = 0.0102;
        await push(ref(db, 'messages'), { u: user.username, t: msg, uid, time: serverTimestamp() });
        document.getElementById('chat-input').value = "";
        
        const updates = {};
        updates[`users/${uid}/chatPoints`] = user.chatPoints - 1;
        updates[`users/${uid}/balance`] = (user.balance || 0) + reward;
        updates[`users/${uid}/dailyEarnings`] = (user.dailyEarnings || 0) + reward;
        
        if (user.referredBy) {
            const rSnap = await get(ref(db, `users/${user.referredBy}`));
            if (rSnap.exists()) {
                updates[`users/${user.referredBy}/pendingBonus`] = (rSnap.val().pendingBonus || 0) + (reward * 0.08);
            }
        }
        await update(ref(db), updates);
        app.startCD('chat', 52);
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(40)), s => {
            const box = document.getElementById('chat-box'); box.innerHTML = "";
            s.forEach(c => {
                const m = c.val();
                const isMe = m.uid === uid;
                box.innerHTML += `<div class="flex ${isMe?'justify-end':''}"><div class="p-3 rounded-2xl max-w-[85%] text-sm ${isMe?'bg-yellow-500 text-black font-bold':'bg-slate-800 text-slate-200'}"><b>${m.u}</b><br>${m.t}</div></div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    // WITHDRAW
    requestWithdrawal: async () => {
        if(user.balance < 1) return alert("Minimum ₱1.00");
        const now = new Date();
        const payout = {
            uid, name: user.username, gcash: user.gcash, amount: user.balance, status: 'pending',
            date: now.toLocaleDateString(), time: now.toLocaleTimeString(), timestamp: serverTimestamp()
        };
        await push(ref(db, 'withdrawals'), payout);
        await update(ref(db, `users/${uid}`), { balance: 0 });
        alert("GCash Request Sent!");
    },

    // ADMIN
    loadAdmin: () => {
        const p = prompt("Admin Key:");
        if(p !== "Propetas12") return app.nav('home');
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('admin-list'); list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.status === 'pending') {
                    list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center text-[10px]">
                        <div><b>${w.name}</b> (${w.gcash})<br>₱${w.amount.toFixed(2)}<br>${w.date} ${w.time}</div>
                        <button onclick="app.approvePayout('${c.key}')" class="bg-green-600 px-4 py-2 rounded-lg font-bold">PAID</button>
                    </div>`;
                }
            });
        });
    },

    approvePayout: (k) => update(ref(db, `withdrawals/${k}`), { status: 'paid' }),

    // OTHERS
    syncReferral: async () => {
        const code = document.getElementById('ref-input').value.trim();
        if(!code || code === user.username) return alert("Invalid Username");
        const snap = await get(ref(db, 'users'));
        let found = null;
        snap.forEach(c => { if(c.val().username === code) found = c.key; });
        if(found) {
            await update(ref(db, `users/${uid}`), { referredBy: found });
            alert("Referral Synced!");
        } else { alert("User not found."); }
    },

    claimBonus: async () => {
        if (!user.pendingBonus || user.pendingBonus <= 0) return;
        await update(ref(db, `users/${uid}`), { balance: user.balance + user.pendingBonus, pendingBonus: 0 });
        alert("Commission Claimed!");
    },

    loadLB: () => {
        onValue(query(ref(db, 'users'), orderByChild('dailyEarnings'), limitToLast(10)), s => {
            const list = document.getElementById('lb-daily'); list.innerHTML = "";
            let data = []; s.forEach(c => data.push(c.val()));
            data.reverse().forEach((u, i) => {
                list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center text-xs"><span>#${i+1} ${u.username}</span><span class="text-green-500 font-black">₱${u.dailyEarnings.toFixed(2)}</span></div>`;
            });
        });
    },

    loadHistory: () => {
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('hist-list'); list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.uid === uid) {
                    list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center">
                        <div><p class="font-black text-yellow-500">₱${w.amount.toFixed(2)}</p><p class="text-[9px] text-slate-500">${w.date} ${w.time}</p></div>
                        <span class="text-[9px] font-black uppercase ${w.status==='paid'?'text-green-500':'text-yellow-600'}">${w.status}</span>
                    </div>`;
                }
            });
        });
    },

    presence: () => {
        const pRef = ref(db, `presence/${uid}`);
        set(pRef, { username: user.username, last_online: serverTimestamp() });
        onDisconnect(pRef).remove();
        onValue(ref(db, 'presence'), s => {
            document.getElementById('online-count').innerText = `${s.size} Members Online`;
            const list = document.getElementById('online-list'); if(list) {
                list.innerHTML = "";
                s.forEach(c => { list.innerHTML += `<div class="gold-card p-2 rounded-lg text-center text-[10px] text-green-500">${c.val().username}</div>`; });
            }
        });
    },

    nav: (id) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden-el'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${id}`).classList.remove('hidden-el');
        if(id === 'chat') app.loadChat();
        if(id === 'leaderboard') app.loadLB();
        if(id === 'history') app.loadHistory();
        if(id === 'admin') app.loadAdmin();
    },

    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none'
};

window.app = app;
app.init();
