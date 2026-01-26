
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// Realtime Database Imports
import { getDatabase, ref, set, onValue, push, update, increment, get as rtdbGet } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Firestore Imports
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app", // Realtime DB URL
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);     // Firebase Realtime Database instance
const firestore = getFirestore(app); // Firebase Firestore instance

const tg = window.Telegram.WebApp;
tg.expand();

const uid = tg.initDataUnsafe?.user?.id || "dev_" + Math.floor(Math.random()*999);
const myUsername = tg.initDataUnsafe?.user?.username || "Guest_" + uid;

let balance = 0, chatPoints = 0, unclaimed = 0;

// Sync User Data from Realtime Database
onValue(ref(rtdb, 'users/' + uid), (snap) => {
    const data = snap.val();
    if (!data) {
        set(ref(rtdb, 'users/' + uid), { username: myUsername, balance: 0, chatPoints: 0, unclaimedBonus: 0, referredBy: null });
        set(ref(rtdb, 'usernames/' + myUsername), uid);
    } else {
        balance = data.balance || 0;
        chatPoints = data.chatPoints || 0;
        unclaimed = data.unclaimedBonus || 0;
        document.getElementById('balance').innerText = balance.toFixed(4);
        document.getElementById('pts').innerText = chatPoints;
        document.getElementById('unclaimed-bal').innerText = unclaimed.toFixed(4);
        if (data.referredBy) document.getElementById('ref-setup').innerHTML = `<p class="text-xs text-green-400">Linked to Referrer: @${data.referredBy}</p>`;
    }
});
document.getElementById('my-username').innerText = myUsername;

// Ads Logic with 8% Commission (Realtime DB)
async function reward(amt, isPt = false) {
    if (isPt) {
        update(ref(rtdb, 'users/' + uid), { chatPoints: increment(1) });
        showPop("1 Chat Point");
    } else {
        update(ref(rtdb, 'users/' + uid), { balance: increment(amt) });
        showPop(`₱${amt.toFixed(4)}`);
        
        // Referral 8% Commission
        const uSnap = await rtdbGet(ref(rtdb, 'users/' + uid));
        const refName = uSnap.val()?.referredBy;
        if (refName) {
            const refUidSnap = await rtdbGet(ref(rtdb, 'usernames/' + refName));
            const refUid = refUidSnap.val();
            if (refUid) update(ref(rtdb, 'users/' + refUid), { unclaimedBonus: increment(amt * 0.08) });
        }
    }
}

window.runAd = (type) => {
    const b = document.getElementById('btn-'+type); b.disabled = true;
    if (type === 'normal') {
        show_10276123().then(() => { reward(0.0102); startCd(type, 180); });
    } else if (type === 'turbo') {
        show_10276123().then(() => show_10276123().then(() => { reward(0.0120); startCd(type, 45); }));
    } else if (type === 'points') {
        show_10276123().then(() => show_10276123().then(() => show_10276123().then(() => { reward(0, true); startCd(type, 300); })));
    }
};

function startCd(t, s) {
    const lbl = document.getElementById('t-'+t); let rem = s;
    const itv = setInterval(() => {
        lbl.innerText = `Wait: ${rem--}s`;
        if (rem < 0) { clearInterval(itv); document.getElementById('btn-'+t).disabled = false; lbl.innerText = "Ready!"; }
    }, 1000);
}

// Referral Manual Input Logic (Realtime DB)
window.submitReferral = async () => {
    const input = document.getElementById('ref-input').value.trim().replace('@','');
    if (!input || input === myUsername) return tg.showAlert("Invalid Username");
    
    const refUidSnap = await rtdbGet(ref(rtdb, 'usernames/' + input));
    if (!refUidSnap.exists()) return tg.showAlert("User not found in app");

    update(ref(rtdb, 'users/' + uid), { referredBy: input });
    tg.showAlert("Referrer Linked Successfully!");
};

window.claimBonus = () => {
    if (unclaimed <= 0) return tg.showAlert("No bonus to claim");
    update(ref(rtdb, 'users/' + uid), { balance: increment(unclaimed), unclaimedBonus: 0 });
    tg.showAlert("Bonus moved to Main Balance!");
};

// Chat (Realtime DB) - (Note: Chat logic was not provided in last prompt, retaining previous version for completeness)
window.sendChat = () => {
    const inp = document.getElementById('chat-in');
    if (!inp.value.trim() || chatPoints < 1) return tg.showAlert("Need 1 Chat Point");
    update(ref(rtdb, 'users/' + uid), { chatPoints: increment(-1), balance: increment(0.02) });
    push(ref(rtdb, 'chat'), { u: myUsername, m: inp.value, t: Date.now() });
    inp.value = "";
};

// Wallet & History (Firestore)
const gcashNameInput = document.getElementById('gcashName');
const gcashNumberInput = document.getElementById('gcashNumber');
const withdrawAmountInput = document.getElementById('withdrawAmount');

window.requestWithdraw = async () => {
    const name = gcashNameInput.value.trim();
    const number = gcashNumberInput.value.trim();
    const amount = Number(withdrawAmountInput.value);

    if (!name || !number || amount <= 0 || amount > balance) {
        tg.showAlert("Fill all fields correctly or check balance.");
        return;
    }
    if (number.length < 10) {
        tg.showAlert("Invalid GCash Number.");
        return;
    }

    // Deduct from Realtime DB balance first
    await update(ref(rtdb, 'users/' + uid), { balance: increment(-amount) });

    await addDoc(collection(firestore, "withdrawals"), {
        uid: uid,
        username: myUsername,
        name: name,
        number: number,
        amount: amount,
        status: "PENDING",
        createdAt: Date.now()
    });

    tg.showAlert("⏳ Withdrawal requested");
    // Clear inputs after successful request
    gcashNameInput.value = "";
    gcashNumberInput.value = "";
    withdrawAmountInput.value = "";
};

function loadHistory() {
    const withdrawTable = document.getElementById('withdrawTable');
    onSnapshot(
        query(collection(firestore, "withdrawals"), where("uid", "==", uid), orderBy("createdAt", "desc")),
        (snap) => {
            withdrawTable.innerHTML = "";
            snap.forEach(docu => {
                const d = docu.data();
                withdrawTable.innerHTML += `
                    <tr>
                        <td>${new Date(d.createdAt).toLocaleString()}</td>
                        <td>${d.number}</td>
                        <td>₱${d.amount.toFixed(2)}</td>
                        <td class="${d.status.toLowerCase()}">${d.status}</td>
                    </tr>
                `;
            });
        }
    );
}

// Admin Panel (Firestore)
const adminPassInput = document.getElementById('adminPass');
const adminPanelDiv = document.getElementById('adminPanel');

window.openAdmin = () => {
    if (adminPassInput.value !== "Propetas6") { // Updated password
        tg.showAlert("Wrong password");
        return;
    }
    document.getElementById('admin-gate').classList.add('hidden'); // Hide password input
    adminPanelDiv.classList.remove('hidden'); // Show admin panel
    loadAdmin();
};

function loadAdmin() {
    const adminWithdrawTable = document.getElementById('adminWithdrawTable');
    onSnapshot(
        query(collection(firestore, "withdrawals"), orderBy("createdAt", "desc")),
        (snap) => {
            adminWithdrawTable.innerHTML = "";
            snap.forEach(docu => {
                const d = docu.data();
                adminWithdrawTable.innerHTML += `
                    <tr>
                        <td>${d.username}</td>
                        <td>${d.number}</td>
                        <td>₱${d.amount.toFixed(2)}</td>
                        <td class="${d.status.toLowerCase()}">${d.status}</td>
                        <td>
                            ${d.status === "PENDING" ? `
                                <button onclick="updateStatus('${docu.id}','APPROVED')" class="bg-green-600 px-2 py-1 rounded text-xs">✅</button>
                                <button onclick="updateStatus('${docu.id}','REJECTED')" class="bg-red-600 px-2 py-1 rounded text-xs ml-1">❌</button>
                            ` : '—'}
                        </td>
                    </tr>
                `;
            });
        }
    );
}

window.updateStatus = async (docId, newStatus) => {
    await updateDoc(doc(firestore, "withdrawals", docId), { status: newStatus });
    tg.showAlert(`Withdrawal ${docId} ${newStatus}`);
};


// UI Extras
window.tab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('n-'+id).classList.add('active');
    if (id === 'wallet') loadHistory();
    // No chat load for this version, as chat UI was trimmed from the prompt.
};
window.showPop = (t) => { document.getElementById('pop-amt').innerText = t; document.getElementById('reward-pop').style.display='block'; };
window.closePop = () => document.getElementById('reward-pop').style.display='none';

// Background
const dWrap = document.getElementById('diamonds');
for(let i=0; i<12; i++){
    const d = document.createElement('div'); d.className='diamond';
    d.style.left=Math.random()*100+'%'; d.style.animationDelay=Math.random()*10+'s';
    dWrap.appendChild(d);
}

// Interstitial Ad
window.onload = () => {
    const l = localStorage.getItem('lastInApp') || 0;
    if (Date.now() - l > 120000) {
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        localStorage.setItem('lastInApp', Date.now());
    }
};
