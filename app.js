
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

// TASK MASTER CONFIG
const CONFIG = {
    yt_watch:   { label: "YT Watch", reward: 0.01, time: 45, free: 100, paid: 120, cost: 1, key: 'u_yt_w' },
    yt_sub:     { label: "YT Sub", reward: 0.03, time: 45, free: 50, paid: 60, cost: 1, key: 'u_yt_s' },
    yt_like:    { label: "YT Like", reward: 0.01, time: 30, free: 100, paid: 120, cost: 1, key: 'u_yt_l' },
    yt_comm:    { label: "YT Comm", reward: 0.01, time: 30, free: 100, paid: 120, cost: 1, key: 'u_yt_c' },
    fb_follow:  { label: "FB Follow", reward: 0.01, time: 30, free: 100, paid: 120, cost: 1, key: 'u_fb_f' },
    fb_like:    { label: "FB Like Post", reward: 0.01, time: 20, free: 100, paid: 120, cost: 1, key: 'u_fb_l' },
    fb_comm:    { label: "FB Comm Post", reward: 0.01, time: 30, free: 100, paid: 120, cost: 1, key: 'u_fb_c' },
    web_visit:  { label: "Visit Site", reward: 0.01, time: 15, free: 100, paid: 120, cost: 1, key: 'u_web' },
    playstore:  { label: "Playstore", reward: 0.015, time: 20, free: 100, paid: 120, cost: 1, key: 'u_ps' },
    admin_any:  { label: "Admin Promo", reward: 0.03, time: 20, free: 10000, paid: 10000, cost: 0, key: 'admin' }
};

const user = tg.initDataUnsafe?.user || { id: "dev_test", username: "Guest" };
let userData = {};
let curCat = 'yt_watch';
let activeTimer = null;
let ytPlayer = null;

// SYNC USER & REFERRAL
onValue(ref(db, 'users/' + user.id), async (s) => {
    userData = s.val() || {
        balance: 0, 
        completed: {}, 
        refCode: generateRefCode(),
        refEarned: 0,
        refCount: 0,
        referredBy: null
    };
    if (!s.exists()) await set(ref(db, 'users/' + user.id), userData);
    
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('tgUser').innerText = `@${user.username}`;
    document.getElementById('myRefCode').innerText = userData.refCode;
    document.getElementById('refCount').innerText = userData.refCount || 0;
    document.getElementById('refEarned').innerText = (userData.refEarned || 0).toFixed(2);
    renderAllTasks();
});

// GENERATE 12-LETTER REF CODE
function generateRefCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// NAVIGATION
const tabs = { tabTasks: 'viewTasks', tabPromote: 'viewPromote', tabReferral: 'viewReferral', tabProfile: 'viewProfile' };
Object.keys(tabs).forEach(id => {
    document.getElementById(id).onclick = () => {
        Object.values(tabs).forEach(v => document.getElementById(v).classList.add('hidden'));
        Object.keys(tabs).forEach(t => { document.getElementById(t).classList.add('text-slate-500'); document.getElementById(t).classList.remove('tab-active'); });
        document.getElementById(tabs[id]).classList.remove('hidden');
        document.getElementById(id).classList.add('tab-active');
        document.getElementById(id).classList.remove('text-slate-500');
        if(id === 'tabPromote') renderMyLinks();
    };
});

window.setCat = (c) => {
    curCat = c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('cat-active', b.innerText.toLowerCase().includes(c.split('_')[1] || 'watch')));
    const s = CONFIG[c];
    document.getElementById('promoTitle').innerText = `Add ${s.label}`;
    document.getElementById('limitInfo').innerText = `${Math.max(0, 5-(userData[s.key] || 0))} FREE SLOTS LEFT`;
};

// SHOW ADS (EVERY CLICK)
function triggerAds() {
    const chance = Math.random();
    if (chance > 0.5 && window.Adsgram) {
        window.Adsgram.init({ blockId: "24438" }).show().catch(() => window.show_10555663?.());
    } else {
        window.show_10555663?.();
    }
}

// RENDER ALL TASKS
function renderAllTasks() {
    const cont = document.getElementById('allTasksContainer');
    onValue(ref(db, 'queue'), (snap) => {
        cont.innerHTML = "";
        snap.forEach(catSnap => {
            const catKey = catSnap.key;
            catSnap.forEach(taskSnap => {
                const item = taskSnap.val();
                if (userData.completed?.[taskSnap.key] || item.rem <= 0) return;
                const div = document.createElement('div');
                div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between";
                div.innerHTML = `<div><p class="text-[9px] text-blue-400 font-bold uppercase">@${item.owner}</p><p class="text-xs font-black">${CONFIG[catKey].label}</p></div>
                <button onclick="startAction('${catKey}', '${taskSnap.key}', '${item.vid || item.url}')" class="bg-red-600 text-[10px] font-black px-6 py-2 rounded-xl">START</button>`;
                cont.appendChild(div);
            });
        });
    });
}

// EXECUTION
window.startAction = (cat, key, target) => {
    triggerAds(); // Every 1 click shows ads
    const s = CONFIG[cat];
    let time = s.time;
    const page = document.getElementById('executionPage');
    const timer = document.getElementById('timerDisplay');
    page.style.display = 'flex';
    timer.innerText = time;
    document.getElementById('taskActionLabel').innerText = s.label;
    document.getElementById('taskRewardLabel').innerText = `₱${s.reward}`;

    ['playerBox', 'webBox', 'socialBox'].forEach(i => document.getElementById(i).classList.add('hidden'));

    if (cat.startsWith('yt')) {
        document.getElementById('playerBox').classList.remove('hidden');
        if (!ytPlayer) {
            ytPlayer = new YT.Player('player', {
                videoId: target, height: '100%', width: '100%', playerVars: {autoplay:1, controls:0},
                events: { onStateChange: (e) => { if(e.data === 1) runTimer(); else stopTimer(); }}
            });
        } else { ytPlayer.loadVideoById(target); }
    } else if (cat === 'web_visit') {
        document.getElementById('webBox').classList.remove('hidden');
        document.getElementById('webFrame').src = target;
        runTimer();
    } else {
        document.getElementById('socialBox').classList.remove('hidden');
        tg.openLink(target);
        runTimer();
    }

    function runTimer() {
        if(activeTimer) return;
        activeTimer = setInterval(() => {
            time--;
            timer.innerText = time;
            if(time <= 0) finish(cat, key, target);
        }, 1000);
    }
    function stopTimer() { clearInterval(activeTimer); activeTimer = null; }
};

async function finish(cat, key, target) {
    clearInterval(activeTimer); activeTimer = null;
    const s = CONFIG[cat];

    // 1. Reward User
    await update(ref(db, 'users/' + user.id), {
        balance: increment(s.reward),
        [`completed/${key}`]: true
    });

    // 2. Referral Commission (20%)
    if (userData.referredBy) {
        const commission = s.reward * 0.20;
        await update(ref(db, 'users/' + userData.referredBy), {
            balance: increment(commission),
            refEarned: increment(commission)
        });
    }

    // 3. Decrement Queue
    const tRef = ref(db, `queue/${cat}/${key}`);
    const snap = await get(tRef);
    if(snap.exists()){
        const rem = snap.val().rem - 1;
        if(rem <= 0) await set(tRef, null);
        else await update(tRef, { rem: rem });
    }

    if(cat.startsWith('yt')) tg.openLink(`https://youtube.com/watch?v=${target}`);
    document.getElementById('executionPage').style.display = 'none';
}

// PROMOTE LOGIC
document.getElementById('submitPromo').onclick = async () => {
    const val = document.getElementById('linkInput').value;
    if(!val) return;
    const s = CONFIG[curCat];
    const used = userData[s.key] || 0;
    let cost = (used >= 5) ? s.cost : 0;
    let limit = (used >= 5) ? s.paid : s.free;

    if(userData.balance < cost) return alert("Insufficient balance.");

    const data = { owner: user.username, ownerId: user.id, rem: limit, ts: Date.now() };
    if(curCat.startsWith('yt')) {
        const vid = val.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|)([\w-]{11})/)?.[1];
        if(!vid) return alert("Invalid YT link");
        data.vid = vid;
    } else { data.url = val; }

    await push(ref(db, `queue/${curCat}`), data);
    await update(ref(db, 'users/' + user.id), {
        balance: increment(-cost),
        [s.key]: increment(cost === 0 ? 1 : 0)
    });
    document.getElementById('linkInput').value = "";
    alert("Promotion Added!");
};

// CLAIM REFERRAL
document.getElementById('btnClaimRef').onclick = async () => {
    const code = document.getElementById('inputRefCode').value.trim();
    if(userData.referredBy) return alert("Already referred!");
    if(code === userData.refCode) return alert("Can't refer yourself!");

    const usersRef = ref(db, 'users');
    const snap = await get(usersRef);
    let foundId = null;
    snap.forEach(u => { if(u.val().refCode === code) foundId = u.key; });

    if(foundId) {
        await update(ref(db, 'users/' + user.id), { referredBy: foundId });
        await update(ref(db, 'users/' + foundId), { refCount: increment(1) });
        alert("Referral claimed!");
    } else {
        alert("Invalid code!");
    }
};

window.promptAdmin = () => { if(prompt("Pass:") === "Propetas12") setCat('admin_any'); };

function renderMyLinks() {
    const cont = document.getElementById('myLinksContainer');
    cont.innerHTML = "";
    get(ref(db, 'queue')).then(snap => {
        snap.forEach(catSnap => {
            catSnap.forEach(t => {
                if(t.val().ownerId === user.id) {
                    const div = document.createElement('div');
                    div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between";
                    div.innerHTML = `<span class="text-xs">${CONFIG[catSnap.key].label}</span><span class="text-green-500 font-bold">${t.val().rem} LEFT</span>`;
                    cont.appendChild(div);
                }
            });
        });
    });
}
