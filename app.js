import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue, child, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

// Firebase config
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

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getDatabase(app);

// USER SETUP
let username = prompt("Enter username").trim();
document.getElementById("username").innerText = username;

let coins = 0;
let videos = [];
let timer = null;
let currentVideo = null;

const coinsEl = document.getElementById("coins");
const yt = document.getElementById("ytPlayer");
const list = document.getElementById("videoList");
const lb = document.getElementById("leaderboard");
const viral = document.getElementById("viralRanking");

const userRef = ref(db,"users/"+username);

// LOAD USER
get(userRef).then(s=>{
  if(!s.exists()) set(userRef,{coins:0,videos:[]});
  else { coins=s.val().coins||0; videos=s.val().videos||[]; }
  updateUI();
});

// SAVE USER
function save(){
  set(userRef,{coins,videos});
}

// UPDATE UI
function updateUI(){
  coinsEl.innerText=coins;
  list.innerHTML="";
  videos.forEach((v,i)=>{
    let li=document.createElement("li");
    li.innerHTML=v+' <button onclick="removeVideo('+i+')">❌</button>';
    list.appendChild(li);
  });
  save();
}

// ADD/REMOVE VIDEO
window.addVideo=()=>{
  const url=document.getElementById("videoURL").value.trim();
  if(!url) return;
  if(videos.length>=5 && coins<50) return alert("Need 50 coins");
  if(videos.length>=5) coins-=50;
  videos.push(url);
  document.getElementById("videoURL").value="";
  updateUI();
}

window.removeVideo=i=>{
  videos.splice(i,1);
  updateUI();
}

// RANDOM VIDEO FROM OTHERS
async function loadRandom(){
  const snap=await get(ref(db,"users"));
  let pool=[];
  snap.forEach(u=>{
    if(u.key!==username && u.val().videos)
      u.val().videos.forEach(v=>pool.push({url:v,owner:u.key}));
  });
  if(pool.length===0) return alert("No videos yet");
  const selected = pool[Math.floor(Math.random()*pool.length)];
  currentVideo = selected.url;
  const vidId = currentVideo.match(/([A-Za-z0-9_-]{11})/)[1];
  yt.src="https://www.youtube.com/embed/"+vidId+"?autoplay=1";
  startEarning(selected.url);
}
window.playRandomVideo=loadRandom;

window.nextVideo=()=>{
  showAd();
  loadRandom();
}

// ANTI-CHEAT COINS & VIDEO VIEWS
function startEarning(videoUrl){
  clearInterval(timer);
  let t=0;
  timer=setInterval(async ()=>{
    t++;
    if(t===60) coins+=1;
    if(t===180) coins+=3;
    if(t===420) coins+=5;
    coinsEl.innerText=coins;
    save();

    // UPDATE VIDEO VIEWS in viral ranking
    const vidKey = videoUrl.replace(/\W/g,'_');
    const vRef = ref(db,"videos/"+vidKey);
    get(vRef).then(s=>{
      let count = s.exists()?s.val().views||0:0;
      update(vRef,{views:count+1,url:videoUrl});
    });

    if(t>=420) clearInterval(timer);
  },1000);
}

// ADS
function showAd(){
  let ads=[
    "https://www.effectivegatecpm.com/mwbmp8mA?key=9ce01dec19ec86d0fbabe111b4439981",
    "https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c",
    "https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232",
    "https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf"
  ];
  window.open(ads[Math.floor(Math.random()*ads.length)],"_blank");
}

// POPUNDER HOURLY
setInterval(()=>{ window.open("https://pl27853087.effectivegatecpm.com/fa/f9/df/faf9df00762374e3ad9510afe003e978.js","_blank"); },3600000);

// LEADERBOARD: USERS
onValue(ref(db,"users"),snap=>{
  let arr=[];
  snap.forEach(u=>arr.push({name:u.key,coins:u.val().coins||0}));
  arr.sort((a,b)=>b.coins-a.coins);
  lb.innerHTML="";
  arr.slice(0,10).forEach((u,i)=>{
    let li=document.createElement("li");
    li.innerHTML=`${i+1}. ${u.name} <span class="badge">${u.coins}</span>`;
    lb.appendChild(li);
  });
});

// VIRAL VIDEO RANKING
onValue(ref(db,"videos"),snap=>{
  let arr=[];
  snap.forEach(v=>arr.push({url:v.val().url,views:v.val().views||0}));
  arr.sort((a,b)=>b.views-a.views);
  viral.innerHTML="";
  arr.slice(0,10).forEach((v,i)=>{
    let li=document.createElement("li");
    li.innerHTML=`${i+1}. <a href="${v.url}" target="_blank">${v.url}</a> <span class="badge">${v.views}</span>`;
    viral.appendChild(li);
  });
});
