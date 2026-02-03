import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.appspot.com",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let uid = localStorage.uid || (localStorage.uid = "u"+Date.now());
let balance = 0;
let playlist = [];
let player;

/* ---------------- ADS ---------------- */
window.showAds = () => {
  show_10555663().then(reward);
  show_10555727().then(reward);
  show_10555746().then(reward);
};

function reward(){
  let earn = (Math.random()*0.005 + 0.005).toFixed(3);
  balance += parseFloat(earn);
  document.getElementById("bal").innerText = balance.toFixed(3);
  update(ref(db,"users/"+uid),{balance});
}

/* ---------------- CHAT ---------------- */
window.sendChat = () => {
  let msg = chatMsg.value;
  if(!msg) return;
  push(ref(db,"chat"),{uid,msg,time:Date.now()});
  chatMsg.value="";
};

onValue(ref(db,"chat"), snap=>{
  chatBox.innerHTML="";
  snap.forEach(s=>{
    let d=s.val();
    chatBox.innerHTML+=`<div>👤 ${d.uid}: ${d.msg}</div>`;
  });
});

/* ---------------- LEADERBOARD ---------------- */
onValue(ref(db,"users"), snap=>{
  let arr=[];
  snap.forEach(s=>arr.push(s.val()));
  arr.sort((a,b)=>b.balance-a.balance);
  leaderboard.innerHTML="";
  arr.slice(0,10).forEach(u=>{
    leaderboard.innerHTML+=`<li>₱${(u.balance||0).toFixed(2)}</li>`;
  });
});

/* ---------------- YOUTUBE ---------------- */
window.addVideo = ()=>{
  let id = ytLink.value.split("v=")[1];
  if(!id) return;
  playlist.push(id);
  if(!player) loadPlayer(id);
};

window.nextRandom = ()=>{
  let id = playlist[Math.floor(Math.random()*playlist.length)];
  player.loadVideoById(id);
};

window.copyPaste = async ()=>{
  ytLink.value = await navigator.clipboard.readText();
};

function loadPlayer(id){
  player = new YT.Player('player',{
    videoId:id,
    events:{onStateChange:e=>{
      if(e.data===0) nextRandom();
    }}
  });
}

/* ---------------- ADMIN ---------------- */
window.adminLogin = ()=>{
  let p = prompt("Admin password");
  if(p==="Propetas12"){
    alert("Admin access granted");
  }
};
