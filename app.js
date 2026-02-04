
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

const user = tg.initDataUnsafe?.user || { id: 12345, first_name: "Local_User" };
const UID = `ID_${user.id}`;
let userData = {};

// 1. INITIALIZE USER & REFERRAL CODE
async function initUser() {
    const doc = await db.collection('users').doc(UID).get();
    if (!doc.exists) {
        // Generate 6-letter referral code
        const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialData = {
            name: user.first_name,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            refCode: refCode,
            referredBy: "", 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(UID).set(initialData);
        userData = initialData;
        // Prompt for referral code on first join
        const inviter = prompt("Enter Referral Code (Optional):");
        if (inviter && inviter.length === 6) {
            const inviterSnap = await db.collection('users').where('refCode', '==', inviter).get();
            if (!inviterSnap.empty) {
                await db.collection('users').doc(UID).update({ referredBy: inviterSnap.docs[0].id });
            }
        }
    } else {
        userData = doc.data();
    }
    document.getElementById('my-ref-code').innerText = userData.refCode;
    listenData();
}

// 2. REAL-TIME DATA LISTENERS
function listenData() {
    db.collection('users').doc(UID).onSnapshot(doc => {
        const d = doc.data();
        document.getElementById('bal').innerText = `₱${d.balance.toFixed(2)}`;
        document.getElementById('total-w').innerText = `₱${d.totalWithdrawn.toFixed(2)}`;
    });

    db.collection('withdrawals').where('uid', '==', UID).orderBy('timestamp', 'desc').onSnapshot(snap => {
        const box = document.getElementById('history-list');
        box.innerHTML = snap.empty ? "No records." : "";
        snap.forEach(doc => {
            const w = doc.data();
            box.innerHTML += `<div class="history-item">
                <b>₱${w.amount.toFixed(2)}</b> - ${w.status.toUpperCase()}<br>
                <small>${w.timestamp?.toDate().toLocaleString() || 'Pending...'}</small>
            </div>`;
        });
    });
}

// 3. MONETAG AD SYSTEM & COMMISSION
async function showAd(type) {
    try {
        if (type === 'reward') {
            await show_10276123();
            processReward(0.01);
        } else {
            await show_10276123('pop');
            processReward(0.01);
        }
    } catch (e) { tg.showAlert("Ad failed to load."); }
}

async function processReward(amt) {
    const batch = db.batch();
    const uRef = db.collection('users').doc(UID);
    
    batch.update(uRef, {
        balance: firebase.firestore.FieldValue.increment(amt),
        totalEarned: firebase.firestore.FieldValue.increment(amt)
    });

    // Referral Commission Logic (8%)
    if (userData.referredBy) {
        const refOwnerRef = db.collection('users').doc(userData.referredBy);
        batch.update(refOwnerRef, {
            balance: firebase.firestore.FieldValue.increment(amt * 0.08)
        });
    }
    await batch.commit();
    tg.showAlert("Success! +₱0.01");
}

// 4. WITHDRAWAL
async function withdraw() {
    const num = document.getElementById('gcash-num').value;
    const currentBal = (await db.collection('users').doc(UID).get()).data().balance;

    if (num.length < 10) return tg.showAlert("Enter GCash Number");
    if (currentBal < 0.02) return tg.showAlert("Min withdrawal ₱0.02");

    await db.collection('withdrawals').add({
        uid: UID,
        name: user.first_name,
        amount: currentBal,
        gcash: num,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('users').doc(UID).update({ balance: 0 });
    tg.showAlert("Withdrawal submitted!");
}

// 5. ADMIN LOGIC
function authAdmin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = "none";
        document.getElementById('admin-content').style.display = "block";
        loadAdmin();
    } else { alert("Access Denied"); }
}

function loadAdmin() {
    db.collection('withdrawals').where('status', '==', 'pending').onSnapshot(snap => {
        const div = document.getElementById('admin-pending');
        div.innerHTML = "";
        snap.forEach(doc => {
            const w = doc.data();
            div.innerHTML += `<div class="history-item">
                ${w.name} (${w.gcash}) - ₱${w.amount.toFixed(2)}
                <button onclick="approve('${doc.id}', '${w.uid}', ${w.amount})" style="float:right">Approve</button>
            </div>`;
        });
    });
}

async function approve(docId, userId, amount) {
    const batch = db.batch();
    batch.update(db.collection('withdrawals').doc(docId), { status: 'paid' });
    batch.update(db.collection('users').doc(userId), { 
        totalWithdrawn: firebase.firestore.FieldValue.increment(amount) 
    });
    await batch.commit();
}

// 6. CHAT & UI
function sendMsg() {
    const text = document.getElementById('chat-msg').value;
    if (!text) return;
    db.collection('messages').add({
        name: user.first_name, text, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('chat-msg').value = "";
}

db.collection('messages').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snap.docs.reverse().forEach(d => {
        box.innerHTML += `<div><b>${d.data().name}:</b> ${d.data().text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

function nav(page, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`p-${page}`).classList.add('active-page');
    el.classList.add('active');
}

function updateFooter() {
    const n = new Date();
    document.getElementById('f-date').innerText = n.toLocaleDateString();
    document.getElementById('f-time').innerText = n.toLocaleTimeString();
}

setInterval(updateFooter, 1000);
initUser();

// High CPM Monetag Auto-Ad Init
show_10276123({
    type: 'inApp',
    inAppSettings: { frequency: 3, capping: 0.05, interval: 20, timeout: 5, everyPage: false }
});
