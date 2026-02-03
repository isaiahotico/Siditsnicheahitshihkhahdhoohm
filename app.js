// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// DOM Elements
const videoUrlInput = document.getElementById("videoUrl");
const addVideoBtn = document.getElementById("addVideo");
const playBtn = document.getElementById("playVideo");
const nextBtn = document.getElementById("nextVideo");
const playerContainer = document.getElementById("playerContainer");
const coinsDisplay = document.getElementById("coins");
const videoCountDisplay = document.getElementById("videoCount");

let userId;
let userCoins = 0;
let userVideos = [];
let currentVideoIndex = 0;

// Authenticate user anonymously
auth.signInAnonymously().then(() => {
  userId = auth.currentUser.uid;
  loadUserData();
});

// Load user data
function loadUserData() {
  db.ref(`users/${userId}`).once("value", snapshot => {
    const data = snapshot.val();
    if (data) {
      userCoins = data.coins || 0;
      userVideos = data.videos || [];
      updateUI();
    }
  });
}

// Update UI
function updateUI() {
  coinsDisplay.textContent = userCoins;
  videoCountDisplay.textContent = userVideos.length;
}

// Add Video
addVideoBtn.addEventListener("click", () => {
  const url = videoUrlInput.value.trim();
  if (!url) return alert("Please paste a valid YouTube URL");

  // Free limit: 5 videos
  if (userVideos.length >= 5) {
    if (userCoins >= 50) {
      userCoins -= 50; // Charge 50 coins
    } else {
      return alert("You need 50 coins to add more than 5 videos!");
    }
  }

  userVideos.push(url);
  db.ref(`users/${userId}`).set({ videos: userVideos, coins: userCoins });
  videoUrlInput.value = "";
  updateUI();
});

// Play video
playBtn.addEventListener("click", () => {
  if (!userVideos.length) return alert("No videos to play!");
  playVideo(userVideos[currentVideoIndex]);
});

// Next video (random ad pop-up)
nextBtn.addEventListener("click", () => {
  if (!userVideos.length) return alert("No videos to play!");
  
  // Show a random ad
  const ads = [
    "https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981",
    "https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c",
    "https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232",
    "https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf"
  ];
  window.open(ads[Math.floor(Math.random() * ads.length)], "_blank");

  // Show next video randomly
  currentVideoIndex = Math.floor(Math.random() * userVideos.length);
  playVideo(userVideos[currentVideoIndex]);
});

// Function to embed video
function playVideo(url) {
  const videoId = url.split("v=")[1]?.split("&")[0];
  if (!videoId) return alert("Invalid YouTube URL");

  playerContainer.innerHTML = `
    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
      frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
    </iframe>
  `;

  // Add coins based on watch duration
  startCoinTimer();
}

// Coin earning logic
let coinInterval;
function startCoinTimer() {
  clearInterval(coinInterval);
  let seconds = 0;
  coinInterval = setInterval(() => {
    seconds++;
    if (seconds === 60) userCoins += 1;
    if (seconds === 180) userCoins += 2;
    if (seconds === 420) userCoins += 5;

    db.ref(`users/${userId}/coins`).set(userCoins);
    updateUI();
  }, 1000);
}
