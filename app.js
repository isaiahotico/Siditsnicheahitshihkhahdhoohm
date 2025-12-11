let coins=0;

// Coins display
function updateCoins(amount=0){
    coins+=amount;
    const coinEl=document.getElementById('coins');
    if(coinEl) coinEl.innerText=`Coins: ${coins}`;

    const star=document.createElement('span');
    star.innerText='★';
    star.classList.add('coin-star');
    document.body.appendChild(star);
    star.style.left='50%';
    star.style.top='40px';
    star.style.transform='translateX(-50%)';
    setTimeout(()=>star.remove(),1000);
}

// Buttons animation and click effects
document.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', e=>{
        const happy=document.createElement('div');
        happy.innerText='😊';
        happy.style.position='absolute';
        happy.style.left=e.clientX+'px';
        happy.style.top=e.clientY+'px';
        happy.style.color='yellow';
        happy.style.fontSize='12px';
        document.body.appendChild(happy);
        let dy=-1; let opacity=1;
        function animate(){ dy+=0.05; opacity-=0.02; happy.style.top=parseFloat(happy.style.top)+dy+'px'; happy.style.opacity=opacity; if(opacity>0) requestAnimationFrame(animate); else happy.remove(); }
        animate();
    });
});

// Admin password check
function checkAdminPass(inputId, correctPass, redirectPage){
    const pass=document.getElementById(inputId)?.value;
    if(pass===correctPass) window.location.href=redirectPage;
    else alert('Incorrect password!');
}

// Watch Ads
function watchAd(buttonNum){
    if(buttonNum===1||buttonNum===2){
        setTimeout(()=>{
            updateCoins(1);
            alert("Congratulations! You earned a Valuable Coin! Keep it safe.");
        },10000);
    }
    if(buttonNum===1||buttonNum===2){ show_10276123().then(()=>{}).catch(()=>{}); }
    else { show_10276123('pop').then(()=>{}).catch(()=>{}); }
}

// Particles background
function spawnParticles(){
    const container=document.getElementById('particleContainer');
    for(let i=0;i<50;i++){
        const p=document.createElement('div');
        p.classList.add('particle');
        p.style.left=Math.random()*window.innerWidth+'px';
        p.style.top=Math.random()*window.innerHeight+'px';
        p.style.width=5+Math.random()*10+'px';
        p.style.height=5+Math.random()*10+'px';
        p.style.background=`hsl(${Math.random()*360},100%,50%)`;
        container.appendChild(p);
        setTimeout(()=>p.remove(),5000+Math.random()*3000);
    }
}
setInterval(spawnParticles,200);

// Persistent daily audio
function playDailyAudio(){
    const today = new Date().toISOString().slice(0,10);
    let savedDay = localStorage.getItem('audioDay');
    let trackIndex;

    if(savedDay===today){
        trackIndex = localStorage.getItem('audioTrack');
    } else {
        trackIndex = Math.floor(Math.random()*15)+1;
        localStorage.setItem('audioTrack', trackIndex);
        localStorage.setItem('audioDay', today);
    }

    let audio = document.getElementById('bgAudio');
    if(!audio){
        audio = document.createElement('audio');
        audio.id='bgAudio';
        audio.autoplay=true;
        audio.loop=true;
        document.body.appendChild(audio);
    }
    audio.src = `audio/audio${trackIndex}.mp3`;
    audio.volume=0.3;
    audio.play();
}
playDailyAudio();
