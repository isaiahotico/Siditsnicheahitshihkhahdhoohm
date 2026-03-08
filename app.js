
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const tg = window.Telegram.WebApp;
tg.expand();

// Safe User ID initialization
const userId = tg.initDataUnsafe?.user?.id || "user_" + Math.random().toString(36).substr(2, 5);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;
let taskTimer = null;

const TASK_CONFIG = {
    watch:      { reward: 0.01,  time: 45 },
    sub:        { reward: 0.03,  time: 45 },
    like:       { reward: 0.01,  time: 30 },
    fb_follow:  { reward: 0.01,  time: 15 },
    site:       { reward: 0.01,  time: 20 }
};

// --- INITIALIZE ---
async function init() {
    try {
        document.getElementById('displayUsername').innerText = "@" + username;
        const snap = await db.ref('users/' + userId).once('value');
        if (snap.exists()) {
            userData = { ...userData, ...snap.val() };
        } else {
            userData.myRefCode = Math.random().toString(36).substr(2, 6).toUpperCase();
            await db.ref('users/' + userId).set(userData);
        }
        updateUI();
        loadLinks();
        checkPromoCost();
    } catch (e) {
        console.error("Init failed", e);
    }
}

function updateUI() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('myRefCodeDisp').innerText = userData.myRefCode;
    loadMyLinks();
}

// --- ADS LOGIC ---
function triggerAd() {
    try {
        if (Math.random() > 0.5) {
            if (window.AdController) new window.AdController('10555663').show();
        } else if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {});
        }
    } catch(e) {}
}

// --- TASKS ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    db.ref('links/' + currentTab).on('value', (snap) => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 opacity-20 text-xs font-bold uppercase'>No Tasks Available</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && (link.clicks > 0 || link.clicks === undefined)) {
                const div = document.createElement('div');
                div.className = "card-width bg-[#111114] p-5 rounded-[2rem] border border-white/5 shadow-lg";
                div.innerHTML = `
                    <p class="text-[9px] text-blue-500 font-black uppercase mb-1">${currentTab} • ₱${link.reward}</p>
                    <h3 class="text-sm font-bold text-gray-200 mb-4 line-clamp-2">${link.desc || 'No description provided.'}</h3>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" 
                            class="w-full bg-blue-600/10 text-blue-500 py-3 rounded-2xl font-black text-[10px] border border-blue-500/20 uppercase">Earn Now</button>`;
                container.appendChild(div);
            }
        });
    });
}

function startTask(id, url, time, reward) {
    triggerAd();
    activeTask = { id, url, time, reward };
    document.getElementById('timer-overlay').style.display = 'flex';
    document.getElementById('countdown-ui').classList.remove('hidden');
    document.getElementById('claim-ui').classList.add('hidden');
    
    const container = document.getElementById('video-container');
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = url.split('v=')[1] || url.split('/').pop();
        container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}?autoplay=1" frameborder="0"></iframe>`;
    } else {
        container.innerHTML = `<iframe width="100%" height="100%" src="${url}" frameborder="0" class="bg-white"></iframe>`;
    }

    let left = time;
    document.getElementById('seconds-left').innerText = left;
    
    if (taskTimer) clearInterval(taskTimer);
    taskTimer = setInterval(() => {
        left--;
        document.getElementById('seconds-left').innerText = left;
        if (left <= 0) {
            clearInterval(taskTimer);
            document.getElementById('countdown-ui').classList.add('hidden');
            document.getElementById('claim-ui').classList.remove('hidden');
        }
    }, 1000);
}

function closeTask() {
    clearInterval(taskTimer);
    document.getElementById('timer-overlay').style.display = 'none';
}

async function finishTask() {
    const { id, url, reward } = activeTask;
    userData.balance += reward;
    if (!userData.completedTasks) userData.completedTasks = {};
    userData.completedTasks[id] = true;

    await db.ref('users/' + userId).update({ balance: userData.balance, completedTasks: userData.completedTasks });
    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => c ? c - 1 : 0);

    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy + '/balance').transaction(b => (b || 0) + (reward * 0.20));
        db.ref('users/' + userData.referredBy + '/refEarned').transaction(e => (e || 0) + (reward * 0.20));
    }

    closeTask();
    window.location.href = url;
}

// --- LOGIC ---
function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = (m.style.display === 'flex' || m.style.display === 'block') ? 'none' : 'block';
}

function switchTab(t) {
    currentTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab', 'text-blue-500'));
    document.getElementById('tab-'+t).classList.add('active-tab', 'text-blue-500');
    loadLinks();
}

async function submitDeposit() {
    const amt = parseFloat(document.getElementById('depAmount').value);
    const ref = document.getElementById('depRef').value;
    if (!amt || !ref) return alert("Fill all fields");
    await db.ref('deposits/pending').push({ userId, username, amt, ref, time: Date.now() });
    alert("Deposit Submitted!");
    toggleModal('deposit-modal');
}

async function processLinkSubmission() {
    const type = document.getElementById('subType').value;
    const url = document.getElementById('subUrl').value;
    const desc = document.getElementById('subDesc').value;
    if (!url || !desc) return alert("Fill all fields");

    const userCount = userData.submissions?.[type] || 0;
    const cost = userCount < 5 ? 0 : 1.0;

    if (userData.balance < cost) return alert("Insufficient balance");

    await db.ref('links/' + type).push({ 
        url, desc, clicks: cost === 0 ? 50 : 100, reward: TASK_CONFIG[type].reward, time: TASK_CONFIG[type].time, owner: userId 
    });

    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = userCount + 1;
    await db.ref('users/' + userId).update(userData);
    toggleModal('submit-modal');
    updateUI();
}

function checkPromoCost() {
    const type = document.getElementById('subType').value;
    const userCount = userData.submissions?.[type] || 0;
    document.getElementById('promo-cost-info').innerText = userCount < 5 ? `FREE (${5-userCount} left)` : "COST: ₱1.00";
}

function loadMyLinks() {
    const cont = document.getElementById('my-links-container');
    db.ref('links').once('value', snap => {
        cont.innerHTML = "";
        snap.forEach(cat => {
            cat.forEach(l => {
                if (l.val().owner === userId) {
                    cont.innerHTML += `<div class="bg-white/5 p-4 rounded-2xl border border-white/5 text-[10px]">
                        <p class="font-black text-blue-400 uppercase">${cat.key}</p>
                        <p class="truncate opacity-50">${l.val().url}</p>
                        <p class="mt-2 font-bold text-green-500">Clicks Left: ${l.val().clicks || 0}</p>
                    </div>`;
                }
            });
        });
    });
}

function copyRef() {
    navigator.clipboard.writeText(userData.myRefCode);
    alert("Referral Code Copied!");
}

function copyAddress() {
    navigator.clipboard.writeText("TXTQeK9TyqnvUJsD2bqKv2BJTD1S1mChLs");
    alert("Address Copied!");
}

document.getElementById('subType').onchange = checkPromoCost;
init();
