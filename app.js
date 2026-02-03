/* -------------------------------
   Telegram Init
-------------------------------- */
const tg = window.Telegram.WebApp;
tg.ready();

/* Show real Telegram username immediately */
const user = tg.initDataUnsafe?.user;

document.getElementById("username").innerText =
  user
    ? `👤 @${user.username || user.first_name}`
    : "❌ Not opened from Telegram";

/* -------------------------------
   RichAds Telegram Init
-------------------------------- */
const richadsController = new window.TelegramAdsController();

richadsController.initialize({
  pubId: "386741",
  appId: "386741",
  debug: true
});

/* -------------------------------
   Fallback Direct Ads
-------------------------------- */
const fallbackAds = [
  "https://10183.xml.4armn.com/direct-link?pubid=1001014&siteid=TG1",
  "https://11745.xml.4armn.com/direct-link?pubid=1001014&siteid=TG2"
];

/* -------------------------------
   Show Ad (RichAds → Fallback)
-------------------------------- */
let lastAdTime = 0;

function showAd() {
  const now = Date.now();

  // 30s cooldown (safe)
  if (now - lastAdTime < 30000) {
    tg.showAlert("⏳ Please wait before next ad");
    return;
  }

  lastAdTime = now;

  try {
    // Try RichAds first
    richadsController.showAd();
  } catch (e) {
    openFallback();
  }

  // If no fill after 1.5s → fallback
  setTimeout(openFallback, 1500);
}

function openFallback() {
  const link =
    fallbackAds[Math.floor(Math.random() * fallbackAds.length)];
  tg.openLink(link);
}
