import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = JSON.parse(localStorage.getItem('tg_user')) || null;

// --- Monetag Ad Logic ---
const adFunctions = [show_10276123, show_10337795, show_10337853];

function showRandomInterstitial() {
    const randomIndex = Math.floor(Math.random() * adFunctions.length);
    const selectedAd = adFunctions[randomIndex];

    selectedAd({
        type: 'inApp',
        inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
        }
    });
}

// Initial ad on open
window.onload = () => {
    showRandomInterstitial();
    if(currentUser) {
        document.getElementById('tg-username').innerText = "@" + currentUser.username;
        document.getElementById('login-container').style.display = 'none';
        loadMyLinks();
    }
};

// --- YouTube Logic ---
function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Submit Video to Firestore
window.submitVideo = async () => {
    const urlInput = document.getElementById('video-url');
    const videoId = extractVideoID(urlInput.value);

    if (!videoId) {
        alert("Please enter a valid YouTube URL");
        return;
    }

    if (!currentUser) {
        alert("Please login with Telegram first!");
        return;
    }

    try {
        await addDoc(collection(db, "videos"), {
            videoId: videoId,
            url: urlInput.value,
            userId: currentUser.id,
            username: currentUser.username,
            timestamp: serverTimestamp()
        });
        urlInput.value = "";
        alert("Video added successfully!");
        loadMyLinks();
    } catch (e) {

        console.error("Error adding document: ", e);
    }
};

// Get Random Video and Show Ad
window.handleNextVideo = async () => {
    showRandomInterstitial(); // Show ad on next click
    
    const querySnapshot = await getDocs(collection(db, "videos"));
    const videos = [];
    querySnapshot.forEach((doc) => videos.push(doc.data()));

    if (videos.length === 0) {
        alert("No videos in database yet!");
        return;
    }

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    const wrapper = document.getElementById('youtube-frame-wrapper');
    document.getElementById('player-placeholder').style.display = 'none';
    
    wrapper.innerHTML = `
        <iframe src="https://www.youtube.com/embed/${randomVideo.videoId}?autoplay=1" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>
    `;
};

// Load User's History
async function loadMyLinks() {
    if (!currentUser) return;
    
    const q = query(collection(db, "videos"), where("userId", "==", currentUser.id));
    const querySnapshot = await getDocs(q);
    const listDiv = document.getElementById('links-list');
    listDiv.innerHTML = "";

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        listDiv.innerHTML += `
            <div class="link-item">
                <span>${data.url.substring(0, 40)}...</span>
                <small>${new Date(data.timestamp?.toDate()).toLocaleDateString()}</small>
            </div>
        `;
    });
}

// Listener for login
window.addEventListener('userLogin', () => {
    currentUser = JSON.parse(localStorage.getItem('tg_user'));
    loadMyLinks();
});
