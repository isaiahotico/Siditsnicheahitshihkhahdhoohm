// Initialize Adsgram
const AdController = window.Adsgram.init({ blockId: "23263" });

// App State
let balance = parseFloat(localStorage.getItem('userBalance')) || 0.00;
const minWithdrawal = 50.00;
const rewardPerAd = 0.50;

// DOM Elements
const balanceDisplay = document.getElementById('balance');
const watchAdBtn = document.getElementById('watchAdBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const gcashNumberInput = document.getElementById('gcashNumber');
const statusMsg = document.getElementById('statusMsg');

// Update UI on load
updateUI();

// Watch Ad Functionality
watchAdBtn.addEventListener('click', () => {
    watchAdBtn.innerText = "Loading Ad...";
    watchAdBtn.disabled = true;

    AdController.show().then((result) => {
        // User watched till the end
        if (result.done) {
            balance += rewardPerAd;
            saveBalance();
            updateUI();
            showStatus("Success! ₱0.50 added to balance.", "text-green-600");
        } else {
            showStatus("Ad skipped. No reward granted.", "text-red-500");
        }
    }).catch((error) => {
        console.error("Adsgram Error:", error);
        showStatus("No ads available. Try again later.", "text-orange-500");
    }).finally(() => {
        watchAdBtn.innerText = "📺 Watch Ads & Earn";
        watchAdBtn.disabled = false;
    });
});

// Withdrawal Logic
withdrawBtn.addEventListener('click', () => {
    const gcashNum = gcashNumberInput.value;
    if (gcashNum.length < 11) {
        showStatus("Please enter a valid GCash number.", "text-red-500");
        return;
    }

    showStatus("Withdrawal request sent! Processing (24-48h).", "text-blue-600");
    balance = 0; // In a real app, send to backend first
    saveBalance();
    updateUI();
});

// Helper Functions
function updateUI() {
    balanceDisplay.innerText = balance.toFixed(2);
    
    // Toggle Withdrawal Button
    if (balance >= minWithdrawal) {
        withdrawBtn.disabled = false;
        withdrawBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        withdrawBtn.disabled = true;
        withdrawBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function saveBalance() {
    localStorage.setItem('userBalance', balance);
}

function showStatus(msg, colorClass) {
    statusMsg.innerText = msg;
    statusMsg.className = `text-xs mt-3 text-center font-medium ${colorClass}`;
    setTimeout(() => { statusMsg.innerText = ""; }, 5000);
}
