
// app.js
// Assumes index.html includes firebase compat SDKs and libtl ad SDK
// Firebase config (provided in prompt) - keep as is or replace with your project's config
const firebaseConfig = {
  apiKey: "AIzaSyBXYAc9-UAB0DzqYsFKAHR_OsRD2UhVLjs",
  authDomain: "project-ads-app-telegram.firebaseapp.com",
  projectId: "project-ads-app-telegram",
  storageBucket: "project-ads-app-telegram.firebasestorage.app",
  messagingSenderId: "867442007509",
  appId: "1:867442007509:web:3fe7c9872d0ab88c1bf15c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Utility functions
function $(id){ return document.getElementById(id); }
function formatPHP(v){ return `₱${v.toFixed(2)}`; }
function genReferralCode(len = 5){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
  let out = '';
  for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function getUrlParam(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

// Telegram WebApp
const tg = window?.Telegram?.WebApp || null;
let tgUser = null;
if (tg) {
  try {
    // initDataUnsafe available in telegram web app container
    tg.expand?.(); // expand to give more space if embedded
    tgUser = (Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) || null;
  } catch(e) {
    console.warn('tg init read error', e);
  }
}

// UI refs
const elUser = $('tg-user');
const elUserSub = $('tg-user-sub');
const elBarriers = $('barriers');
const elEarned = $('earned');
const elRefCode = $('ref-code');
const elCounter = $('counter-example');
const elRefStatus = $('ref-status');
const elWithdrawStatus = $('withdraw-status');

if (tgUser) {
  elUser.textContent = tgUser.username ? `@${tgUser.username}` : `${tgUser.first_name || tgUser.last_name || 'User'}`;
  elUserSub.textContent = `ID: ${tgUser.id} • ${tgUser.language_code || ''}`;
} else {
  elUser.textContent = 'No Telegram data (open via Bot web_app)';
}

// Firebase Auth: anonymous sign in
let currentUid = null;
let userDocUnsub = null;
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUid = user.uid;
    console.log('Signed in:', currentUid);
    await ensureUserProfile(currentUid);
    subscribeToUserDoc(currentUid);
  } else {
    // sign-in anonymously
    try {
      await auth.signInAnonymously();
    } catch (e) {
      console.error('Anonymous sign-in failed', e);
    }
  }
});

async function ensureUserProfile(uid){
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const urlRefCode = getUrlParam('ref'); // if launched with ?ref=CODE

  if (!snap.exists) {
    // create profile
    const code = genReferralCode();
    const profile = {
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      telegramId: tgUser?.id || null,
      username: tgUser?.username || null,
      firstName: tgUser?.first_name || null,
      barriers: 0,
      earnings: 0.0,
      referralCode: code,
      referralCount: 0,
      referralEarnings: 0.0,
      referrerUid: null
    };
    // If we got a referral code in URL, resolve it via referralCodes collection
    if (urlRefCode) {
      try {
        const refDoc = await db.collection('referralCodes').doc(urlRefCode).get();
        if (refDoc.exists) {
          profile.referrerUid = refDoc.data().uid;
        } else {
          console.log('Referral code not found:', urlRefCode);
        }
      } catch(e) { console.error('ref lookup failed', e); }
    }

    await userRef.set(profile);

    // write mapping code -> uid so future users can resolve quickly
    const mappingRef = db.collection('referralCodes').doc(code);
    await mappingRef.set({ uid });
    // If we had referrer, increment their referralCount
    if (profile.referrerUid) {
      const referrerRef = db.collection('users').doc(profile.referrerUid);
      await referrerRef.update({
        referralCount: firebase.firestore.FieldValue.increment(1)
      });
    }
  } else {
    // ensure referralCode mapping exists
    const data = snap.data();
    if (data && data.referralCode) {
      const mappingRef = db.collection('referralCodes').doc(data.referralCode);
      const msnap = await mappingRef.get();
      if (!msnap.exists) {
        await mappingRef.set({ uid });
      }
    }
  }
}

function subscribeToUserDoc(uid){
  if (userDocUnsub) userDocUnsub();
  const uref = db.collection('users').doc(uid);
  userDocUnsub = uref.onSnapshot(doc => {
    if (!doc.exists) return;
    const d = doc.data();
    elBarriers.textContent = d.barriers ?? 0;
    elEarned.textContent = formatPHP(d.earnings ?? 0);
    elRefCode.textContent = d.referralCode ?? '—';
    elCounter.textContent = `${d.barriers ?? 0} / 2000`;
  });
}

// Barrier increment: we update via transaction to compute earnings atomically
async function incrementBarrier(by = 1){
  if (!currentUid) return;
  const uref = db.collection('users').doc(currentUid);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(uref);
      if (!snap.exists) throw 'User doc missing';
      let barriers = (snap.data().barriers || 0) + by;
      // earnings based on every 200 barriers => ₱0.10
      const earnedFromBarriers = Math.floor(barriers / 200) * 0.10;
      tx.update(uref, {
        barriers,
        earnings: earnedFromBarriers
      });
    });
  } catch(e) {
    console.error('incrementBarrier tx failed', e);
  }
}

// Reward user after watching ad (e.g., continue run)
async function rewardUserForAd(extraBarriers = 5, bonusPhp = 0.0){
  // example: give small barrier boost or small bonus to earnings
  if (!currentUid) return;
  const uref = db.collection('users').doc(currentUid);
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(uref);
      if (!snap.exists) throw 'User doc missing';
      let barriers = (snap.data().barriers || 0) + extraBarriers;
      let earnedFromBarriers = Math.floor(barriers / 200) * 0.10;
      let referralEarnings = snap.data().referralEarnings || 0;
      if (bonusPhp > 0) referralEarnings += bonusPhp;
      tx.update(uref, {
        barriers,
        earnings: earnedFromBarriers,
        referralEarnings
      });
    });
  } catch(e) { console.error('reward tx failed', e); }
}

/* ----- Ad SDK integration (libtl) ----- */
// Example: on Game Over user can watch ad to continue
async function showRewardedAdContinue(){
  if (typeof show_10555663 !== 'function') {
    alert('Ad SDK not available');
    return;
  }
  try {
    await show_10555663(); // rewarded interstitial by default
    // reward after successful view
    await rewardUserForAd(10, 0.0); // +10 barriers as example
    alert('You continued your run (+10 barriers).');
  } catch(e){
    console.warn('Ad not finished / error', e);
  }
}

// Example: rewarded popup for daily bonus
async function showRewardedPopupDaily(){
  if (typeof show_10555663 !== 'function') {
    alert('Ad SDK not available');
    return;
  }
  try {
    await show_10555663('pop');
    // reward with PHP credit
    await rewardUserForAd(0, 0.10); // example: +₱0.10 daily bonus
    alert('Daily bonus received: ₱0.10');
  } catch(e) {
    console.warn('Daily bonus ad error', e);
  }
}

// Forced interstitial example
function showInAppInterstitial(){
  if (typeof show_10555663 !== 'function') {
    console.warn('Interstitial SDK not avail');
    return;
  }
  show_10555663({
    type: 'inApp',
    inAppSettings: {
      frequency: 2,
      capping: 0.1,
      interval: 30,
      timeout: 5,
      everyPage: false
    }
  }).catch(e => console.warn('inApp ad error', e));
}

/* ----- UI wiring ----- */
$('btn-left').addEventListener('click', () => {
  // add optional game logic: lateral move
  console.log('LEFT');
});
$('btn-right').addEventListener('click', () => {
  console.log('RIGHT');
});
$('btn-pass').addEventListener('click', () => {
  incrementBarrier(1);
});
$('btn-die').addEventListener('click', () => {
  // on game over -> show rewarded ad to continue
  showRewardedAdContinue();
});

// open in Telegram (useful during dev if hosted publicly)
$('btn-open-tg').addEventListener('click', () => {
  if (tg) tg.openTelegram?.();
  else alert('Open inside Telegram for full features.');
});

// Referral input apply (simulate visiting with ?ref=CODE)
$('btn-apply-ref').addEventListener('click', async () => {
  const code = $('input-ref').value.trim().toUpperCase();
  if (!code) return;
  if (!currentUid) { elRefStatus.textContent = 'Not signed in yet.'; return; }
  // resolve code via referralCodes collection
  try {
    const refDoc = await db.collection('referralCodes').doc(code).get();
    if (!refDoc.exists) {
      elRefStatus.textContent = 'Code not found';
      return;
    }
    const refUid = refDoc.data().uid;
    // set user's referrerUid if not already set
    const uref = db.collection('users').doc(currentUid);
    const snap = await uref.get();
    if (snap.exists && snap.data().referrerUid) {
      elRefStatus.textContent = 'You already have a referrer';
      return;
    }
    await uref.update({ referrerUid: refUid });
    // increment referrer's counter
    await db.collection('users').doc(refUid).update({
      referralCount: firebase.firestore.FieldValue.increment(1)
    });
    elRefStatus.textContent = `Applied referral: ${code}`;
  } catch(e) {
    console.error(e);
    elRefStatus.textContent = 'Error applying referral';
  }
});

// Copy invite link
$('btn-copy-ref').addEventListener('click', async () => {
  if (!currentUid) return;
  const snap = await db.collection('users').doc(currentUid).get();
  if (!snap.exists) return;
  const code = snap.data().referralCode;
  const link = `${location.origin}${location.pathname}?ref=${code}`;
  await navigator.clipboard.writeText(link);
  alert('Invite link copied: ' + link);
});

// Withdraw request
$('btn-withdraw').addEventListener('click', async () => {
  const amount = parseFloat($('withdraw-amount').value);
  const method = $('withdraw-method').value;
  if (!currentUid) { elWithdrawStatus.textContent = 'Not signed in'; return; }
  if (isNaN(amount) || amount < 50) { elWithdrawStatus.textContent = 'Min withdrawal ₱50'; return; }
  try {
    await db.collection('withdrawals').add({
      userId: currentUid,
      amount,
      method,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    elWithdrawStatus.textContent = 'Requested';
  } catch(e) {
    console.error(e);
    elWithdrawStatus.textContent = 'Request error';
  }
});

/* Optional: show daily bonus button every 24h (simplified) */
(async function tryDailyBonus(){
  // Very simple: show daily bonus on first load
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // maybe show daily ad
    }
  });
})();
