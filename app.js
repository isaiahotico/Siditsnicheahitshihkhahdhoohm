// Telegram WebApp init
const tg = window.Telegram.WebApp;
tg.ready();

// Show real Telegram username instantly
const user = tg.initDataUnsafe?.user;
document.getElementById("username").innerText =
  user ? `👤 @${user.username || user.first_name}` : "👤 Guest";

// RichAds Telegram Controller
const richadsController = new window.TelegramAdsController();

richadsController.initialize({
  pubId: "386741",   // ✅ your RichAds Telegram publisher ID
  appId: "386741",
  debug: false
});

// Fallback Direct Ads
const fallbackAds = [
  "https://10183.xml.4armn.com/direct-link?pubid=1001014&siteid=TG1",
  "https://11745.xml.4armn.com/direct-link?pubid=1001014&siteid=TG2"
];

// Show random ad
function showRandomAd() {
  const r = Math.random();

  if (r < 0.6) {
    // 60% RichAds Telegram
    try {
      richadsController.showAd();
    } catch (e) {
      openFallback();
    }
  } else {
    // 40% Direct ads
    openFallback();
  }
}

// Open fallback link
function openFallback() {
  const link = fallbackAds[Math.floor(Math.random() * fallbackAds.length)];
  tg.openLink(link);
}
