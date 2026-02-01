// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
// If you plan to use Firestore, uncomment the line below
// import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app", // Realtime DB URL
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// If you plan to use Firestore, uncomment the line below
// const db = getFirestore(app);

console.log("Firebase initialized!");

// --- Button Data ---
const buttonLinks = [
    { name: "Offer 1", url: "https://otieu.com/4/10549975" },
    { name: "Offer 2", url: "https://otieu.com/4/10504686" },
    { name: "Offer 3", url: "https://otieu.com/4/10049560" },
    { name: "Offer 4", url: "https://otieu.com/4/10047849" },
    { name: "Offer 5", url: "https://otieu.com/4/10549926" },
    { name: "Offer 6", url: "https://otieu.com/4/10549929" },
    { name: "Offer 7", url: "https://otieu.com/4/10549950" },
    { name: "Offer 8", url: "https://otieu.com/4/10549951" }
];

// --- Card Data (for cooldowns) ---
const cardLinks = [
    { id: "card1", name: "Special Bonus 1", url: "https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981" },
    { id: "card2", name: "Daily Reward", url: "https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c" },
    { id: "card3", name: "Premium Offer", url: "https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232" },
    { id: "card4", name: "Mystery Box", url: "https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf" }
];

const COOLDOWN_DURATION_MS = 60 * 1000; // 1 minute in milliseconds

// --- Functions to create UI elements ---

function createButton(name, url) {
    const buttonDiv = document.createElement('div');    buttonDiv.className = 'button-item';

    const button = document.createElement('button');
    button.textContent = `Click for ${name}`;
    button.onclick = () => window.open(url, '_blank'); // Open in new tab

    buttonDiv.appendChild(button);
    return buttonDiv;
}

function createCard(cardData) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-item';
    cardDiv.id = `card-${cardData.id}`;

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = cardData.name;
    cardDiv.appendChild(cardTitle);

    const cardButton = document.createElement('button');
    cardButton.textContent = `Claim ${cardData.name}`;
    cardDiv.appendChild(cardButton);

    const cooldownTimer = document.createElement('p');
    cooldownTimer.className = 'cooldown-timer';
    cardDiv.appendChild(cooldownTimer);

    let lastClickTime = localStorage.getItem(`cooldown_${cardData.id}`);
    lastClickTime = lastClickTime ? parseInt(lastClickTime, 10) : 0;

    const updateCardState = () => {
        const now = Date.now();
        const timeLeft = lastClickTime + COOLDOWN_DURATION_MS - now;

        if (timeLeft > 0) {
            cardButton.disabled = true;
            const secondsLeft = Math.ceil(timeLeft / 1000);
            cooldownTimer.textContent = `Available in ${secondsLeft}s`;
        } else {
            cardButton.disabled = false;
            cooldownTimer.textContent = 'Ready to claim!';
        }
    };

    cardButton.onclick = () => {
        const now = Date.now();
        localStorage.setItem(`cooldown_${cardData.id}`, now);
        window.open(cardData.url, '_blank'); // Open in new tab
        lastClickTime = now; // Update local state immediately
        updateCardState(); // Update UI
    };

    // Initial state update
    updateCardState();
    // Update state every second
    setInterval(updateCardState, 1000);

    return cardDiv;
}

// --- Main execution when DOM is loaded ---
document.addEventListener('DOMContentLoaded', () => {
    const buttonContainer = document.getElementById('button-container');
    buttonLinks.forEach(link => {
        buttonContainer.appendChild(createButton(link.name, link.url));
    });

    const cardContainer = document.getElementById('card-container');
    cardLinks.forEach(card => {
        cardContainer.appendChild(createCard(card));
    });

    // Adsterra Smart Link (Main) - This is a full-page redirect,
    // so it's generally not used as a click-through banner.
    // I've used them as banner links in index.html, but if you want a
    // direct redirect on page load or a specific event, you'd use this:
    // window.open("https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf", "_blank");
});
