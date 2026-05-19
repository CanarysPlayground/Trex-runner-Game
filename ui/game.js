AWS_ACCESS_KEY_ID=AKIA1234567890ABCD
AWS_SECRET_ACCESS_KEY=abcd1234abcd1234abcd1234abcd1234abcd1234


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

// Bird obstacle
const BIRD_W = 44, BIRD_H = 22;
const BIRD_Y_LOW  = 160;  // threatens standing dino → player must jump
const BIRD_Y_HIGH =  82;  // threatens dino near jump apex → timing challenge
const BIRD_SPEED_BASE = 5;
let birdX = -200;
let birdY = BIRD_Y_LOW;
let birdActive = false;
let birdSpawnCooldown = 180;
let shieldActive = false;

// ── Power-up constants ───────────────────────────────────────
const POWERUP_W = 24, POWERUP_H = 24;
const POWERUP_Y = GROUND - 10;   // token center sits just above road (y=175)
const SHIELD_DURATION     = 300;  // frames (~5 s at 60 fps)
const BOOST_DURATION      = 480;  // frames (~8 s at 60 fps)
const SLOWMOTION_DURATION = 360;  // frames (~6 s at 60 fps)

// ── Power-up state ───────────────────────────────────────────
let powerupType          = 'shield';  // 'shield' | 'scoreBoost' | 'slowMotion'
let powerupX             = -200;
let powerupActive        = false;
let powerupSpawnCooldown = 300;
let shieldTimer          = 0;
let scoreBoostActive     = false;
let scoreBoostTimer      = 0;
let birdHitCooldown      = 0;    // invincibility frames after shield absorbs a bird
let birdWasAbsorbed      = false; // suppresses dodge bonus when shield took the hit
let slowMotionActive     = false;
let slowMotionTimer      = 0;

window.gameScore = 0;

// ── Difficulty profiles ─────────────────────────────────────
const DIFFICULTY_PROFILES = {
  easy:   { obsSpeed: 4, obsGapMin: 250, obsGapRange: 200, scoreMultiplier: 1, cloudSpeedScale: 0.6 },
  medium: { obsSpeed: 6, obsGapMin: 0,   obsGapRange: 200, scoreMultiplier: 1, cloudSpeedScale: 1.0 },
  hard:   { obsSpeed: 9, obsGapMin: 0,   obsGapRange: 100, scoreMultiplier: 2, cloudSpeedScale: 1.4 },
};
window.selectedDifficulty = 'medium';

document.querySelectorAll('input[name="difficulty"]').forEach(r => {
  r.addEventListener('change', e => {
    window.selectedDifficulty = e.target.value;
    const diffDisplay = document.getElementById('difficulty-display');
    if (diffDisplay) diffDisplay.textContent = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
  });
});

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

// ── Spawn obstacle bird ─────────────────────────────────────
function spawnBird(){
  birdY = Math.random() < 0.5 ? BIRD_Y_LOW : BIRD_Y_HIGH;
  birdX = W + 80 + Math.floor(Math.random() * 200);
  birdActive = true;
}

// ── Spawn power-up token ─────────────────────────────────────
function spawnPowerup(){
  if(obsX < 350) return;  // cactus gap guard — don't overlap with nearby cactus
  const r = Math.random();
  powerupType   = r < 0.34 ? 'shield' : r < 0.67 ? 'scoreBoost' : 'slowMotion';
  powerupX      = W + 60 + Math.floor(Math.random() * 150);
  powerupActive = true;
}

// ── Draw obstacle bird ───────────────────────────────────────
// Renders an M-shape bird with sine-wave wing flap at (birdX, birdY).
// Only executes when birdActive === true.
function drawBird(tick){
  if(!birdActive) return;
  const flap = Math.sin(tick * 0.22) * 8;
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Left wing
  ctx.moveTo(birdX,              birdY + flap);
  ctx.quadraticCurveTo(birdX + BIRD_W * 0.25, birdY - flap, birdX + BIRD_W * 0.5, birdY);
  // Right wing
  ctx.quadraticCurveTo(birdX + BIRD_W * 0.75, birdY - flap, birdX + BIRD_W,       birdY + flap);
  ctx.stroke();
}

// ── Draw power-up token ──────────────────────────────────────
function drawPowerup(){
  if(!powerupActive) return;
  ctx.save();
  if(powerupType === 'shield'){
    ctx.fillStyle   = 'rgba(52,152,219,0.85)';
    ctx.strokeStyle = '#1a6fa0';
  } else if(powerupType === 'slowMotion'){
    ctx.fillStyle   = 'rgba(155,89,182,0.85)';
    ctx.strokeStyle = '#6c3483';
  } else {
    ctx.fillStyle   = 'rgba(241,196,15,0.85)';
    ctx.strokeStyle = '#b7950b';
  }
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(powerupX + POWERUP_W * 0.5, POWERUP_Y, POWERUP_W * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle    = '#fff';
  ctx.font         = 'bold 13px Segoe UI,sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(powerupType === 'shield' ? 'S' : powerupType === 'slowMotion' ? 'SL' : 'B', powerupX + POWERUP_W * 0.5, POWERUP_Y);
  ctx.restore();
}

// ── Draw power-up HUD bars ───────────────────────────────────
function drawPowerupHUD(){
  const BAR_W = 80, BAR_H = 8, BAR_X = W - 90, BASE_Y = 14;
  let offset = 0;
  if(shieldActive && shieldTimer > 0){
    const fill = (shieldTimer / SHIELD_DURATION) * BAR_W;
    ctx.save();
    ctx.fillStyle = 'rgba(52,152,219,0.30)';
    ctx.fillRect(BAR_X, BASE_Y + offset, BAR_W, BAR_H);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(BAR_X, BASE_Y + offset, fill, BAR_H);
    ctx.fillStyle    = '#1a4a6b';
    ctx.font         = '9px Segoe UI,sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('SHIELD', BAR_X - 4, BASE_Y + offset + BAR_H * 0.5);
    ctx.restore();
    offset += 16;
  }
  if(scoreBoostActive && scoreBoostTimer > 0){
    const fill = (scoreBoostTimer / BOOST_DURATION) * BAR_W;
    ctx.save();
    ctx.fillStyle = 'rgba(241,196,15,0.30)';
    ctx.fillRect(BAR_X, BASE_Y + offset, BAR_W, BAR_H);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(BAR_X, BASE_Y + offset, fill, BAR_H);
    ctx.fillStyle    = '#1a4a6b';
    ctx.font         = '9px Segoe UI,sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOOST', BAR_X - 4, BASE_Y + offset + BAR_H * 0.5);
    ctx.restore();
    offset += 16;
  }
  if(slowMotionActive && slowMotionTimer > 0){
    const fill = (slowMotionTimer / SLOWMOTION_DURATION) * BAR_W;
    ctx.save();
    ctx.fillStyle = 'rgba(155,89,182,0.30)';
    ctx.fillRect(BAR_X, BASE_Y + offset, BAR_W, BAR_H);
    ctx.fillStyle = '#9b59b6';
    ctx.fillRect(BAR_X, BASE_Y + offset, fill, BAR_H);
    ctx.fillStyle    = '#1a4a6b';
    ctx.font         = '9px Segoe UI,sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('SLOW', BAR_X - 4, BASE_Y + offset + BAR_H * 0.5);
    ctx.restore();
  }
}

// ── Full scene draw (static snapshot for idle/over) ──────────
function drawScene(tick, moving){
  drawSky();
  drawClouds();
  drawBirds(tick);
  drawBird(tick);
  drawGround(moving);
  drawPowerup();
  // Cactus (only draw if not off screen in idle)
  if(obsX < W+10){
    ctx.drawImage(cactusImg, obsX, GROUND-50, 30, 55);
  }
  // Dino
  ctx.drawImage(dinoImg, 40, dinoY-32, 44, 44);
  // Score
  ctx.fillStyle='#1a4a6b';
  ctx.font='bold 15px Segoe UI,sans-serif';
  ctx.fillText('Score: '+score, 12, 22);
  drawPowerupHUD();
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
  const diffConfig = DIFFICULTY_PROFILES[window.selectedDifficulty] || DIFFICULTY_PROFILES.medium;
  // Reset positions
  dinoY=GROUND; dinoVY=0; score=0; obsX=W;
  birdX=-200; birdY=BIRD_Y_LOW; birdActive=false; birdSpawnCooldown=180; shieldActive=false;
  powerupX=-200; powerupActive=false; powerupSpawnCooldown=300;
  shieldTimer=0; scoreBoostActive=false; scoreBoostTimer=0; birdHitCooldown=0; birdWasAbsorbed=false;
  slowMotionActive=false; slowMotionTimer=0;
  stripeOffset=0;
  // Scatter clouds to spread
  clouds[0].x=120; clouds[1].x=340; clouds[2].x=580; clouds[3].x=720;
  // Scatter birds off-screen so they fly in naturally
  birds[0].x=W+100; birds[1].x=W+280; birds[2].x=W+520;
  // Apply cloud/bird speed scaling
  const baseCloudSpeeds = [0.6, 0.4, 0.7, 0.5];
  clouds.forEach((cl, i) => { cl.speed = baseCloudSpeeds[i] * diffConfig.cloudSpeedScale; });
  const baseBirdSpeeds = [2.2, 1.8, 2.5];
  birds.forEach((b, i) => { b.speed = baseBirdSpeeds[i] * diffConfig.cloudSpeedScale; });
  // Disable selector during play
  document.getElementById('difficulty-selector').querySelectorAll('input').forEach(r => r.disabled = true);
  // Update HUD display
  const diffDisplay = document.getElementById('difficulty-display');
  if (diffDisplay) diffDisplay.textContent = window.selectedDifficulty.charAt(0).toUpperCase() + window.selectedDifficulty.slice(1);
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
  // Re-enable difficulty selector
  document.getElementById('difficulty-selector').querySelectorAll('input').forEach(r => r.disabled = false);
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

  // Cactus
  const diffConfig = DIFFICULTY_PROFILES[window.selectedDifficulty] || DIFFICULTY_PROFILES.medium;
  const effectiveObsSpeed = diffConfig.obsSpeed * (slowMotionActive ? 0.5 : 1);
  obsX -= effectiveObsSpeed;
  if(obsX < -40){ obsX=W + diffConfig.obsGapMin + Math.floor(Math.random()*diffConfig.obsGapRange); score += diffConfig.scoreMultiplier * (scoreBoostActive ? 2 : 1); }
  window.gameScore = score;
  window.birdActive = birdActive;
  window.birdX = birdX;
  window.birdY = birdY;
  window.shieldActive = shieldActive;
  window.powerupActive = powerupActive;
  window.powerupType = powerupType;
  window.scoreBoostActive = scoreBoostActive;
  window.shieldTimer = shieldTimer;
  window.scoreBoostTimer = scoreBoostTimer;
  window.birdHitCooldown = birdHitCooldown;
  window.birdWasAbsorbed = birdWasAbsorbed;
  window.slowMotionActive = slowMotionActive;
  window.slowMotionTimer = slowMotionTimer;
  window.effectiveObsSpeed = effectiveObsSpeed;

  // Road stripes scroll
  stripeOffset = (stripeOffset + effectiveObsSpeed) % 110;

  // Clouds
  clouds.forEach(cl=>{
    cl.x -= cl.speed;
    if(cl.x + 70 < 0) cl.x = W + 60;
  });

  // Decorative background birds
  birds.forEach(b=>{
    b.x -= b.speed;
    if(b.x < -20) b.x = W + Math.random()*300 + 100;
    // Gentle up/down drift
    b.y += Math.sin(tick*0.04 + b.flapT)*0.3;
    b.y = Math.max(20, Math.min(85, b.y));
  });

  // Obstacle bird — cooldown, spawn, move
  birdSpawnCooldown--;
  if(!birdActive && birdSpawnCooldown <= 0 && obsX > 300 && score >= 5){
    spawnBird();
    birdSpawnCooldown = 220 + Math.floor(Math.random() * 160);
  }
  if(birdActive){
    birdX -= BIRD_SPEED_BASE * (slowMotionActive ? 0.5 : 1);
    if(birdX < -60){
      // Dodge bonus: only when shield did not absorb this bird
      if(!birdWasAbsorbed) score += 10 * (scoreBoostActive ? 2 : 1);
      birdWasAbsorbed = false;
      birdActive = false;
    }
  }

  // Power-up timers
  if(shieldTimer > 0){ shieldTimer--; if(shieldTimer <= 0){ shieldActive=false; shieldTimer=0; } }
  if(scoreBoostTimer > 0){ scoreBoostTimer--; if(scoreBoostTimer <= 0){ scoreBoostActive=false; scoreBoostTimer=0; } }
  if(slowMotionTimer > 0){ slowMotionTimer--; if(slowMotionTimer <= 0){ slowMotionActive=false; slowMotionTimer=0; } }
  if(birdHitCooldown > 0) birdHitCooldown--;

  // Power-up token — spawn, move, collect
  powerupSpawnCooldown--;
  if(!powerupActive && powerupSpawnCooldown <= 0 && score >= 3){
    spawnPowerup();
    powerupSpawnCooldown = 400 + Math.floor(Math.random() * 200);
  }
  if(powerupActive){
    powerupX -= effectiveObsSpeed;
    if(powerupX < -40){
      powerupActive = false;
    } else {
      // Collection AABB: dino x:40–84, y:(dinoY-32)–(dinoY+12); token circle center x=powerupX+12, y=POWERUP_Y r=12
      const puTop = POWERUP_Y - POWERUP_W * 0.5, puBot = POWERUP_Y + POWERUP_W * 0.5;
      if(powerupX < 84 && powerupX + POWERUP_W > 40 && puTop < dinoY + 12 && puBot > dinoY - 32){
        powerupActive = false;
        if(powerupType === 'shield' && !shieldActive){
          shieldActive = true; shieldTimer = SHIELD_DURATION;
        } else if(powerupType === 'scoreBoost' && !scoreBoostActive){
          scoreBoostActive = true; scoreBoostTimer = BOOST_DURATION;
        } else if(powerupType === 'slowMotion' && !slowMotionActive){
          slowMotionActive = true; slowMotionTimer = SLOWMOTION_DURATION;
        }
      }
    }
  }

  // Draw everything
  drawScene(tick, true);

  // Collision: AABB dino vs obstacle bird (checked before cactus)
  // Dino occupies x:40–84, y:(dinoY-32)–(dinoY+12)
  // Bird hitbox: x:birdX–(birdX+BIRD_W), y:(birdY-11)–(birdY+11)
  if(birdActive && birdHitCooldown <= 0 && birdX < 84 && birdX + BIRD_W > 40 &&
     birdY > dinoY - 43 && birdY < dinoY + 23){
    if(shieldActive){
      // Shield absorbs the hit — bird passes through, no game-over
      shieldActive = false; shieldTimer = 0;
      birdHitCooldown = 30;
      birdWasAbsorbed = true;
    } else {
      birdActive = false;
      gameOver(); return;
    }
  }

  // Collision check (AABB dino vs cactus)
  if(obsX < 84 && obsX > 46 && dinoY > GROUND-28){
    gameOver();
  } else {
    rafId = requestAnimationFrame(loop);
  }
}

// ── Boot ─────────────────────────────────────────────────────
dinoImg.onload = ()=>{
  if(state==='idle') rafId = requestAnimationFrame(drawIdle);
};
