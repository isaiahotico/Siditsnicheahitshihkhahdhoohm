<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WatchPoint Pro</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://www.youtube.com/iframe_api"></script>
    
    <!-- Monetag SDKs -->
    <script src='//libtl.com/sdk.js' data-zone='10276123' data-sdk='show_10276123'></script>
    <script src='//libtl.com/sdk.js' data-zone='10337795' data-sdk='show_10337795'></script>
    <script src='//libtl.com/sdk.js' data-zone='10337853' data-sdk='show_10337853'></script>

    <style>
        :root { --bg: #0f0f0f; --card: #1e1e1e; --accent: #ff0000; --tg: #0088cc; }
        body { font-family: 'Segoe UI', sans-serif; background: var(--bg); color: white; margin: 0; padding: 10px; overflow-x: hidden; }
        .card { background: var(--card); border-radius: 12px; padding: 15px; margin-bottom: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .stat-box { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; text-align: center; }
        #player-container { width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; margin-top: 10px; }
        .timer-bar { height: 6px; background: #333; margin: 10px 0; border-radius: 10px; }
        #progress { height: 100%; background: var(--accent); width: 0%; border-radius: 10px; }
        button { padding: 12px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; width: 100%; margin: 5px 0; transition: 0.2s; }
        .btn-primary { background: var(--tg); color: white; }
        .btn-withdraw { background: #f39c12; color: white; }
        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; justify-content: center; align-items: center; padding: 20px; }
        .modal-content { background: var(--card); padding: 25px; border-radius: 20px; width: 100%; text-align: center; }
        input { padding: 12px; width: 90%; border-radius: 8px; border: 1px solid #444; background: #111; color: white; margin-bottom: 10px; }
        .history-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #333; font-size: 13px; }

        #admin-panel { display: none; margin-top: 30px; border: 2px solid #555; }
    </style>
</head>
<body>

    <!-- GCash Setup -->
    <div id="gcash-modal" class="modal">
        <div class="modal-content">
            <h2 style="color:var(--tg)">GCash Required</h2>
            <p>Enter your GCash number for future payouts.</p>
            <input type="number" id="gcash-input" placeholder="09123456789">
            <button class="btn-primary" onclick="saveGcash()">Save & Start Earning</button>
        </div>
    </div>

    <div class="card">
        <div class="header">
            <span style="color:var(--tg); font-weight: bold;">@<span id="display-name">Guest</span></span>
            <span id="slots-count" style="font-size: 12px; opacity: 0.7;">Slots: 0/5</span>
        </div>
        <div class="stats">
            <div class="stat-box">Points<br><b id="pts-val">0</b></div>
            <div class="stat-box">PHP<br><b id="php-val">₱0.00</b></div>
        </div>
    </div>

    <div id="player-container"><div id="player"></div></div>
    <div class="timer-bar"><div id="progress"></div></div>
    <div id="timer-text" style="font-size: 12px; text-align: center;">Next point in 60s</div>

    <button class="btn-primary" onclick="handleManualNext()">SKIP TO NEXT VIDEO (AD)</button>

    <div class="card">
        <input type="text" id="yt-url-input" placeholder="Paste YouTube Video Link">
        <button style="background: #27ae60; color: white;" onclick="addNewVideo()">Add Video to Global Queue</button>
    </div>

    <div class="card">
        <h4 style="margin:0 0 10px 0;">Withdrawals</h4>
        <div id="history-list"></div>
        <button class="btn-withdraw" onclick="requestWithdrawal()">Withdraw (Min 2,000 Pts)</button>
    </div>

    <!-- OWNER LOGIN -->
    <div style="margin-top: 50px; opacity: 0.5;">
        <button onclick="checkAdmin()" style="background: transparent; color: #555; font-size: 10px;">Owner Login</button>
    </div>

    <div id="admin-panel" class="card">
        <h3>Owner Dashboard</h3>
        <div id="pending-requests"></div>
    </div>

    <script type="module" src="app.js"></script>
</body>
</html>
