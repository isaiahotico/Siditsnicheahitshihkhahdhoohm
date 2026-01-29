import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram Integration
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const user = tg.initDataUnsafe?.user;
const usernameDisplay = document.getElementById('username');
const userPhotoDisplay = document.getElementById('user-photo');

// Display User Info Immediately
if (user) {
    usernameDisplay.innerText = `@${user.username || user.first_name}`;
    if (user.first_name) userPhotoDisplay.innerText = user.first_name.charAt(0);
} else {
    usernameDisplay.innerText = "Guest User";
}

// YouTube Player Logic
let player;
let currentPlaylist = [];

window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '', 
        playerVars: { 'autoplay': 1, 'playsinline': 1 },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
};

function onPlayerStateChange(event) {
    // When video ends (0), play next
    if (event.data === YT.PlayerState.ENDED) {
        playNext();
    }
}

// Extract Video ID
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Firestore: Add Video
window.addToPlaylist = async () => {
    const urlInput = document.getElementById('video-url');
    const videoId = extractVideoId(urlInput.value);

    if (videoId) {
        try {
            await addDoc(collection(db, "playlist"), {
                videoId: videoId,
                addedBy: user?.username || "Guest",
                timestamp: serverTimestamp()
            });
            urlInput.value = "";
            tg.HapticFeedback.notificationOccurred('success');
        } catch (e) {
            console.error("Error adding document: ", e);
        }    } else {
        tg.showAlert("Invalid YouTube URL");
    }
};

// Firestore: Listen for updates
const q = query(collection(db, "playlist"), orderBy("timestamp", "asc"));
onSnapshot(q, (snapshot) => {
    const playlistDiv = document.getElementById('playlist');
    playlistDiv.innerHTML = "";
    currentPlaylist = [];
    
    document.getElementById('queue-count').innerText = `${snapshot.size} Videos`;

    snapshot.forEach((doc) => {
        const data = doc.data();
        currentPlaylist.push({ id: doc.id, ...data });

        const item = document.createElement('div');
        item.className = "flex items-center gap-3 glass p-3 rounded-xl border border-gray-800";
        item.innerHTML = `
            <img src="https://img.youtube.com/vi/${data.videoId}/mqdefault.jpg" class="w-24 rounded-lg">
            <div class="flex-1 overflow-hidden">
                <p class="text-sm font-medium truncate">ID: ${data.videoId}</p>
                <p class="text-xs text-gray-500">By @${data.addedBy}</p>
            </div>
            <button onclick="playNow('${data.videoId}', '${doc.id}')" class="text-blue-400 p-2">
                <i class="fas fa-play text-xl"></i>
            </button>
        `;
        playlistDiv.appendChild(item);
    });

    // Auto-play first video if player is idle
    if (currentPlaylist.length > 0 && player && player.getPlayerState() !== 1) {
        playNow(currentPlaylist[0].videoId, currentPlaylist[0].id);
    }
});

window.playNow = (videoId, docId) => {
    player.loadVideoById(videoId);
    // Optional: Delete from Firestore after playing or keep in list
    // deleteDoc(doc(db, "playlist", docId));
};

async function playNext() {
    if (currentPlaylist.length > 0) {
        const finishedId = currentPlaylist[0].id;
        await deleteDoc(doc(db, "playlist", finishedId));
        // The snapshot listener will automatically trigger the next one
    }
}
