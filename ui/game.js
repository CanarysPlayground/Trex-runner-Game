const c = document.getElementById('game');
const ctx = c.getContext('2d');
const W = 800, H = 250;  // logical canvas size
c.width = W; c.height = H;

const highScoreEl = document.getElementById('highscore');
const statusEl    = document.getElementById('status');
const startBtn    = document.getElementById('startBtn');

// ── Game state ──────────────────────────────────────────────
// 'idle' | 'running' | 'over'
let state = 'idle';

// Dino physics
const GROUND = 185;   // dino feet y when standing
let dinoY = GROUND, dinoVY = 0;
const GRAVITY = 1.2, JUMP_V = -16;

// Cactus
let obsX = W;
let score = 0;
let rafId = null;
const OBS_SPEED = 6;
let obsSpeed = OBS_SPEED;

window.gameScore = 0;

// ── Power-ups ────────────────────────────────────────────────
// Types: 'shield' | 'boost' | 'slow'
const POWERUP_TYPES = ['shield', 'boost', 'slow'];
const POWERUP_COLORS = { shield: '#4dabf7', boost: '#ffd43b', slow: '#cc5de8' };
const POWERUP_ICONS  = { shield: '🛡️', boost: '⚡', slow: '⏱️' };
const POWERUP_LABELS = { shield: 'Shield', boost: 'Boost', slow: 'Slow-Mo' };
const POWERUP_DURATION = { shield: 5, boost: 6, slow: 5 };

let powerUpOnScreen = null; // { type, x, y }
let nextPowerUpScore = 5;   // spawn when score reaches this

window.powerUp = { active: null, timeLeft: 0 };
let powerUpTimer = 0;       // ticks remaining (60 ticks/s approx)

// ── Clouds ──────────────────────────────────────────────────
const clouds = [
  {x:120, y:35, w:90, speed:0.6},
  {x:340, y:55, w:70, speed:0.4},
  {x:580, y:28, w:110,speed:0.7},
  {x:720, y:50, w:80, speed:0.5},
];

// ── Birds ───────────────────────────────────────────────────
const birds = [
  {x:900, y:55,  speed:2.2, wing:0, flapT:0},
  {x:1100,y:38,  speed:1.8, wing:0, flapT:10},
  {x:1350,y:70,  speed:2.5, wing:0, flapT:5},
];

// ── Road stripes ────────────────────────────────────────────
const stripes = [];
for(let i=0;i<10;i++) stripes.push({x: i*110, y:204, w:60, h:5});
let stripeOffset = 0;

// ── SVG Images ──────────────────────────────────────────────
const dinoImg = new Image();
dinoImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect x="0" y="24" width="6" height="4" fill="#535353"/>
  <rect x="4" y="20" width="6" height="8" fill="#535353"/>
  <rect x="8" y="18" width="20" height="16" fill="#535353"/>
  <rect x="16" y="14" width="14" height="8" fill="#535353"/>
  <rect x="22" y="8" width="10" height="10" fill="#535353"/>
  <rect x="20" y="4" width="18" height="12" fill="#535353"/>
  <rect x="32" y="6" width="4" height="4" fill="white"/>
  <rect x="33" y="7" width="2" height="2" fill="#111"/>
  <rect x="34" y="12" width="8" height="4" fill="#535353"/>
  <rect x="24" y="24" width="8" height="3" fill="#535353"/>
  <rect x="30" y="24" width="4" height="5" fill="#535353"/>
  <rect x="22" y="34" width="7" height="10" fill="#535353"/>
  <rect x="20" y="42" width="9" height="4" fill="#535353"/>
  <rect x="10" y="34" width="7" height="8" fill="#535353"/>
  <rect x="8" y="40" width="11" height="4" fill="#535353"/>
</svg>`);

const cactusImg = new Image();
cactusImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 55">
  <rect x="11" y="0" width="8" height="55" fill="#2f9e44"/>
  <rect x="2" y="14" width="11" height="7" fill="#2f9e44"/>
  <rect x="2" y="6" width="7" height="15" fill="#2f9e44"/>
  <rect x="18" y="22" width="10" height="7" fill="#2f9e44"/>
  <rect x="21" y="14" width="7" height="15" fill="#2f9e44"/>
  <rect x="10" y="2" width="2" height="5" fill="#40c057"/>
  <rect x="18" y="2" width="2" height="5" fill="#40c057"/>
  <rect x="0" y="9" width="4" height="2" fill="#40c057"/>
  <rect x="26" y="17" width="4" height="2" fill="#40c057"/>
</svg>`);

// ── API ─────────────────────────────────────────────────────
fetch('http://localhost:3000/score')
  .then(r=>r.json())
  .then(d=>{ if(highScoreEl) highScoreEl.textContent='High Score: '+d.highScore; })
  .catch(()=>{});

// ── Input ───────────────────────────────────────────────────
document.addEventListener('keydown', ()=>{
  if(state==='running' && dinoY>=GROUND) dinoVY=JUMP_V;
});
startBtn.addEventListener('click', ()=>{
  if(state==='idle'||state==='over') startGame();
});

// ── Helpers ─────────────────────────────────────────────────
function setStatus(msg){ if(statusEl) statusEl.textContent=msg; }

const powerUpStatusEl = document.getElementById('powerup-status');
function setPowerUpStatus(){
  if(!powerUpStatusEl) return;
  if(window.powerUp.active){
    const t = window.powerUp.timeLeft;
    powerUpStatusEl.textContent = POWERUP_ICONS[window.powerUp.active]+' '+POWERUP_LABELS[window.powerUp.active]+' '+t+'s';
  } else {
    powerUpStatusEl.textContent = '—';
  }
}

// ── Draw sky gradient ────────────────────────────────────────
function drawSky(){
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#5ba3d9');
  grad.addColorStop(0.55,'#acd8f0');
  grad.addColorStop(1,'#d4ecfb');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);
}

// ── Draw ground / road ───────────────────────────────────────
function drawGround(moving){
  // Soil strip
  ctx.fillStyle='#c8a96e';
  ctx.fillRect(0,198,W,H-198);
  // Road surface
  ctx.fillStyle='#7a7a7a';
  ctx.fillRect(0,196,W,20);
  // Road edge lines
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,196,W,2);
  ctx.fillRect(0,214,W,2);
  // Dashed centre stripes
  ctx.fillStyle='#ffff99';
  const offset = moving ? stripeOffset : 0;
  for(let i=0;i<12;i++){
    const sx = ((i*110 - offset) % (W+110) + W+110) % (W+110) - 50;
    ctx.fillRect(sx,204,60,4);
  }
}

// ── Draw clouds ──────────────────────────────────────────────
function drawClouds(){
  clouds.forEach(cl=>{
    ctx.fillStyle='rgba(255,255,255,0.92)';
    // Main puff
    ctx.beginPath();
    ctx.ellipse(cl.x, cl.y, cl.w*0.5, 14, 0, 0, Math.PI*2);
    ctx.fill();
    // Left bump
    ctx.beginPath();
    ctx.ellipse(cl.x-cl.w*0.22, cl.y+3, cl.w*0.28, 11, 0, 0, Math.PI*2);
    ctx.fill();
    // Right bump
    ctx.beginPath();
    ctx.ellipse(cl.x+cl.w*0.22, cl.y+4, cl.w*0.22, 9, 0, 0, Math.PI*2);
    ctx.fill();
  });
}

// ── Draw birds ───────────────────────────────────────────────
function drawBirds(tick){
  birds.forEach(b=>{
    const flap = Math.sin(tick*0.18 + b.flapT) > 0;
    ctx.strokeStyle='#2c3e50';
    ctx.lineWidth=2;
    ctx.lineCap='round';
    // Simple M-shape bird
    ctx.beginPath();
    if(flap){
      ctx.moveTo(b.x-7, b.y);  ctx.quadraticCurveTo(b.x-3, b.y-5, b.x, b.y);
      ctx.quadraticCurveTo(b.x+3, b.y-5, b.x+7, b.y);
    } else {
      ctx.moveTo(b.x-7, b.y);  ctx.quadraticCurveTo(b.x-3, b.y+4, b.x, b.y);
      ctx.quadraticCurveTo(b.x+3, b.y+4, b.x+7, b.y);
    }
    ctx.stroke();
  });
}

// ── Draw power-up on screen ───────────────────────────────────
function drawPowerUp(){
  if(!powerUpOnScreen) return;
  const {type, x} = powerUpOnScreen;
  const y = GROUND - 20;
  const color = POWERUP_COLORS[type];
  // Pulsing glow circle
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  // Icon letter
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Segoe UI,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(POWERUP_ICONS[type], x, y);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Draw active power-up aura on dino ────────────────────────
function drawPowerUpAura(){
  if(!window.powerUp.active) return;
  const color = POWERUP_COLORS[window.powerUp.active];
  const dinoMidX = 40 + 22, dinoMidY = dinoY - 10;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(dinoMidX, dinoMidY, 28, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();
}


function drawScene(tick, moving){
  drawSky();
  drawClouds();
  drawBirds(tick);
  drawGround(moving);
  // Power-up on screen
  drawPowerUp();
  // Cactus (only draw if not off screen in idle)
  if(obsX < W+10){
    ctx.drawImage(cactusImg, obsX, GROUND-50, 30, 55);
  }
  // Power-up aura around dino
  drawPowerUpAura();
  // Dino
  ctx.drawImage(dinoImg, 40, dinoY-32, 44, 44);
  // Score
  ctx.fillStyle='#1a4a6b';
  ctx.font='bold 15px Segoe UI,sans-serif';
  ctx.fillText('Score: '+score, 12, 22);
}

// ── Idle frame ───────────────────────────────────────────────
let idleTick = 0;
function drawIdle(){
  if(state!=='idle') return;
  idleTick++;
  // Clouds drift slowly left even in idle
  clouds.forEach(cl=>{
    cl.x -= cl.speed * 0.3;
    if(cl.x + 70 < 0) cl.x = W + 60;
  });
  // Birds drift slowly
  birds.forEach(b=>{
    b.x -= b.speed * 0.3;
    if(b.x < -20) b.x = W + Math.random()*200 + 50;
  });
  drawScene(idleTick, false);
  rafId = requestAnimationFrame(drawIdle);
}

// ── Start game ───────────────────────────────────────────────
function startGame(){
  if(rafId) cancelAnimationFrame(rafId);
  // Reset positions
  dinoY=GROUND; dinoVY=0; score=0; obsX=W;
  stripeOffset=0;
  obsSpeed = OBS_SPEED;
  // Reset power-ups
  powerUpOnScreen = null;
  nextPowerUpScore = 5;
  window.powerUp = { active: null, timeLeft: 0 };
  powerUpTimer = 0;
  setPowerUpStatus();
  // Scatter clouds to spread
  clouds[0].x=120; clouds[1].x=340; clouds[2].x=580; clouds[3].x=720;
  // Scatter birds off-screen so they fly in naturally
  birds[0].x=W+100; birds[1].x=W+280; birds[2].x=W+520;
  state='running';
  window.gameScore=0;
  startBtn.textContent='Restart';
  setStatus('Running — press Space to jump!');
  loop(0);
}

// ── Game over ────────────────────────────────────────────────
function gameOver(){
  state='over';
  startBtn.textContent='Restart';
  setStatus('Game Over! Score: '+score+' — click Restart to play again');
  // Draw frozen scene
  drawScene(0, false);
  fetch('http://localhost:3000/score/'+score,{method:'POST'})
    .then(r=>r.json())
    .then(d=>{ if(highScoreEl) highScoreEl.textContent='High Score: '+d.highScore; })
    .catch(()=>{});
}

// ── Main game loop ───────────────────────────────────────────
let tick = 0;
function loop(){
  if(state!=='running') return;
  tick++;

  // Physics
  dinoVY += GRAVITY;
  dinoY  += dinoVY;
  if(dinoY >= GROUND){ dinoY=GROUND; dinoVY=0; }

  // Power-up effect: slow-mo adjusts obstacle speed
  obsSpeed = (window.powerUp.active === 'slow') ? OBS_SPEED * 0.5 : OBS_SPEED;

  // Cactus
  obsX -= obsSpeed;
  if(obsX < -40){
    obsX = W + Math.floor(Math.random()*200);
    score += (window.powerUp.active === 'boost') ? 2 : 1;
    // Spawn power-up when score milestone reached
    if(score >= nextPowerUpScore && !powerUpOnScreen){
      const type = POWERUP_TYPES[Math.floor(Math.random()*POWERUP_TYPES.length)];
      powerUpOnScreen = { type, x: W + 80 };
      nextPowerUpScore = score + 5;
    }
  }
  window.gameScore = score;

  // Move power-up on screen
  if(powerUpOnScreen){
    powerUpOnScreen.x -= obsSpeed;
    if(powerUpOnScreen.x < -30) powerUpOnScreen = null;
  }

  // Check power-up collection (dino AABB vs power-up circle)
  if(powerUpOnScreen){
    const pu = powerUpOnScreen;
    const dinoLeft = 40, dinoRight = 84;
    if(pu.x > dinoLeft - 20 && pu.x < dinoRight + 20 && dinoY > GROUND - 30){
      // Collected!
      window.powerUp.active = pu.type;
      window.powerUp.timeLeft = POWERUP_DURATION[pu.type];
      powerUpTimer = POWERUP_DURATION[pu.type] * 60; // frames at ~60fps
      powerUpOnScreen = null;
      setPowerUpStatus();
    }
  }

  // Count down active power-up
  if(window.powerUp.active){
    powerUpTimer--;
    if(powerUpTimer <= 0){
      window.powerUp.active = null;
      window.powerUp.timeLeft = 0;
      setPowerUpStatus();
    } else {
      window.powerUp.timeLeft = Math.ceil(powerUpTimer / 60);
      // Update HUD every second
      if(powerUpTimer % 60 === 0) setPowerUpStatus();
    }
  }

  // Road stripes scroll
  stripeOffset = (stripeOffset + obsSpeed) % 110;

  // Clouds
  clouds.forEach(cl=>{
    cl.x -= cl.speed;
    if(cl.x + 70 < 0) cl.x = W + 60;
  });

  // Birds
  birds.forEach(b=>{
    b.x -= b.speed;
    if(b.x < -20) b.x = W + Math.random()*300 + 100;
    // Gentle up/down drift
    b.y += Math.sin(tick*0.04 + b.flapT)*0.3;
    b.y = Math.max(20, Math.min(85, b.y));
  });

  // Draw everything
  drawScene(tick, true);

  // Collision check (AABB dino vs cactus)
  if(obsX < 84 && obsX > 46 && dinoY > GROUND-28){
    if(window.powerUp.active === 'shield'){
      // Shield absorbs the hit
      window.powerUp.active = null;
      window.powerUp.timeLeft = 0;
      powerUpTimer = 0;
      setPowerUpStatus();
      rafId = requestAnimationFrame(loop);
    } else {
      gameOver();
    }
  } else {
    rafId = requestAnimationFrame(loop);
  }
}

// ── Boot ─────────────────────────────────────────────────────
dinoImg.onload = ()=>{
  if(state==='idle') rafId = requestAnimationFrame(drawIdle);
};
