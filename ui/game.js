const c = document.getElementById('game');
if(!c) { console.error('Canvas element not found'); }
const ctx = c?.getContext('2d');
if(!ctx) { console.error('Failed to get 2D context'); }
const W = 800, H = 250;  // logical canvas size
if(c){ c.width = W; c.height = H; }

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

// ── Terrain switching (Dynamic Desert ↔ Ice) ────────────────
let terrain              = 'desert';       // 'desert' | 'ice'
let terrainSwitchTriggered = false;        // Prevents duplicate triggers
let terrainSwitchScore   = -1;             // Score at which switch occurred

window.gameScore = 0;

// ── Difficulty profiles ─────────────────────────────────────
const DIFFICULTY_PROFILES = {
  easy:   { obsSpeed: 4, obsGapMin: 250, obsGapRange: 200, scoreMultiplier: 1, cloudSpeedScale: 0.6 },
  medium: { obsSpeed: 6, obsGapMin: 0,   obsGapRange: 200, scoreMultiplier: 1, cloudSpeedScale: 1.0 },
  hard:   { obsSpeed: 9, obsGapMin: 0,   obsGapRange: 100, scoreMultiplier: 2, cloudSpeedScale: 1.4 },
};
window.selectedDifficulty = 'medium';

// ── Terrain color palettes ──────────────────────────────────
const TERRAIN_COLORS = {
  desert: {
    skyGradient: ['#5ba3d9', '#acd8f0', '#d4ecfb'],
    groundColor: '#c8a96e',
    roadColor: '#7a7a7a',
    roadEdgeLine: '#ffffff',
    cloudColor: 'rgba(255,255,255,0.92)',
    stripeColor: '#ffff99'
  },
  ice: {
    skyGradient: ['#87ceeb', '#b3d9e8', '#d8f0ff'],
    groundColor: '#e8f4f8',
    roadColor: '#a0c8d8',
    roadEdgeLine: '#d0e8f0',
    cloudColor: 'rgba(240,248,255,0.95)',
    stripeColor: '#66bbff'
  }
};

document.querySelectorAll('input[name="difficulty"]').forEach(r => {
  r.addEventListener('change', e => {
    window.selectedDifficulty = e.target.value;
    // Reset terrain if user changes difficulty during gameplay
    if(state === 'running' && terrain !== 'desert') {
      terrain = 'desert';
      terrainSwitchTriggered = false;
    }
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
function fetchHighScore(){
  fetch('http://localhost:3000/score')
    .then(r => r.json())
    .then(d => { 
      if(highScoreEl && d.highScore !== undefined) {
        highScoreEl.textContent = 'High Score: ' + d.highScore;
      }
    })
    .catch(err => {
      console.warn('Failed to fetch high score:', err);
      if(highScoreEl) highScoreEl.textContent = 'High Score: 0';
    });
}

// Load high score on page load
fetchHighScore();

// ── Sound effects (Web Audio API) ───────────────────────────
const _audioCtx = (() => {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; }
})();
function playSound(type){
  if(!_audioCtx) return;
  try {
    if(_audioCtx.state === 'suspended') _audioCtx.resume();
    const o = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    o.connect(g); g.connect(_audioCtx.destination);
    const t = _audioCtx.currentTime;
    if(type === 'jump'){
      o.type = 'sine';
      o.frequency.setValueAtTime(280, t);
      o.frequency.exponentialRampToValueAtTime(560, t + 0.12);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.15);
    } else if(type === 'die'){
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(380, t);
      o.frequency.exponentialRampToValueAtTime(75, t + 0.35);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.35);
    } else if(type === 'land'){
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.start(t); o.stop(t + 0.1);
    }
  } catch(e){}
}

// ── Dust particles ───────────────────────────────────────────
const particles = [];
function spawnDust(x, y){
  for(let i = 0; i < 6; i++){
    particles.push({
      x: x + (Math.random()-0.5)*22,
      y,
      vx: (Math.random()-0.5)*2.2,
      vy: -Math.random()*1.8 - 0.2,
      life: 18 + Math.floor(Math.random()*10),
      r: 2 + Math.random()*3.5
    });
  }
}
function updateDrawParticles(){
  for(let i = particles.length-1; i >= 0; i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    if(p.life <= 0){ particles.splice(i,1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life / 28;
    ctx.fillStyle = '#c8a96e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Milestone toast ──────────────────────────────────────────
const SCORE_MILESTONES = [50, 100, 200, 300, 500, 750, 1000];
let milestoneText = '', milestoneTimer = 0;
function checkMilestone(prev, next){
  for(const m of SCORE_MILESTONES){
    if(prev < m && next >= m){ milestoneText = `✦ ${m} pts!`; milestoneTimer = 90; break; }
  }
}
function drawMilestone(){
  if(milestoneTimer <= 0) return;
  const alpha = Math.min(1, milestoneTimer / 25);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 20px Segoe UI,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(241,196,15,0.9)';
  ctx.fillText(milestoneText, W/2, H/2 - 28);
  ctx.restore();
  milestoneTimer--;
}

// ── Screen flash ─────────────────────────────────────────────
let flashAlpha = 0, flashColor = '#ff4757';
function triggerFlash(color, alpha){ flashColor = color; flashAlpha = alpha; }
function drawFlash(){
  if(flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.fillStyle = flashColor;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flashAlpha = Math.max(0, flashAlpha - 0.045);
}

// ── Input ───────────────────────────────────────────────────
let jumpKeyHeld = false;
document.addEventListener('keydown', e=>{
  if(state==='running' && dinoY>=GROUND && !jumpKeyHeld){
    dinoVY = JUMP_V;
    jumpKeyHeld = true;
    playSound('jump');
  }
});
document.addEventListener('keyup', ()=>{
  jumpKeyHeld = false;
  // Variable height: cut upward velocity on early release
  if(state==='running' && dinoVY < -7) dinoVY = -7;
});
startBtn.addEventListener('click', ()=>{
  if(state==='idle'||state==='over') startGame();
});

// ── Helpers ─────────────────────────────────────────────────
function setStatus(msg){ if(statusEl) statusEl.textContent=msg; }

// ── Draw sky gradient ────────────────────────────────────────
function drawSky(terrainType = 'desert'){
  const colors = TERRAIN_COLORS[terrainType].skyGradient;
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);
}

// ── Draw ground / road ───────────────────────────────────────
function drawGround(moving, terrainType = 'desert'){
  const colors = TERRAIN_COLORS[terrainType];
  // Soil strip
  ctx.fillStyle = colors.groundColor;
  ctx.fillRect(0,198,W,H-198);
  // Road surface
  ctx.fillStyle = colors.roadColor;
  ctx.fillRect(0,196,W,20);
  // Road edge lines
  ctx.fillStyle = colors.roadEdgeLine;
  ctx.fillRect(0,196,W,2);
  ctx.fillRect(0,214,W,2);
  // Dashed centre stripes
  ctx.fillStyle = colors.stripeColor;
  const offset = moving ? stripeOffset : 0;
  for(let i=0;i<12;i++){
    const sx = ((i*110 - offset) % (W+110) + W+110) % (W+110) - 50;
    ctx.fillRect(sx,204,60,4);
  }
}

// ── Draw clouds ──────────────────────────────────────────────
function drawClouds(terrainType = 'desert'){
  const cloudColor = TERRAIN_COLORS[terrainType].cloudColor;
  clouds.forEach(cl=>{
    ctx.fillStyle = cloudColor;
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

// ── Draw obstacle bird (trex-ui-skill: Cyber aesthetic) ─────────────────────
// Altitude-coded neon colour: red = low threat (must jump), cyan = high (apex timing).
// Wings driven by physics-like sine with ±9 px displacement — transform only.
// Motion trail via two ghost frames using globalAlpha (opacity) — no layout impact.
// Glow via ctx.shadowBlur — composited on GPU. Zero per-frame allocations.
function drawBird(tick){
  if(!birdActive) return;
  const flap      = Math.sin(tick * 0.22) * 9;          // ±9 px wing displacement
  const isLow     = birdY >= BIRD_Y_LOW;
  const bodyColor = isLow ? '#ff4757' : '#00d2ff';      // neon red | cyan
  const wingColor = isLow ? '#ff6b81' : '#74f7ff';
  const glowColor = isLow ? 'rgba(255,71,87,0.65)' : 'rgba(0,210,255,0.65)';

  // Trail ghost 1 (trailing behind in flight direction)
  ctx.save();
  ctx.globalAlpha = 0.18;
  _drawBirdShape(birdX + BIRD_SPEED_BASE * 2, birdY, flap, wingColor, bodyColor);
  ctx.restore();

  // Trail ghost 2
  ctx.save();
  ctx.globalAlpha = 0.08;
  _drawBirdShape(birdX + BIRD_SPEED_BASE * 4, birdY, flap, wingColor, bodyColor);
  ctx.restore();

  // Main bird — neon glow (shadowBlur = GPU-composited, no layout recalc)
  ctx.save();
  ctx.shadowBlur  = 12;
  ctx.shadowColor = glowColor;
  ctx.globalAlpha = 1;
  _drawBirdShape(birdX, birdY, flap, wingColor, bodyColor);
  ctx.restore();
}

// Stateless inner helper — pure transform/opacity ops, no object allocation per call
function _drawBirdShape(x, y, flap, wingColor, bodyColor){
  // Body ellipse
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(x + BIRD_W * 0.5, y, BIRD_W * 0.27, BIRD_H * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.ellipse(x + BIRD_W * 0.82, y - 3, 7, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Beak (accent colour for altitude cue contrast)
  ctx.fillStyle = '#ffd32a';
  ctx.beginPath();
  ctx.moveTo(x + BIRD_W * 0.82 + 6, y - 3);
  ctx.lineTo(x + BIRD_W * 0.82 + 14, y - 1);
  ctx.lineTo(x + BIRD_W * 0.82 + 6,  y + 1);
  ctx.closePath();
  ctx.fill();

  // Eye white
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + BIRD_W * 0.82 + 2, y - 5, 2, 0, Math.PI * 2);
  ctx.fill();
  // Eye pupil
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(x + BIRD_W * 0.82 + 3, y - 5, 1, 0, Math.PI * 2);
  ctx.fill();

  // Tail fan
  ctx.fillStyle = wingColor;
  ctx.beginPath();
  ctx.moveTo(x + 5,  y - 1);
  ctx.lineTo(x - 9,  y - 7);
  ctx.lineTo(x - 6,  y);
  ctx.lineTo(x - 9,  y + 7);
  ctx.closePath();
  ctx.fill();

  // Wings — physics-based quadratic flap (translate only, no width/height change)
  ctx.strokeStyle = wingColor;
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  // Left wing
  ctx.moveTo(x + BIRD_W * 0.5 - 2, y - 1);
  ctx.quadraticCurveTo(x + BIRD_W * 0.22, y - flap - 4, x + 2,           y + flap * 0.4);
  // Right wing
  ctx.moveTo(x + BIRD_W * 0.5 + 2, y - 1);
  ctx.quadraticCurveTo(x + BIRD_W * 0.78, y - flap - 4, x + BIRD_W - 2, y + flap * 0.4);
  ctx.stroke();
}

// ── Check and apply terrain switch (observer pattern) ─────
function checkTerrainTrigger(){
  // Only trigger in Easy Mode, at score >= 5, and only once per game
  if(window.selectedDifficulty === 'easy' && score >= 5 && !terrainSwitchTriggered){
    applyTerrainSwitch();
  }
}

// ── Apply terrain switch (state mutation) ──────────────────
function applyTerrainSwitch(){
  terrain = 'ice';
  terrainSwitchTriggered = true;
  terrainSwitchScore = score;
  console.log(`🌨️  Terrain switched to Ice at score ${score}`);
}

// ── Full scene draw (static snapshot for idle/over) ──────────
function drawScene(tick, moving){
  drawSky(terrain);
  drawClouds(terrain);
  drawBirds(tick);
  drawBird(tick);
  drawGround(moving, terrain);
  // Cactus (only draw if not off screen in idle)
  if(obsX < W+10){
    ctx.drawImage(cactusImg, obsX, GROUND-50, 30, 55);
  }
  // Dino
  ctx.drawImage(dinoImg, 40, dinoY-32, 44, 44);
  // Dust particles (above ground, below score)
  updateDrawParticles();
  // Score
  ctx.fillStyle='#1a4a6b';
  ctx.font='bold 15px Segoe UI,sans-serif';
  ctx.fillText('Score: '+score, 12, 22);
  drawMilestone();
  drawFlash();
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
  birdX=-200; birdY=BIRD_Y_LOW; birdActive=false; birdSpawnCooldown=180;
  stripeOffset=0;
  // Reset terrain to desert
  terrain='desert';
  terrainSwitchTriggered=false;
  terrainSwitchScore=-1;
  particles.length=0; milestoneTimer=0; flashAlpha=0; jumpKeyHeld=false;
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
  playSound('die');
  triggerFlash('#ff4757', 0.38);
  startBtn.textContent='Restart';
  setStatus('Game Over! Score: '+score+' — click Restart to play again');
  // Re-enable difficulty selector
  document.getElementById('difficulty-selector').querySelectorAll('input').forEach(r => r.disabled = false);
  // Draw frozen scene
  drawScene(0, false);
  // Update high score on API
  fetch('http://localhost:3000/score/'+score, {method:'POST'})
    .then(r => r.json())
    .then(d => { 
      if(highScoreEl && d.highScore !== undefined) {
        highScoreEl.textContent = 'High Score: ' + d.highScore;
      }
    })
    .catch(err => {
      console.warn('Failed to update high score:', err);
    });
}

// ── Main game loop ───────────────────────────────────────────
let tick = 0;
let _wasAirborne = false;
function loop(){
  if(state!=='running') return;
  tick++;

  // Physics
  const _airborne = dinoY < GROUND;
  dinoVY += GRAVITY;
  dinoY  += dinoVY;
  if(dinoY >= GROUND){
    dinoY=GROUND; dinoVY=0;
    if(_airborne){ spawnDust(62, GROUND+2); playSound('land'); } // landing feedback
  }

  // Cactus
  const diffConfig = DIFFICULTY_PROFILES[window.selectedDifficulty] || DIFFICULTY_PROFILES.medium;
  const effectiveObsSpeed = diffConfig.obsSpeed;
  obsX -= effectiveObsSpeed;
  if(obsX < -40){
    obsX=W + diffConfig.obsGapMin + Math.floor(Math.random()*diffConfig.obsGapRange);
    const prevScore = score;
    score += diffConfig.scoreMultiplier;
    checkMilestone(prevScore, score);
    // Check terrain trigger after score update (read-only observer)
    checkTerrainTrigger();
  }
  window.gameScore = score;
  window.birdActive = birdActive;
  window.birdX = birdX;
  window.birdY = birdY;
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
    birdX -= BIRD_SPEED_BASE;
    if(birdX < -60){
      score += 10;
      birdActive = false;
    }
  }

  // Draw everything
  drawScene(tick, true);

  // Collision: AABB dino vs obstacle bird (checked before cactus)
  // Dino occupies x:40–84, y:(dinoY-32)–(dinoY+12)
  // Bird hitbox: x:birdX–(birdX+BIRD_W), y:(birdY-11)–(birdY+11)
  if(birdActive && birdX < 84 && birdX + BIRD_W > 40 &&
     birdY > dinoY - 43 && birdY < dinoY + 23){
    birdActive = false;
    gameOver(); return;
  }

  // Collision check (AABB dino vs cactus)
  if(obsX < 84 && obsX > 46 && dinoY > GROUND-28){
    gameOver();
    return;
  }

  // Continue animation loop
  if(state === 'running') {
    rafId = requestAnimationFrame(loop);
  }
}

// ── Boot ─────────────────────────────────────────────────────
let imagesLoaded = 0;
const totalImages = 2;  // dinoImg, cactusImg

dinoImg.onload = () => {
  imagesLoaded++;
  if(imagesLoaded === totalImages && state === 'idle') {
    rafId = requestAnimationFrame(drawIdle);
  }
};

cactusImg.onload = () => {
  imagesLoaded++;
  if(imagesLoaded === totalImages && state === 'idle') {
    rafId = requestAnimationFrame(drawIdle);
  }
};

// Fallback: Start game loop after short delay even if images fail
setTimeout(() => {
  if(state === 'idle' && !rafId) {
    console.warn('Starting game without waiting for all images');
    rafId = requestAnimationFrame(drawIdle);
  }
}, 1500);

// Initial render
if(ctx && state === 'idle') {
  drawScene(0, false);
}
