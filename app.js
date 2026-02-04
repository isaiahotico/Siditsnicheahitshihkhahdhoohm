
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || { id: 1001, first_name: "TestUser" };
const UID = `U_${user.id}`;
let localData = {};

// 1. INITIALIZE & SYNC
async function initApp() {
    const doc = await db.collection('users').doc(UID).get();
    if (!doc.exists) {
        const myCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newUser = {
            name: user.first_name, balance: 0, totalWithdrawn: 0,
            barriers: 0, refCode: myCode, referredBy: "",
            friendsCount: 0, refEarnings: 0
        };
        await db.collection('users').doc(UID).set(newUser);
    }

    // Real-time Sync
    db.collection('users').doc(UID).onSnapshot(s => {
        localData = s.data();
        document.getElementById('u-bal').innerText = `₱${localData.balance.toFixed(2)}`;
        document.getElementById('u-withdrawn').innerText = `₱${localData.totalWithdrawn.toFixed(2)}`;
        document.getElementById('u-barriers').innerText = localData.barriers;
        document.getElementById('u-friends').innerText = localData.friendsCount;
        document.getElementById('u-ref-earn').innerText = `₱${localData.refEarnings.toFixed(4)}`;
        document.getElementById('u-mycode').innerText = localData.refCode;
    });

    // Immediate Withdrawal Sync
    db.collection('withdrawals').where('uid', '==', UID).orderBy('timestamp', 'desc').onSnapshot(snap => {
        const list = document.getElementById('history-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const w = d.data();
            list.innerHTML += `
                <div class="history-card">
                    <div>₱${w.amount.toFixed(2)}<br><small>${w.gcash}</small></div>
                    <span class="status-${w.status}">${w.status.toUpperCase()}</span>
                </div>`;
        });
    });

    // Online Status
    setInterval(() => db.collection('online_status').doc(UID).set({ t: Date.now() }), 10000);
    db.collection('online_status').onSnapshot(snap => {
        let count = 0; const now = Date.now();
        snap.forEach(d => { if (now - d.data().t < 30000) count++; });
        document.getElementById('online-count').innerText = `● ${count} Online`;
    });
}

// 2. REFERRAL LOGIC
async function applyRef() {
    const code = document.getElementById('ref-input').value.toUpperCase();
    if (code === localData.refCode) return alert("Cannot use own code");
    
    const refSnap = await db.collection('users').where('refCode', '==', code).get();
    if (!refSnap.empty) {
        const inviterId = refSnap.docs[0].id;
        await db.collection('users').doc(UID).update({ referredBy: inviterId });
        await db.collection('users').doc(inviterId).update({ 
            friendsCount: firebase.firestore.FieldValue.increment(1) 
        });
        alert("Referral Applied!");
    } else { alert("Invalid Code"); }
}

// 3. ADS & REWARD (8% Ref Commission)
function watchAd(type) {
    const adAction = type === 'reward' ? show_10276123() : show_10276123('pop');
    adAction.then(() => processReward(0.01)).catch(() => alert("Ad not ready"));
}

async function processReward(amt) {
    const batch = db.batch();
    batch.update(db.collection('users').doc(UID), { 
        balance: firebase.firestore.FieldValue.increment(amt) 
    });
    if (localData.referredBy) {
        const commission = amt * 0.08;
        batch.update(db.collection('users').doc(localData.referredBy), {
            balance: firebase.firestore.FieldValue.increment(commission),
            refEarnings: firebase.firestore.FieldValue.increment(commission)
        });
    }
    await batch.commit();
}

// 4. DASHJAM GAME (2000 barriers = ₱1.00)
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let gameActive = false, score = 0, birdY = 75;

function startGame() {
    if (!gameActive) { gameActive = true; score = 0; birdY = 75; gameLoop(); }
    else { birdY -= 30; } // Jump
}

function gameLoop() {
    if (!gameActive) return;
    ctx.clearRect(0,0,320,150);
    birdY += 2; // Gravity
    ctx.fillStyle = "#00f2fe";
    ctx.fillRect(50, birdY, 15, 15); // Player
    score++;
    document.getElementById('u-barriers').innerText = localData.barriers + score;
    
    if (birdY > 150 || birdY < 0) { 
        gameActive = false; 
        saveScore(score); 
    } else { requestAnimationFrame(gameLoop); }
}

async function saveScore(s) {
    const barrierReward = (s / 2000);
    await db.collection('users').doc(UID).update({
        barriers: firebase.firestore.FieldValue.increment(s),
        balance: firebase.firestore.FieldValue.increment(barrierReward)
    });
    tg.showAlert(`Game Over! Barriers: ${s} (Reward: ₱${barrierReward.toFixed(4)})`);
}

// 5. WITHDRAWAL & ADMIN
function withdraw() {
    const num = document.getElementById('gcash-num').value;
    if (num.length < 10 || localData.balance < 0.02) return alert("Invalid data");
    db.collection('withdrawals').add({
        uid: UID, name: user.first_name, amount: localData.balance,
        gcash: num, status: 'pending', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    db.collection('users').doc(UID).update({ balance: 0 });
}

function checkAdmin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = "none";
        document.getElementById('admin-content').style.display = "block";
        db.collection('withdrawals').where('status', '==', 'pending').onSnapshot(snap => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            snap.forEach(d => {
                const w = d.data();
                list.innerHTML += `<div class="history-card">
                    ${w.name} - ₱${w.amount.toFixed(2)} (${w.gcash})
                    <button onclick="approve('${d.id}','${w.uid}',${w.amount})">PAID</button>
                </div>`;
            });
        });
    }
}

async function approve(did, uid, amt) {
    const batch = db.batch();
    batch.update(db.collection('withdrawals').doc(did), { status: 'paid' });
    batch.update(db.collection('users').doc(uid), { totalWithdrawn: firebase.firestore.FieldValue.increment(amt) });
    await batch.commit();
}

// UI HELPERS
function nav(p, el) {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
    document.querySelectorAll('.nav-item').forEach(nv => nv.classList.remove('active'));
    document.getElementById(`p-${p}`).classList.add('active-page');
    el.classList.add('active');
}

function sendMsg() {
    const text = document.getElementById('chat-in').value;
    if (text) {
        db.collection('messages').add({ name: user.first_name, text, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('chat-in').value = "";
    }
}

db.collection('messages').orderBy('timestamp', 'desc').limit(15).onSnapshot(snap => {
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    snap.docs.reverse().forEach(d => {
        box.innerHTML += `<div><small style="color:var(--secondary)">${d.data().name}:</small> ${d.data().text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

setInterval(() => {
    const d = new Date();
    document.getElementById('f-date').innerText = d.toLocaleDateString();
    document.getElementById('f-time').innerText = d.toLocaleTimeString();
}, 1000);

initApp();
show_10276123({ type: 'inApp', inAppSettings: { frequency: 4, capping: 0.1, interval: 30, timeout: 5 } });
