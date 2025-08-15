// Mini spaceship game - HTML5 Canvas
// Controls: Left/Right rotate, Up thrust, Space shoot, R restart
// Debug keys: D = cycle DPR, F = toggle fast spawn, S = toggle ship speed multiplier

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  // use internal resolution for crisp rendering (allows DPR override)
  const rect = canvas.getBoundingClientRect();
  // usedDPR is set by the debug override or falls back to devicePixelRatio
  const usedDPR = canvas._overrideDPR ?? (window.__overrideDPR ?? devicePixelRatio);
  canvas.width = Math.floor(rect.width * usedDPR);
  canvas.height = Math.floor(rect.height * usedDPR);
  ctx.setTransform(usedDPR, 0, 0, usedDPR, 0, 0);
  canvas._usedDPR = usedDPR;
  updateDebug();
}
window.addEventListener('resize', resize);
resize();

const scoreEl = document.getElementById('score');

// Debug / testing controls
const DPR_VALUES = [1, 1.5, 2, (window.devicePixelRatio || 1)];
let dprIndex = DPR_VALUES.indexOf(window.devicePixelRatio) >= 0 ? DPR_VALUES.indexOf(window.devicePixelRatio) : DPR_VALUES.length - 1;
canvas._overrideDPR = DPR_VALUES[dprIndex];

const SPAWN_INTERVAL_BASE = 1200; // base ms used on reset
let spawnFastToggle = false; // toggled by 'F' key
let shipSpeedMult = 1; // toggled by 'S' key

// debug overlay element
const debugEl = document.createElement('div');
debugEl.style.fontSize = '12px';
debugEl.style.opacity = '0.9';
debugEl.style.marginTop = '6px';
debugEl.style.color = 'var(--fg)';
document.getElementById('ui').appendChild(debugEl);
function updateDebug() {
  debugEl.textContent = `DPR: ${canvas._usedDPR}  ·  Spawn interval: ${Math.round(state.spawnInterval)} ms  ·  Ship speed x${shipSpeedMult}`;
}
updateDebug();

let keys = {};
window.addEventListener('keydown', e => {
  // allow toggles for debug keys without interfering with typing
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();

  // DPR cycle: press D
  if (e.code === 'KeyD') {
    dprIndex = (dprIndex + 1) % DPR_VALUES.length;
    canvas._overrideDPR = DPR_VALUES[dprIndex];
    resize();
    console.log('Toggled DPR ->', canvas._overrideDPR);
  }

  // Toggle fast spawn: press F
  if (e.code === 'KeyF') {
    spawnFastToggle = !spawnFastToggle;
    state.spawnInterval = spawnFastToggle ? 500 : SPAWN_INTERVAL_BASE;
    updateDebug();
    console.log('Fast spawn', spawnFastToggle ? 'ON' : 'OFF', '- spawnInterval =', state.spawnInterval);
  }

  // Toggle ship speed multiplier: press S
  if (e.code === 'KeyS') {
    shipSpeedMult = shipSpeedMult === 1 ? 2 : 1;
    updateDebug();
    console.log('Ship speed multiplier set to', shipSpeedMult);
  }
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

// utility
function rand(min, max){ return Math.random()*(max-min)+min; }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

// Game state
const state = {
  ship: null,
  bullets: [],
  asteroids: [],
  score: 0,
  lastSpawn: 0,
  spawnInterval: SPAWN_INTERVAL_BASE, // ms
  lastTime: performance.now(),
  gameOver: false
};

function reset() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  state.ship = {
    x: w/2, y: h/2,
    vx:0, vy:0,
    angle: -Math.PI/2,
    radius: 14,
    thrust: 0
  };
  state.bullets = [];
  state.asteroids = [];
  state.score = 0;
  state.lastSpawn = performance.now();
  state.spawnInterval = spawnFastToggle ? 500 : SPAWN_INTERVAL_BASE;
  state.gameOver = false;
  updateScore();
  updateDebug();
}
reset();

// spawn asteroids at edges
function spawnAsteroid() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  // choose edge
  let x, y, vx, vy;
  const edge = Math.floor(rand(0,4));
  if (edge === 0){ x = -40; y = rand(0,h); vx = rand(0.3,1.1); vy = rand(-0.6,0.6); }
  if (edge === 1){ x = w + 40; y = rand(0,h); vx = rand(-1.1,-0.3); vy = rand(-0.6,0.6); }
  if (edge === 2){ x = rand(0,w); y = -40; vx = rand(-0.6,0.6); vy = rand(0.3,1.1); }
  if (edge === 3){ x = rand(0,w); y = h + 40; vx = rand(-0.6,0.6); vy = rand(-1.1,-0.3); }
  const r = Math.floor(rand(18,44));
  state.asteroids.push({x,y,vx,vy,radius:r,rot:rand(0,Math.PI*2),rotSpeed:rand(-0.02,0.02)});
}

function updateScore(){ scoreEl.textContent = 'Score: ' + state.score; }

function shoot() {
  const s = state.ship;
  const speed = 6;
  const bx = s.x + Math.cos(s.angle) * (s.radius + 6);
  const by = s.y + Math.sin(s.angle) * (s.radius + 6);
  const bvx = s.vx + Math.cos(s.angle) * speed;
  const bvy = s.vy + Math.sin(s.angle) * speed;
  state.bullets.push({x:bx,y:by,vx:bvx,vy:bvy,life:120});
}

function step(dt) {
  const s = state.ship;
  if (!s) return;

  // controls
  if (keys['ArrowLeft'] || keys['KeyA']) s.angle -= 0.0035 * dt;
  if (keys['ArrowRight'] || keys['KeyD']) s.angle += 0.0035 * dt;
  if (keys['ArrowUp'] || keys['KeyW']) {
    const force = 0.0026 * dt * shipSpeedMult; // ship speed multiplier applied here
    s.vx += Math.cos(s.angle) * force;
    s.vy += Math.sin(s.angle) * force;
    s.thrust = 1;
  } else s.thrust = 0;
  if (keys['Space']) {
    if (!state._shotCooldown || performance.now() - state._shotCooldown > 180) {
      shoot();
      state._shotCooldown = performance.now();
    }
  }
  if (keys['KeyR'] && state.gameOver) reset();

  // physics
  s.vx *= 0.999; s.vy *= 0.999; // friction
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  // wrap edges
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (s.x < -50) s.x = w + 50;
  if (s.x > w + 50) s.x = -50;
  if (s.y < -50) s.y = h + 50;
  if (s.y > h + 50) s.y = -50;

  // update bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) state.bullets.splice(i,1);
  }

  // spawn asteroids over time
  const now = performance.now();
  if (now - state.lastSpawn > state.spawnInterval) {
    spawnAsteroid();
    state.lastSpawn = now;
    // slowly increase difficulty
    state.spawnInterval = Math.max(500, state.spawnInterval * 0.98);
    updateDebug();
  }

  // update asteroids
  for (let i = state.asteroids.length - 1; i >= 0; i--) {
    const a = state.asteroids[i];
    a.x += a.vx * dt * 0.9;
    a.y += a.vy * dt * 0.9;
    a.rot += a.rotSpeed * dt;
    // remove if far outside
    if (a.x < -200 || a.x > w + 200 || a.y < -200 || a.y > h + 200) {
      state.asteroids.splice(i,1);
    }
  }

  // collisions: bullets vs asteroids
  for (let i = state.asteroids.length - 1; i >= 0; i--) {
    const a = state.asteroids[i];
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const b = state.bullets[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + 2) {
        // hit
        state.bullets.splice(j,1);
        // break asteroid into smaller pieces or remove
        state.asteroids.splice(i,1);
        state.score += Math.floor(100 - a.radius);
        updateScore();
        // spawn smaller fragments
        if (a.radius > 26) {
          for (let k=0;k<2;k++){
            const nr = a.radius * 0.55;
            state.asteroids.push({
              x: a.x + rand(-10,10),
              y: a.y + rand(-10,10),
              vx: a.vx + rand(-1,1),
              vy: a.vy + rand(-1,1),
              radius: nr,
              rot: rand(0,Math.PI*2),
              rotSpeed: rand(-0.04,0.04)
            });
          }
        }
        break;
      }
    }
  }

  // collisions: ship vs asteroids
  for (let i = state.asteroids.length - 1; i >= 0; i--) {
    const a = state.asteroids[i];
    if (Math.hypot(a.x - s.x, a.y - s.y) < a.radius + s.radius - 4) {
      state.gameOver = true;
    }
  }
}

function drawShip(ship) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  // glow
  if (ship.thrust) {
    ctx.fillStyle = 'rgba(102,240,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(-10,0,10,6,0,0,Math.PI*2);
    ctx.fill();
  }
  // ship body (triangle)
  ctx.fillStyle = '#cfe8ff';
  ctx.beginPath();
  ctx.moveTo(16,0);
  ctx.lineTo(-12,10);
  ctx.lineTo(-8,0);
  ctx.lineTo(-12,-10);
  ctx.closePath();
  ctx.fill();
  // thruster flame
  if (ship.thrust) {
    ctx.fillStyle = '#69e0ff';
    ctx.beginPath();
    ctx.moveTo(-8, -5);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-8, 5);
    ctx.fill();
  }
  ctx.restore();
}

function drawAsteroid(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  ctx.fillStyle = '#8aa6b8';
  ctx.beginPath();
  // draw rough polygon
  const spikes = Math.max(6, Math.floor(a.radius/6));
  for (let i=0;i<spikes;i++){
    const ang = (i/spikes)*Math.PI*2;
    const rad = a.radius * (0.75 + 0.5*Math.sin(i*3 + a.rot));
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function render() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);

  // background stars
  ctx.fillStyle = '#051018';
  ctx.fillRect(0,0,w,h);

  // subtle stars (static for now)
  ctx.fillStyle = '#123';
  for (let i=0;i<50;i++){
    // simple deterministic-ish placement
    const x = (i * 73) % w;
    const y = ((i*91) % h);
    ctx.fillRect(x, y, 1, 1);
  }

  // asteroids
  for (const a of state.asteroids) drawAsteroid(a);

  // bullets
  ctx.fillStyle = '#bfefff';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.6, 0, Math.PI*2);
    ctx.fill();
  }

  // ship
  drawShip(state.ship);

  // overlay messages
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,h/2 - 48, w, 96);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '22px system-ui, Arial';
    ctx.fillText('GAME OVER — press R to restart', w/2, h/2 + 6);
  }
}

function loop(now) {
  const dt = Math.min(40, now - state.lastTime); // ms
  state.lastTime = now;
  if (!state.gameOver) step(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// give initial asteroids
for (let i=0;i<4;i++) spawnAsteroid();