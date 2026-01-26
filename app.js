
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
let uid = localStorage.getItem('ph_v4_pro_uid');

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
                localStorage.removeItem('ph_v4_pro_uid');
                location.reload();
            }
        }
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        if (name.length < 3 || gcash.length < 10) return alert("Invalid inputs!");

        uid = 'U' + Math.floor(Math.random() * 999999);
        user = {
            uid, username: name, gcash, balance: 0, chatPoints: 0,
            totalEarnings: 0, dailyEarnings: 0,
            dailyDate: new Date().toDateString()
        };
        await set(ref(db, `users/${uid}`), user);
        localStorage.setItem('ph_v4_pro_uid', uid);
        app.launch();
    },

    checkResets: async () => {
        const today = new Date().toDateString();
        if (user.dailyDate !== today) {
            await update(ref(db, `users/${uid}`), { dailyEarnings: 0, dailyDate: today });
        }
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
            document.getElementById('p-name').innerText = user.username;
            document.getElementById('p-gcash').innerText = user.gcash;
            document.getElementById('p-total-earn').innerText = `₱${(user.totalEarnings || 0).toFixed(4)}`;
        });
    },

    // AD ENGINE
    playBonusAd: async () => {
        if (app.cd.bonus > 0) return;
        try {
            // Combined 3 Ads
            await show_10276123('pop');
            await show_10337795('pop');
            await show_10337853('pop');
            await update(ref(db, `users/${uid}`), { chatPoints: (user.chatPoints || 0) + 1 });
            app.startCD('bonus', 60);
        } catch (e) { alert("Ad failed to load."); }
    },

    cd: { bonus: 0, chat: 0 },
    startCD: (t, s) => {
        app.cd[t] = s;
        const box = document.getElementById(`box-${t}`);
        const timer = document.getElementById(`timer-${t}`);
        if(box) box.classList.add('hidden-el');
        if(timer) timer.classList.remove('hidden-el');

        const itv = setInterval(() => {
            app.cd[t]--;
            if(timer) timer.querySelector('.cd-val').innerText = app.cd[t] + 's';
            if(t === 'chat') document.getElementById('chat-cd-label').innerText = `Next rewarded msg in: ${app.cd[t]}s`;
            if (app.cd[t] <= 0) {
                clearInterval(itv);
                if(box) box.classList.remove('hidden-el');
                if(timer) timer.classList.add('hidden-el');
                if(t === 'chat') document.getElementById('chat-cd-label').innerText = "";
            }
        }, 1000);
    },

    // CHAT & EARN
    sendChatMessage: async () => {
        const msg = document.getElementById('chat-input').value.trim();
        if(!msg || app.cd.chat > 0) return;
        if((user.chatPoints || 0) < 1) return alert("You need 1 Chat Point!");

        try {
            await show_10276123('pop'); // 1 Random Ad Gate
            await push(ref(db, 'messages'), { u: user.username, t: msg, uid, time: serverTimestamp() });
            document.getElementById('chat-input').value = "";
            
            const reward = 0.018;
            await update(ref(db, `users/${uid}`), {
                chatPoints: user.chatPoints - 1,
                balance: (user.balance || 0) + reward,
                dailyEarnings: (user.dailyEarnings || 0) + reward,
                totalEarnings: (user.totalEarnings || 0) + reward
            });
            app.startCD('chat', 92);
        } catch (e) {}
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(30)), s => {
            const box = document.getElementById('chat-box'); box.innerHTML = "";
            s.forEach(c => {
                const m = c.val();
                const isMe = m.uid === uid;
                box.innerHTML += `<div class="flex ${isMe?'justify-end':''}"><div class="p-3 rounded-2xl max-w-[85%] text-sm ${isMe?'bg-yellow-500 text-black font-bold':'bg-slate-800 text-slate-200'}">
                    <b class="cursor-pointer" onclick="app.viewUserProfile('${m.uid}')">${m.u}</b><br>${m.t}</div></div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    // RANK (Every Second Real-time Sync)
    loadRank: () => {
        onValue(query(ref(db, 'users'), orderByChild('dailyEarnings'), limitToLast(20)), s => {
            const list = document.getElementById('rank-list'); list.innerHTML = "";
            let items = [];
            s.forEach(c => { items.push(c.val()); });
            items.reverse().forEach((u, i) => {
                list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center text-xs">
                    <span class="font-bold cursor-pointer" onclick="app.viewUserProfile('${u.uid}')">#${i+1} ${u.username}</span>
                    <span class="text-green-500 font-black">₱${u.dailyEarnings.toFixed(2)}</span>
                </div>`;
            });
        });
    },

    // FORUM
    submitPost: async () => {
        const t = document.getElementById('post-title').value;
        const b = document.getElementById('post-body').value;
        if(!t || !b) return;
        await push(ref(db, 'forum'), { title: t, body: b, author: user.username, authorUid: uid, time: serverTimestamp() });
        app.closeModal('modal-post');
    },

    loadForum: () => {
        onValue(ref(db, 'forum'), s => {
            const list = document.getElementById('forum-list'); list.innerHTML = "";
            s.forEach(c => {
                const f = c.val();
                list.innerHTML += `<div class="gold-card p-5 rounded-2xl">
                    <h4 class="font-black text-yellow-500 uppercase italic">${f.title}</h4>
                    <p class="text-[10px] text-slate-500 mb-2">By ${f.author}</p>
                    <p class="text-xs text-slate-300 mb-4">${f.body}</p>
                    <div id="comments-${c.key}" class="space-y-2 mb-4 pl-4 border-l border-yellow-500/20"></div>
                    <div class="flex gap-2">
                        <input id="in-${c.key}" placeholder="Reply..." class="flex-1 bg-slate-950 p-2 rounded-lg text-[10px] outline-none">
                        <button onclick="app.postReply('${c.key}')" class="gold-btn px-4 rounded-lg text-[9px]">REPLY</button>
                    </div>
                </div>`;
                app.loadReplies(c.key);
            });
        });
    },

    postReply: (fid) => {
        const txt = document.getElementById(`in-${fid}`).value;
        if(!txt) return;
        push(ref(db, `forum/${fid}/replies`), { u: user.username, t: txt });
        document.getElementById(`in-${fid}`).value = "";
    },

    loadReplies: (fid) => {
        onValue(ref(db, `forum/${fid}/replies`), s => {
            const box = document.getElementById(`comments-${fid}`); box.innerHTML = "";
            s.forEach(c => { box.innerHTML += `<p class="text-[9px] text-slate-400"><b>${c.val().u}:</b> ${c.val().t}</p>`; });
        });
    },

    // WITHDRAW & ADMIN
    withdraw: async () => {
        if(user.balance < 1) return alert("Minimum ₱1.00");
        const req = {
            uid, name: user.username, gcash: user.gcash, amount: user.balance, status: 'pending',
            timestamp: serverTimestamp(), timeStr: new Date().toLocaleString()
        };
        await push(ref(db, 'withdrawals'), req);
        await update(ref(db, `users/${uid}`), { balance: 0 });
        alert("Request logged!");
    },

    loadHistory: () => {
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('hist-list'); list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.uid === uid) {
                    list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center text-xs">
                        <div><p class="font-bold text-yellow-500">₱${w.amount.toFixed(2)}</p><p class="text-[8px] text-slate-500">${w.timeStr}</p></div>
                        <span class="font-black uppercase ${w.status==='paid'?'text-green-500':'text-yellow-600'}">${w.status}</span>
                    </div>`;
                }
            });
        });
    },

    loadAdmin: () => {
        const pass = prompt("Owner Pass:");
        if(pass !== "Propetas12") return app.nav('home');
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('admin-payout-list'); list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.status === 'pending') {
                    list.innerHTML += `<div class="gold-card p-4 rounded-xl flex justify-between items-center text-[10px]">
                        <div><b>${w.name}</b> (${w.gcash})<br>₱${w.amount.toFixed(2)}<br>${w.timeStr}</div>
                        <button onclick="app.approvePayout('${c.key}')" class="bg-green-600 px-3 py-2 rounded font-bold">APPROVE</button>
                    </div>`;
                }
            });
        });
    },

    approvePayout: (k) => update(ref(db, `withdrawals/${k}`), { status: 'paid' }),

    // PRESENCE & VIEW PROFILE
    presence: () => {
        const pRef = ref(db, `presence/${uid}`);
        set(pRef, { username: user.username, last_online: serverTimestamp(), uid });
        onDisconnect(pRef).remove();
        onValue(ref(db, 'presence'), s => {
            const list = document.getElementById('online-list'); list.innerHTML = "";
            let count = 0;
            s.forEach(c => {
                count++;
                list.innerHTML += `<div onclick="app.viewUserProfile('${c.val().uid}')" class="bg-slate-900 p-2 rounded-lg text-center text-[10px] text-green-500 cursor-pointer border border-green-500/10">${c.val().username}</div>`;
            });
            document.getElementById('online-indicator').innerText = `● ${count} Online`;
        });
    },

    viewUserProfile: async (vuid) => {
        const snap = await get(ref(db, `users/${vuid}`));
        const pres = await get(ref(db, `presence/${vuid}`));
        if(!snap.exists()) return;
        const u = snap.val();
        document.getElementById('view-u-name').innerText = u.username;
        document.getElementById('view-u-daily').innerText = `₱${(u.dailyEarnings || 0).toFixed(4)}`;
        document.getElementById('view-u-status').innerText = pres.exists() ? "Online Now" : "Offline";
        app.openModal('modal-view-profile');
    },

    nav: (id) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden-el'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${id}`).classList.remove('hidden-el');
        if(id === 'chat') app.loadChat();
        if(id === 'rank') app.loadRank();
        if(id === 'forum') app.loadForum();
        if(id === 'history') app.loadHistory();
        if(id === 'admin') app.loadAdmin();
    },

    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none'
};

window.app = app;
app.init();
