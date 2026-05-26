/* =====================================================
   DEAD ZONE — Zombie Shooter (JUICED & ULTRA ENHANCED EDITION + AMMO DROPS)
   game.js — High fidelity game engine with responsive drops & screen effects
   ===================================================== */

"use strict";

// ─────────────────────────────────────────────────────
//  CONSTANTS & EXTENDED CONFIG (JUICED UP!)
// ─────────────────────────────────────────────────────
const CFG = {
  PLAYER_SPEED:    200, 
  PLAYER_MAX_HP:   100,
  PLAYER_SIZE:     22,
  PLAYER_COLOR:    "#39ff14",

  BULLET_SPEED:    650, 
  BULLET_SIZE:     5,
  BULLET_COLOR:    "#ffffff",
  BULLET_LIFETIME: 1.0,

  ZOMBIE_BASE_SPEED:  60,
  ZOMBIE_SIZE:        26,    
  ZOMBIE_HP:          3,
  ZOMBIE_DAMAGE:      8,
  ZOMBIE_ATK_RATE:    1.2,   
  ZOMBIE_SCORE:       100,

  MAG_SIZE:           30,
  MAX_RESERVE_AMMO:   120,
  RELOAD_TIME:        1.5,   

  WAVE_SPAWN_COUNT:   6,     
  WAVE_SPAWN_SCALE:   5,     
  SPAWN_MARGIN:       60,    

  // Ammo Drops System Integration Configurations
  AMMO_DROP_CHANCE:   0.25,  // 25% Drop Probability per Kill
  AMMO_DROP_AMOUNT:   30,    // Refills 30 bullets into Reserve Ammo
  AMMO_BOX_SIZE:      14,    
};

// ─────────────────────────────────────────────────────
//  GAME STATE & CRAFTPIX ASSETS
// ─────────────────────────────────────────────────────
let canvas, ctx;
let W, H;
let state = "menu"; 

let player, bullets, zombies, particles, ammoDrops;
let score, kills, wave, waveZombiesLeft, waveZombiesSpawned, spawning;
let reloading, reloadTimer, reloadDuration;
let magAmmo, reserveAmmo;
let shootCooldown;

// Juiciness Variables
let screenShake = 0;
let comboCount = 0;
let comboTimer = 0;
let maxCombo = 0;
let flashWhiteActive = 0; 

const keys = {};
let mouse = { x: 0, y: 0, down: false };
let lastTime = 0;

// Preloading CraftPix Minotaur Attack Frames (12 frames)
const minotaurAttackFrames = [];
const MINOTAUR_FRAME_COUNT = 12;

for (let i = 0; i < MINOTAUR_FRAME_COUNT; i++) {
  const img = new Image();
  const frameNum = String(i).padStart(3, '0');
  img.src = `assets/Minotaur_01_Attacking_${frameNum}.png`;
  minotaurAttackFrames.push(img);
}

// Player image placeholder 
const imgPlayer = new Image();
imgPlayer.src = "player.png"; 
let usePlayerImage = false;
imgPlayer.onload = () => { usePlayerImage = true; };

// ─────────────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────────────
const screenStart    = document.getElementById("screen-start");
const screenGame     = document.getElementById("screen-game");
const screenGameover = document.getElementById("screen-gameover");
const btnStart       = document.getElementById("btn-start");
const btnRestart     = document.getElementById("btn-restart");
const btnMenu        = document.getElementById("btn-menu");

const hudScore      = document.getElementById("hud-score");
const hudHpFill     = document.getElementById("hud-hp-fill");
const hudHpText     = document.getElementById("hud-hp-text");
const hudAmmo       = document.getElementById("hud-ammo");
const hudReloadWrap = document.getElementById("hud-reload-bar-wrap");
const hudReloadBar  = document.getElementById("hud-reload-bar");
const waveBanner    = document.getElementById("wave-banner");
const waveText      = document.getElementById("wave-text");

const goScore = document.getElementById("go-score");
const goKills = document.getElementById("go-kills");
const goWave  = document.getElementById("go-wave");

// Damage flash overlay
const damageFlash = document.createElement("div");
damageFlash.id = "damage-flash";
document.body.appendChild(damageFlash);

// Inject dynamic combo text style & layout element on HUD
const comboDisplay = document.createElement("div");
comboDisplay.style.position = "absolute";
comboDisplay.style.bottom = "30px";
comboDisplay.style.left = "30px";
comboDisplay.style.fontFamily = "'Press Start 2P', monospace";
comboDisplay.style.fontSize = "20px";
comboDisplay.style.color = "#ffaa00";
comboDisplay.style.textShadow = "0 0 10px #ff3300, 2px 2px 0 #000";
comboDisplay.style.pointerEvents = "none";
comboDisplay.style.display = "none";
comboDisplay.style.zIndex = "100";
document.body.appendChild(comboDisplay);

// ─────────────────────────────────────────────────────
//  SCREEN MANAGEMENT
// ─────────────────────────────────────────────────────
function showScreen(name) {
  screenStart.classList.remove("active");
  screenGame.classList.remove("active");
  screenGameover.classList.remove("active");
  if (name === "menu")     screenStart.classList.add("active");
  if (name === "game")     screenGame.classList.add("active");
  if (name === "gameover") screenGameover.classList.add("active");
}

// ─────────────────────────────────────────────────────
//  INIT / RESET
// ─────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById("game-canvas");
  ctx    = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "r" && state === "playing") startReload();
  });
  window.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);
  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top)  * (canvas.height / r.height);
  });
  canvas.addEventListener("mousedown", e => { if(e.button===0){ mouse.down=true; tryShoot(); }});
  canvas.addEventListener("mouseup",   e => { if(e.button===0) mouse.down=false; });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  btnStart.addEventListener("click",   startGame);
  btnRestart.addEventListener("click", startGame);
  btnMenu.addEventListener("click",    () => showScreen("menu"));

  showScreen("menu");
}

function resize() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  W = canvas.width;
  H = canvas.height;
}

function startGame() {
  state = "playing";
  score = 0; kills = 0; wave = 0;
  comboCount = 0; comboTimer = 0; maxCombo = 0;
  magAmmo      = CFG.MAG_SIZE;
  reserveAmmo  = CFG.MAX_RESERVE_AMMO;
  reloading    = false; reloadTimer = 0;
  shootCooldown = 0;
  screenShake = 0;
  flashWhiteActive = 0;

  player = {
    x: W / 2, y: H / 2,
    hp: CFG.PLAYER_MAX_HP,
    maxHp: CFG.PLAYER_MAX_HP,
    invincible: 0,
  };

  bullets   = [];
  zombies   = [];
  particles = [];
  ammoDrops = []; // Empty the drops array on initial session reset

  showScreen("game");
  updateHUD();
  nextWave();
  requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────
//  WAVE SYSTEM
// ─────────────────────────────────────────────────────
function nextWave() {
  wave++;
  waveZombiesLeft    = CFG.WAVE_SPAWN_COUNT + (wave - 1) * CFG.WAVE_SPAWN_SCALE;
  waveZombiesSpawned = 0;
  spawning           = true;
  showWaveBanner(`WAVE  ${wave}`);
  
  flashWhiteActive = 0.3;
  screenShake = 15;
  
  scheduleSpawns();
}

function scheduleSpawns() {
  const total = waveZombiesLeft;
  for (let i = 0; i < total; i++) {
    setTimeout(() => {
      if (state !== "playing") return;
      spawnZombie();
      waveZombiesSpawned++;
      if (waveZombiesSpawned >= total) spawning = false;
    }, i * Math.max(200, 600 - (wave * 30)));
  }
}

function showWaveBanner(text) {
  waveText.textContent = text;
  waveBanner.classList.remove("hidden");
  setTimeout(() => waveBanner.classList.add("hidden"), 2200);
}

function spawnZombie() {
  let x, y;
  const side = Math.floor(Math.random() * 4);
  const m = CFG.SPAWN_MARGIN;
  if (side === 0) { x = rand(-m, W + m); y = -m; }
  else if (side === 1) { x = W + m; y = rand(-m, H + m); }
  else if (side === 2) { x = rand(-m, W + m); y = H + m; }
  else { x = -m; y = rand(-m, H + m); }

  const speedMult = 1 + (wave - 1) * 0.14;
  const hpMult    = 1 + (wave - 1) * 0.45;
  
  const isElite = wave > 1 && Math.random() < 0.20;

  zombies.push({
    x, y,
    hp:    Math.ceil(CFG.ZOMBIE_HP * hpMult * (isElite ? 2.5 : 1)),
    maxHp: Math.ceil(CFG.ZOMBIE_HP * hpMult * (isElite ? 2.5 : 1)),
    speed: CFG.ZOMBIE_BASE_SPEED * speedMult * (isElite ? 0.75 : 1),
    isElite,
    atkTimer: 0,
    flashTimer: 0,
    wobble: rand(0, Math.PI * 2),
    
    animFrame: 0,
    animTimer: 0,
    animSpeed: isElite ? 0.10 : 0.06
  });
  
  spawnPortalSpark(x, y);
}

// ─────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────
function loop(ts) {
  if (state !== "playing") return;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  update(dt);
  draw(dt); 
  requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────
//  UPDATE
// ─────────────────────────────────────────────────────
function update(dt) {
  if (mouse.down && shootCooldown <= 0 && !reloading) tryShoot();
  if (shootCooldown > 0) shootCooldown -= dt;

  if (screenShake > 0) screenShake -= dt * 40;
  if (screenShake < 0) screenShake = 0;

  if (flashWhiteActive > 0) flashWhiteActive -= dt;

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboCount = 0;
      comboDisplay.style.display = "none";
    } else {
      comboDisplay.textContent = `${comboCount}X COMBO!`;
      comboDisplay.style.transform = `scale(${1 + Math.min(comboCount * 0.03, 0.5)})`;
    }
  }

  updatePlayer(dt);
  updateBullets(dt);
  updateZombies(dt);
  updateAmmoDrops(dt); // Tracking player collection collision fields
  updateParticles(dt);
  checkWaveComplete();
}

function updatePlayer(dt) {
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"])    dy -= 1;
  if (keys["s"] || keys["arrowdown"])  dy += 1;
  if (keys["a"] || keys["arrowleft"])  dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;

  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

  player.x = clamp(player.x + dx * CFG.PLAYER_SPEED * dt, CFG.PLAYER_SIZE, W - CFG.PLAYER_SIZE);
  player.y = clamp(player.y + dy * CFG.PLAYER_SPEED * dt, CFG.PLAYER_SIZE, H - CFG.PLAYER_SIZE);

  if (player.invincible > 0) player.invincible -= dt;

  if (reloading) {
    reloadTimer += dt;
    const pct = Math.min(reloadTimer / reloadDuration, 1);
    hudReloadBar.style.width = (pct * 100) + "%";
    hudReloadBar.style.transition = "none";
    if (reloadTimer >= reloadDuration) finishReload();
  }
}

function tryShoot() {
  if (reloading) return;
  if (magAmmo <= 0) { startReload(); return; }

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const spread = rand(-0.06, 0.06);
  bullets.push({
    x: player.x + Math.cos(angle) * 22,
    y: player.y + Math.sin(angle) * 22,
    vx: Math.cos(angle + spread) * CFG.BULLET_SPEED,
    vy: Math.sin(angle + spread) * CFG.BULLET_SPEED,
    life: CFG.BULLET_LIFETIME,
  });

  screenShake = Math.min(screenShake + 3, 10);

  for (let i = 0; i < 7; i++) {
    const a = angle + rand(-0.5, 0.5);
    particles.push({
      x: player.x + Math.cos(angle) * 24,
      y: player.y + Math.sin(angle) * 24,
      vx: Math.cos(a) * rand(100, 250),
      vy: Math.sin(a) * rand(100, 250),
      life: rand(0.08, 0.16), maxLife: 0.16,
      size: rand(2, 5),
      color: i % 2 === 0 ? "#ffaa00" : "#ff3300",
      type: "spark"
    });
  }

  magAmmo--;
  shootCooldown = 0.09; 
  updateHUD();
  if (magAmmo === 0) startReload();
}

function startReload() {
  if (reloading || reserveAmmo === 0) return;
  reloading        = true;
  reloadTimer      = 0;
  reloadDuration   = CFG.RELOAD_TIME;
  hudReloadWrap.style.display = "block";
  hudReloadBar.style.width    = "0%";
}

function finishReload() {
  const needed = CFG.MAG_SIZE - magAmmo;
  const take   = Math.min(needed, reserveAmmo);
  magAmmo     += take;
  reserveAmmo -= take;
  reloading    = false;
  hudReloadWrap.style.display = "none";
  updateHUD();
  
  for(let i=0; i<16; i++) {
    const a = (i / 16) * Math.PI * 2;
    particles.push({
      x: player.x, y: player.y,
      vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
      life: 0.25, maxLife: 0.25,
      size: 2, color: "#39ff14", type: "spark"
    });
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x   += b.vx * dt;
    b.y   += b.vy * dt;
    b.life -= dt;

    if (Math.random() < 0.6) {
      particles.push({
        x: b.x, y: b.y,
        vx: rand(-30, 30), vy: rand(-30, 30),
        life: 0.08, maxLife: 0.08,
        size: 2, color: "#ffee66", type: "spark"
      });
    }

    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      bullets.splice(i, 1); continue;
    }

    let hit = false;
    for (let j = zombies.length - 1; j >= 0; j--) {
      const z = zombies[j];
      const zRadius = z.isElite ? CFG.ZOMBIE_SIZE * 1.8 : CFG.ZOMBIE_SIZE;
      const dist = distance(b.x, b.y, z.x, z.y);
      
      if (dist < zRadius + CFG.BULLET_SIZE) {
        z.hp--;
        z.flashTimer = 0.12;
        screenShake = Math.min(screenShake + 4, 14);

        spawnBlood(z.x, z.y, 8, z.isElite);
        spawnSparks(b.x, b.y, 4);

        if (z.hp <= 0) {
          spawnBlood(z.x, z.y, z.isElite ? 45 : 22, z.isElite);
          
          // ── AMMO DROP CHANCE CALCULATION ──
          if (Math.random() < CFG.AMMO_DROP_CHANCE) {
            ammoDrops.push({
              x: z.x,
              y: z.y,
              pulse: rand(0, Math.PI * 2),
              life: 12.0 // Box stays on ground for 12 seconds before expiring
            });
          }

          comboCount++;
          comboTimer = 3.5; 
          comboDisplay.style.display = "block";
          if(comboCount > maxCombo) maxCombo = comboCount;

          score += CFG.ZOMBIE_SCORE * (z.isElite ? 3 : 1) * comboCount;
          kills++;
          zombies.splice(j, 1);
          waveZombiesLeft--;
          updateHUD();
        }
        bullets.splice(i, 1);
        hit = true;
        break;
      }
    }
    if (hit) continue;
  }
}

function updateZombies(dt) {
  for (const z of zombies) {
    const angle = Math.atan2(player.y - z.y, player.x - z.x);
    z.wobble  += dt * (z.isElite ? 2 : 4);
    const wobA = Math.sin(z.wobble) * 0.25;
    z.x += Math.cos(angle + wobA) * z.speed * dt;
    z.y += Math.sin(angle + wobA) * z.speed * dt;

    if (z.flashTimer > 0) z.flashTimer -= dt;

    const zRadius = z.isElite ? CFG.ZOMBIE_SIZE * 1.6 : CFG.ZOMBIE_SIZE;
    const dist = distance(z.x, z.y, player.x, player.y);
    if (dist < CFG.PLAYER_SIZE + zRadius) {
      z.atkTimer += dt;
      if (z.atkTimer >= 1 / CFG.ZOMBIE_ATK_RATE) {
        z.atkTimer = 0;
        if (player.invincible <= 0) {
          playerTakeDamage(z.isElite ? CFG.ZOMBIE_DAMAGE * 2 : CFG.ZOMBIE_DAMAGE);
        }
      }
    } else {
      z.atkTimer = Math.max(z.atkTimer - dt, 0);
    }
  }
}

// ─────────────────────────────────────────────────────
//  AMMO DROPS UPDATE & COLLECTION INTERACTION LOGIC
// ─────────────────────────────────────────────────────
function updateAmmoDrops(dt) {
  for (let i = ammoDrops.length - 1; i >= 0; i--) {
    const drop = ammoDrops[i];
    drop.pulse += dt * 5;
    drop.life -= dt;

    // Check expiration timeline decay
    if (drop.life <= 0) {
      ammoDrops.splice(i, 1);
      continue;
    }

    // Measure distance vector to player center bounds
    const dist = distance(drop.x, drop.y, player.x, player.y);
    if (dist < CFG.PLAYER_SIZE + CFG.AMMO_BOX_SIZE) {
      // Award Ammo Box Contents safely bounded by max storage limit
      reserveAmmo = Math.min(reserveAmmo + CFG.AMMO_DROP_AMOUNT, CFG.MAX_RESERVE_AMMO * 2);
      updateHUD();

      // Trigger high-satisfaction amber colored collection ring burst
      for (let p = 0; p < 12; p++) {
        const ang = (p / 12) * Math.PI * 2;
        particles.push({
          x: drop.x, y: drop.y,
          vx: Math.cos(ang) * 140, vy: Math.sin(ang) * 140,
          life: 0.2, maxLife: 0.2,
          size: rand(2.5, 4.5),
          color: "#ffaa00",
          type: "spark"
        });
      }

      // Add a clean floating text indicator above pickup position
      createFloatingText("+30 AMMO", drop.x, drop.y - 10);

      // Remove item from active container tracking arrays
      ammoDrops.splice(i, 1);
    }
  }
}

function createFloatingText(txt, x, y) {
  // Directly append floating sparks mimicking text vectors or spark trails 
  for(let i=0; i<6; i++) {
    particles.push({
      x: x + rand(-10, 10), y: y - i*4,
      vx: rand(-10, 10), vy: -60,
      life: 0.4, maxLife: 0.4,
      size: rand(3, 5), color: "#ffaa00", type: "spark"
    });
  }
}

function playerTakeDamage(amount) {
  player.hp = Math.max(0, player.hp - amount);
  player.invincible = 0.4;
  screenShake = 24; 
  showDamageFlash();
  updateHUD();
  if (player.hp <= 0) triggerGameOver();
}

function showDamageFlash() {
  damageFlash.classList.add("active");
  setTimeout(() => damageFlash.classList.remove("active"), 160);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    
    if(p.type === "blood") {
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function checkWaveComplete() {
  if (!spawning && zombies.length === 0 && waveZombiesLeft <= 0) {
    spawning = true; 
    setTimeout(() => {
      if (state === "playing") nextWave();
    }, 1500);
  }
}

function spawnBlood(x, y, count, isElite) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(40, isElite ? 350 : 220);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.4, 1.2), maxLife: 1.2,
      size: rand(2.5, isElite ? 7 : 5),
      color: i % 4 === 0 ? "#4a0000" : i % 2 === 0 ? "#cc0000" : "#ff1111",
      type: "blood"
    });
  }
}

function spawnSparks(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(80, 180);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.1, 0.25), maxLife: 0.25,
      size: rand(1.5, 3),
      color: "#ffffff",
      type: "spark"
    });
  }
}

function spawnPortalSpark(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = rand(0, Math.PI * 2);
    particles.push({
      x, y,
      vx: Math.cos(angle) * rand(50, 100),
      vy: Math.sin(angle) * rand(50, 100),
      life: 0.4, maxLife: 0.4,
      size: rand(2, 4),
      color: "#ff3300",
      type: "spark"
    });
  }
}

// ─────────────────────────────────────────────────────
//  DRAW 
// ─────────────────────────────────────────────────────
function draw(dt) {
  ctx.save();
  
  if (screenShake > 0) {
    const dx = rand(-screenShake, screenShake);
    const dy = rand(-screenShake, screenShake);
    ctx.translate(dx, dy);
  }

  ctx.clearRect(0, 0, W, H);

  drawGrid();
  drawParticlesBelow();

  // ── DRAW FLOATING AMMO DROP BOXES ──
  for (const drop of ammoDrops) {
    ctx.save();
    const scaleFactor = 1 + Math.sin(drop.pulse) * 0.15; // Beautiful sizing heartbeat pulse animation
    ctx.translate(drop.x, drop.y);
    ctx.scale(scaleFactor, scaleFactor);
    
    // Add bright sci-fi amber neon glow drop perimeter ring
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffaa00";
    ctx.fillStyle = "#ffaa00";
    
    // Draw outer technical chest square
    const sz = CFG.AMMO_BOX_SIZE;
    ctx.fillRect(-sz/2, -sz/2, sz, sz);
    
    // Draw inner cross detail item decoration
    ctx.fillStyle = "#000000";
    ctx.fillRect(-sz/6, -sz/2 + 2, sz/3, sz - 4);
    ctx.fillRect(-sz/2 + 2, -sz/6, sz - 4, sz/3);
    ctx.restore();
  }

  for (const b of bullets) {
    ctx.save();
    ctx.shadowBlur  = 16;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle   = CFG.BULLET_COLOR;
    ctx.beginPath();
    ctx.arc(b.x, b.y, CFG.BULLET_SIZE, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const z of zombies) drawZombie(z, dt);

  drawPlayer();
  drawParticlesAbove();

  ctx.save();
  ctx.beginPath();
  ctx.arc(player.x, player.y, 200, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(57,255,20,0.06)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 12]);
  ctx.stroke();
  ctx.restore();

  ctx.restore(); 

  if (flashWhiteActive > 0) {
    ctx.save();
    ctx.globalAlpha = flashWhiteActive;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(57, 255, 20, 0.025)"; 
  ctx.lineWidth   = 1;
  const gs = 64;
  for (let x = 0; x < W; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += gs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const p = player;
  const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  ctx.save();
  ctx.translate(p.x, p.y);

  if (usePlayerImage) {
    ctx.rotate(angle);
    if (p.invincible > 0) {
      ctx.shadowBlur  = 25;
      ctx.shadowColor = "#ff0000";
    } else {
      ctx.shadowBlur  = 15;
      ctx.shadowColor = "#39ff14";
    }
    const size = CFG.PLAYER_SIZE * 2.8;
    ctx.drawImage(imgPlayer, -size / 2, -size / 2, size, size);
  } else {
    if (p.invincible > 0) {
      ctx.shadowBlur  = 25;
      ctx.shadowColor = "#ff0000";
    } else {
      ctx.shadowBlur  = 18;
      ctx.shadowColor = "#39ff14";
    }

    ctx.fillStyle = p.invincible > 0 ? "#ff4444" : CFG.PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, CFG.PLAYER_SIZE * 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(12, -3, 18, 6);   
    ctx.fillStyle = "#000000";
    ctx.fillRect(18, -2, 4, 4); 
    ctx.fillStyle = "#aaffaa";
    ctx.fillRect(4, -5, 10, 10);   
  }

  ctx.restore();

  const bw = 40, bh = 5;
  const hpPct = p.hp / p.maxHp;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(p.x - bw/2, p.y - CFG.PLAYER_SIZE - 12, bw, bh);
  ctx.fillStyle = hpPct > 0.5 ? "#39ff14" : hpPct > 0.25 ? "#ffaa00" : "#ff1111";
  ctx.fillRect(p.x - bw/2, p.y - CFG.PLAYER_SIZE - 12, bw * hpPct, bh);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(p.x - bw/2, p.y - CFG.PLAYER_SIZE - 12, bw, bh);
}

function drawZombie(z, dt) {
  z.animTimer += dt;
  if (z.animTimer >= z.animSpeed) {
    z.animTimer = 0;
    z.animFrame = (z.animFrame + 1) % MINOTAUR_FRAME_COUNT;
  }

  const angle = Math.atan2(player.y - z.y, player.x - z.x);

  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(angle);

  const flash = z.flashTimer > 0;
  
  if (z.isElite) {
    ctx.shadowBlur  = flash ? 35 : 22;
    ctx.shadowColor = flash ? "#ffffff" : "#ff3300"; 
  } else {
    ctx.shadowBlur  = flash ? 25 : 12;
    ctx.shadowColor = flash ? "#ff4444" : "#880000";
  }

  const currentFrameImg = minotaurAttackFrames[z.animFrame];
  const size = CFG.ZOMBIE_SIZE * (z.isElite ? 7.5 : 3.8); 
  
  if (currentFrameImg && currentFrameImg.complete && currentFrameImg.naturalWidth !== 0) {
    ctx.drawImage(currentFrameImg, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = flash ? "#ffffff" : z.isElite ? "#5e290d" : "#a65d32";
    const boxSize = z.isElite ? CFG.ZOMBIE_SIZE * 1.8 : CFG.ZOMBIE_SIZE;
    ctx.fillRect(-boxSize, -boxSize, boxSize * 2, boxSize * 2);
  }

  ctx.restore();

  const bw = z.isElite ? 50 : 30, bh = 4;
  const hpPct = z.hp / z.maxHp;
  const zHeightOffset = z.isElite ? 30 : 15;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(z.x - bw/2, z.y - CFG.ZOMBIE_SIZE - zHeightOffset, bw, bh);
  ctx.fillStyle = z.isElite ? "#ffaa00" : "#cc0000";
  ctx.fillRect(z.x - bw/2, z.y - CFG.ZOMBIE_SIZE - zHeightOffset, bw * hpPct, bh);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(z.x - bw/2, z.y - CFG.ZOMBIE_SIZE - zHeightOffset, bw, bh);
}

function drawParticlesBelow() {
  for (const p of particles) {
    if (p.type === "blood") {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawParticlesAbove() {
  for (const p of particles) {
    if (p.type === "spark") {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────
//  HUD UPDATE
// ─────────────────────────────────────────────────────
function updateHUD() {
  hudScore.textContent = String(score).padStart(6, "0");

  const hpPct = (player.hp / player.maxHp) * 100;
  hudHpFill.style.width = hpPct + "%";
  hudHpText.textContent = `${player.hp} / ${player.maxHp}`;
  hudHpFill.classList.remove("hp-mid", "hp-low");
  if (hpPct <= 25)      hudHpFill.classList.add("hp-low");
  else if (hpPct <= 50) hudHpFill.classList.add("hp-mid");

  hudAmmo.textContent = reloading
    ? "RELOADING…"
    : `${magAmmo} / ${reserveAmmo}`;
}

// ─────────────────────────────────────────────────────
//  GAME OVER
// ─────────────────────────────────────────────────────
function triggerGameOver() {
  state = "gameover";
  goScore.textContent = String(score).padStart(6, "0");
  goKills.textContent = kills;
  goWave.textContent  = `${wave} (Max Combo: ${maxCombo}x)`;
  comboDisplay.style.display = "none";
  setTimeout(() => showScreen("gameover"), 600);
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function distance(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

window.addEventListener("DOMContentLoaded", init);
