
// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VH_odyv5N3dg", // Corrected a typo if it was intended, often _ are not used in apiKey
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics(); // Analytics initialized
const database = firebase.database();

// --- Constants & Global Variables ---
const VIDEO_REWARD = 0.01;
const SUBSCRIBE_REWARD = 0.03;
const LINK_SUBMISSION_COST = 1.00;

const FREE_VIDEO_SLOTS = 5;
const FREE_SUBSCRIBE_SLOTS = 5;

const VIDEO_FREE_MAX_VIEWS = 100;
const VIDEO_PAID_MAX_VIEWS = 120;
const SUBSCRIBE_FREE_MAX_CLICKS = 50;
const SUBSCRIBE_PAID_MAX_CLICKS = 65;

let userBalance = 0;
let telegramUsername = '';
let watchedVideos = {}; // { linkId: true, ... }
let subscribedChannels = {}; // { linkId: true, ... }

// --- DOM Elements ---
const userBalanceSpan = document.getElementById('userBalance');
const telegramUsernameInput = document.getElementById('telegramUsernameInput');
const videoLinkInput = document.getElementById('videoLinkInput');
const subscribeLinkInput = document.getElementById('subscribeLinkInput');
const videoLinksContainer = document.getElementById('videoLinksContainer');
const subscribeLinksContainer = document.getElementById('subscribeLinksContainer');
const noVideosMessage = document.getElementById('noVideosMessage');
const noSubscribesMessage = document.getElementById('noSubscribesMessage');

// --- Local Storage Functions (for client-side persistence) ---
function loadUserData() {
    userBalance = parseFloat(localStorage.getItem('paperhouse_balance')) || 0;
    telegramUsername = localStorage.getItem('paperhouse_telegram_username') || '';
    watchedVideos = JSON.parse(localStorage.getItem('paperhouse_watched_videos')) || {};
    subscribedChannels = JSON.parse(localStorage.getItem('paperhouse_subscribed_channels')) || {};

    userBalanceSpan.textContent = userBalance.toFixed(2);
    telegramUsernameInput.value = telegramUsername;
}

function saveUserData() {
    localStorage.setItem('paperhouse_balance', userBalance.toFixed(2));
    localStorage.setItem('paperhouse_telegram_username', telegramUsername);
    localStorage.setItem('paperhouse_watched_videos', JSON.stringify(watchedVideos));
    localStorage.setItem('paperhouse_subscribed_channels', JSON.stringify(subscribedChannels));

    userBalanceSpan.textContent = userBalance.toFixed(2);
}

function saveTelegramUsername(username) {
    telegramUsername = username.trim();
    saveUserData();
    if (telegramUsername) {
        alert('Telegram username saved: ' + telegramUsername);
    }
}

// --- Link Submission Function ---
async function addLink(type) {
    if (!telegramUsername) {
        alert('Please enter your Telegram username first.');
        telegramUsernameInput.focus();
        return;
    }

    let url = '';
    let linkRef = null;
    let initialCount = 0;
    let reward = 0;
    let freeSlotsUsed = 0;
    let maxFreeSlots = 0;
    let linkCost = LINK_SUBMISSION_COST; // Default to paid

    if (type === 'video') {
        url = videoLinkInput.value.trim();
        if (!url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
            alert('Please enter a valid YouTube video URL.');
            return;
        }
        linkRef = database.ref('links/videos');
        reward = VIDEO_REWARD;
        maxFreeSlots = FREE_VIDEO_SLOTS;

        // Count current active free video links
        const snapshot = await linkRef.orderByChild('cost').equalTo(0).once('value');
        freeSlotsUsed = snapshot.numChildren();
    } else if (type === 'subscribe') {
        url = subscribeLinkInput.value.trim();
        if (!url.includes('youtube.com/channel/') && !url.includes('youtube.com/user/') && !url.includes('youtube.com/@')) {
            alert('Please enter a valid YouTube channel URL.');
            return;
        }
        linkRef = database.ref('links/subscribes');
        reward = SUBSCRIBE_REWARD;
        maxFreeSlots = FREE_SUBSCRIBE_SLOTS;

        // Count current active free subscribe links
        const snapshot = await linkRef.orderByChild('cost').equalTo(0).once('value');
        freeSlotsUsed = snapshot.numChildren();
    } else {
        return;
    }

    if (!url) {
        alert('Please enter a URL.');
        return;
    }

    let isFreeSubmission = false;
    if (freeSlotsUsed < maxFreeSlots) {
        isFreeSubmission = true;
        linkCost = 0; // Set cost to 0 for free slots
    }

    if (!isFreeSubmission && userBalance < linkCost) {
        alert(`You need ${linkCost.toFixed(2)} Peso to add this link. Your current balance is ${userBalance.toFixed(2)} Peso.`);
        return;
    }

    if (type === 'video') {
        initialCount = isFreeSubmission ? VIDEO_FREE_MAX_VIEWS : VIDEO_PAID_MAX_VIEWS;
    } else { // subscribe
        initialCount = isFreeSubmission ? SUBSCRIBE_FREE_MAX_CLICKS : SUBSCRIBE_PAID_MAX_CLICKS;
    }

    try {
        await linkRef.push({
            url: url,
            addedBy: telegramUsername,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            initialCount: initialCount,
            currentCount: initialCount,
            reward: reward,
            cost: linkCost,
            linkType: type // Added to help filter if needed
        });

        if (!isFreeSubmission) {
            userBalance -= linkCost;
            saveUserData();
            alert(`Link added successfully! ${linkCost.toFixed(2)} Peso deducted.`);
        } else {
            alert('Free link added successfully!');
        }

        // Clear input field
        if (type === 'video') videoLinkInput.value = '';
        else subscribeLinkInput.value = '';

    } catch (error) {
        console.error("Error adding link:", error);
        alert('Failed to add link. Check console for details.');
    }
}


// --- Display Links Function (Real-time update) ---
function loadLinks() {
    // Listen for video links
    database.ref('links/videos').on('value', (snapshot) => {
        const videos = snapshot.val();
        videoLinksContainer.innerHTML = '';
        let hasVisibleVideos = false;

        if (videos) {
            Object.entries(videos).sort(([, a], [, b]) => a.timestamp - b.timestamp).forEach(([linkId, link]) => {
                if (link.currentCount > 0 && !watchedVideos[linkId]) { // Only show if available and not watched by current user
                    hasVisibleVideos = true;
                    const card = `
                        <div class="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <h3 class="font-semibold text-lg text-gray-800 mb-2 truncate">Video by ${link.addedBy || 'Anonymous'}</h3>
                            <p class="text-sm text-gray-600 mb-3">Views Left: <span class="font-bold text-blue-600">${link.currentCount}</span></p>
                            <button onclick="interactWithLink('video', '${linkId}', '${link.url}', ${link.reward}, ${link.cost > 0})"
                                class="w-full bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500">
                                Watch (Earn ${link.reward.toFixed(2)} Peso)
                            </button>
                        </div>
                    `;
                    videoLinksContainer.innerHTML += card;
                }
            });
        }
        noVideosMessage.style.display = hasVisibleVideos ? 'none' : 'block';
        if (!hasVisibleVideos) {
            videoLinksContainer.innerHTML = '<p class="col-span-full text-gray-500 text-center">No videos available to watch at the moment.</p>';
        }
    });

    // Listen for subscribe links
    database.ref('links/subscribes').on('value', (snapshot) => {
        const subscribes = snapshot.val();
        subscribeLinksContainer.innerHTML = '';
        let hasVisibleSubscribes = false;

        if (subscribes) {
            Object.entries(subscribes).sort(([, a], [, b]) => a.timestamp - b.timestamp).forEach(([linkId, link]) => {
                if (link.currentCount > 0 && !subscribedChannels[linkId]) { // Only show if available and not subscribed by current user
                    hasVisibleSubscribes = true;
                    const card = `
                        <div class="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <h3 class="font-semibold text-lg text-gray-800 mb-2 truncate">Channel by ${link.addedBy || 'Anonymous'}</h3>
                            <p class="text-sm text-gray-600 mb-3">Subscribers Left: <span class="font-bold text-yellow-600">${link.currentCount}</span></p>
                            <button onclick="interactWithLink('subscribe', '${linkId}', '${link.url}', ${link.reward}, ${link.cost > 0})"
                                class="w-full bg-yellow-500 text-white p-2 rounded-lg hover:bg-yellow-600 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-500">
                                Subscribe (Earn ${link.reward.toFixed(2)} Peso)
                            </button>
                        </div>
                    `;
                    subscribeLinksContainer.innerHTML += card;
                }
            });
        }
        noSubscribesMessage.style.display = hasVisibleSubscribes ? 'none' : 'block';
        if (!hasVisibleSubscribes) {
            subscribeLinksContainer.innerHTML = '<p class="col-span-full text-gray-500 text-center">No channels available to subscribe at the moment.</p>';
        }
    });
}

// --- Interaction Logic (Watch/Subscribe) ---
function interactWithLink(type, linkId, linkUrl, reward, isPaidSubmission) {
    if (!telegramUsername) {
        alert('Please enter your Telegram username first to earn rewards.');
        telegramUsernameInput.focus();
        return;
    }

    const confirmInteraction = confirm(`You are about to open a YouTube ${type === 'video' ? 'video' : 'channel'}. Please interact for at least 30 seconds to earn ${reward.toFixed(2)} Peso. Proceed?`);
    if (!confirmInteraction) return;

    // Open the YouTube link in a new tab
    const newWindow = window.open(linkUrl, '_blank');

    if (!newWindow) {
        alert('Could not open new window. Please allow pop-ups for this site.');
        return;
    }

    // Temporarily disable buttons to prevent double-clicking
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(button => button.disabled = true);

    alert(`Please wait for 30 seconds. Do not close the new tab or this window to ensure you get your reward.`);

    let countdown = 30;
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            processReward(type, linkId, reward, newWindow);
            allButtons.forEach(button => button.disabled = false); // Re-enable buttons
        } else {
            // Optional: Update a user-facing timer if you add one to the UI
            console.log(`Time left: ${countdown} seconds for ${type} ${linkId}`);
        }
    }, 1000);
}

async function processReward(type, linkId, reward, openedWindow) {
    let linkPath = `links/${type === 'video' ? 'videos' : 'subscribes'}/${linkId}`;
    let userActionList = type === 'video' ? watchedVideos : subscribedChannels;

    // Mark as interacted locally
    userActionList[linkId] = true;
    saveUserData(); // Update localStorage

    // Decrement count in Firebase
    try {
        const linkRef = database.ref(linkPath);
        const snapshot = await linkRef.once('value');
        const link = snapshot.val();

        if (link && link.currentCount > 0) {
            await linkRef.update({
                currentCount: link.currentCount - 1
            });
            userBalance += reward;
            saveUserData(); // Update local balance
            alert(`Congratulations! You earned ${reward.toFixed(2)} Peso.`);

            // Optionally, you can try to close the opened window, but it's often blocked by browsers.
            // if (openedWindow && !openedWindow.closed) {
            //     openedWindow.close();
            // }

        } else {
            alert('This link is no longer available or was already completed.');
        }
    } catch (error) {
        console.error("Error processing reward:", error);
        alert('An error occurred while processing your reward. Please try again.');
    }
}

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    loadLinks(); // Start listening for updates immediately
});
