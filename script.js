/* Drive Mad — simple canvas driving game
   Controls:
   - Desktop: ArrowLeft / ArrowRight
   - Mobile: on-screen buttons
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const speedEl = document.getElementById('speed');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const tryAgain = document.getElementById('tryAgain');

const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

const gameOverUI = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');

let W = 480, H = 720;
let scale = 1;

// resize canvas responsively while keeping internal resolution fixed
function fitCanvas() {
  const containerW = Math.min(480, Math.max(320, Math.floor(window.innerWidth * 0.9)));
  const ratio = containerW / 480;
  canvas.style.width = (480 * ratio) + 'px';
  canvas.style.height = (720 * ratio) + 'px';
  scale = ratio;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

// ---- Game State ----
let running = false;
let paused = false;
let score = 0;
let highscore = Number(localStorage.getItem('drive_mad_high') || 0);
highEl.textContent = highscore;

let speedMultiplier = 1;   // global game speed; increases
speedEl.textContent = speedMultiplier.toFixed(2);

// Player
const player = {
  w: 48,
  h: 88,
  x: (W/2) - 24,
  y: H - 140,
  color: '#0ea5a4',
  vx: 6
};

// Road lanes & edges
const road = {
  left: 60,
  right: W - 60,
  laneCount: 3
};

// Obstacles (other cars) and pickups (fuel)
let obstacles = [];
let pickups = [];

let frame = 0;
let spawnInterval = 90; // frames between spawns (will decrease as speed increases)
let rng = (n) => Math.floor(Math.random()*n);

// Controls
let keys = { left:false, right:false };
document.addEventListener('keydown', (e)=>{
  if(e.key === 'ArrowLeft') keys.left = true;
  if(e.key === 'ArrowRight') keys.right = true;
});
document.addEventListener('keyup', (e)=>{
  if(e.key === 'ArrowLeft') keys.left = false;
  if(e.key === 'ArrowRight') keys.right = false;
});
leftBtn && leftBtn.addEventListener('touchstart', ()=> keys.left=true);
leftBtn && leftBtn.addEventListener('touchend', ()=> keys.left=false);
rightBtn && rightBtn.addEventListener('touchstart', ()=> keys.right=true);
rightBtn && rightBtn.addEventListener('touchend', ()=> keys.right=false);

// Buttons
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', resetGame);
tryAgain && tryAgain.addEventListener('click', ()=>{ resetGame(); startGame(); });

// helpers
function randLaneX(laneIndex) {
  const laneW = (road.right - road.left) / road.laneCount;
  return road.left + laneIndex * laneW + (laneW - player.w)/2;
}

// Spawn obstacle car
function spawnObstacle() {
  const lane = rng(road.laneCount);
  const w = 44;
  const h = 88;
  const x = randLaneX(lane);
  const y = -h - rng(80);
  const colors = ['#ef4444','#f43f5e','#f97316','#7c3aed','#ef7bff'];
  obstacles.push({
    x, y, w, h, speed: 2 + Math.random()*2 + speedMultiplier*0.6, color: colors[rng(colors.length)]
  });
}

// Spawn fuel pickup
function spawnPickup() {
  const lane = rng(road.laneCount);
  const size = 28;
  const x = randLaneX(lane) + (player.w - size)/2;
  const y = -size - rng(60);
  pickups.push({ x, y, size, speed: 2 + speedMultiplier*0.6 });
}

// Collision helpers
function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

// Draw functions
function drawRoad() {
  // road background
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(road.left - 20, 0, road.right - road.left + 40, H);

  // side grass
  ctx.fillStyle = '#0b6623';
  ctx.fillRect(0,0,road.left - 20,H);
  ctx.fillRect(road.right + 20,0,W,H);

  // lane lines
  const laneW = (road.right - road.left) / road.laneCount;
  ctx.fillStyle = '#e6e6e6';
  for(let i=1;i<road.laneCount;i++){
    const lx = road.left + i*laneW;
    // dashed line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.setLineDash([20,18]);
    ctx.beginPath();
    ctx.moveTo(lx, -Math.abs((frame*5)%38));
    ctx.lineTo(lx, H+40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // border edges
  ctx.fillStyle = '#111827';
  ctx.fillRect(road.left-12,0,12,H);
  ctx.fillRect(road.right,0,12,H);
}

function drawPlayer() {
  ctx.fillStyle = player.color;
  // simple car with roof
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = '#0b1224';
  ctx.fillRect(player.x+6, player.y+10, player.w-12, player.h-32);
  // wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(player.x+6, player.y+player.h-12, 14, 8);
  ctx.fillRect(player.x+player.w-20, player.y+player.h-12, 14, 8);
}

function drawObstacles() {
  obstacles.forEach(o=>{
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#111';
    ctx.fillRect(o.x+6, o.y+6, o.w-12, 18);
  });
}

function drawPickups() {
  pickups.forEach(p=>{
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(p.x + p.size/2, p.y + p.size/2, p.size/2, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#063'; ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⛽', p.x + p.size/2, p.y + p.size/2);
  });
}

// update loop
function update() {
  if(!running || paused) return;

  frame++;
  // spawn logic
  if(frame % Math.max(30, Math.floor(spawnInterval - speedMultiplier*6)) === 0){
    spawnObstacle();
    if(Math.random() < 0.25) spawnPickup();
  }

  // increase difficulty gradually
  if(frame % 600 === 0) {
    speedMultiplier += 0.15;
    speedEl.textContent = speedMultiplier.toFixed(2);
  }

  // move obstacles
  obstacles.forEach(o => {
    o.y += o.speed * (1 + speedMultiplier*0.25);
  });
  obstacles = obstacles.filter(o => o.y < H + 200);

  // move pickups
  pickups.forEach(p => p.y += p.speed * (1 + speedMultiplier*0.25));
  pickups = pickups.filter(p => p.y < H + 200);

  // player controls
  if(keys.left) player.x -= player.vx;
  if(keys.right) player.x += player.vx;
  // bounds
  const laneMargin = road.left + 6;
  player.x = Math.max(laneMargin, Math.min(road.right - player.w - 6, player.x));

  // collisions with obstacle
  for(let o of obstacles) {
    if(rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h}, {x:o.x,y:o.y,w:o.w,h:o.h})) {
      // collision -> game over
      endGame();
      return;
    }
  }

  // pickups
  for(let i = pickups.length -1; i >=0; i--){
    const p = pickups[i];
    if(rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h}, {x:p.x,y:p.y,w:p.size,h:p.size})) {
      // collect
      pickups.splice(i,1);
      score += 15;
      speedMultiplier = Math.max(0.9, speedMultiplier - 0.08); // slightly slow down to reward
      speedEl.textContent = speedMultiplier.toFixed(2);
      continue;
    }
  }

  // score increases with time
  score += 0.1 + speedMultiplier*0.05;
  scoreEl.textContent = Math.floor(score);

  // remove off-screen obstacles and reward for passing them
  obstacles = obstacles.filter(o=>{
    if(o.y > H + 100){
      score += 2; // small reward
      return false;
    }
    return true;
  });
}

// draw frame
function render() {
  // clear
  ctx.clearRect(0,0,W,H);
  drawRoad();
  drawPickups();
  drawObstacles();
  drawPlayer();
}

// game loop
let raf;
function loop(){
  update();
  render();
  raf = requestAnimationFrame(loop);
}

// start & stop
function startGame(){
  if(running) return;
  running = true;
  paused = false;
  frame = 0;
  score = 0;
  obstacles = [];
  pickups = [];
  speedMultiplier = 1;
  player.x = (W/2) - player.w/2;
  spawnInterval = 100;
  scoreEl.textContent = '0';
  speedEl.textContent = speedMultiplier.toFixed(2);
  gameOverUI.classList.add('hidden');
  cancelAnimationFrame(raf);
  loop();
}

function togglePause(){
  if(!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  if(!paused) loop();
}

function endGame(){
  running = false;
  cancelAnimationFrame(raf);
  // show game over UI
  finalScore.textContent = Math.floor(score);
  gameOverUI.classList.remove('hidden');
  // save highscore
  if(Math.floor(score) > highscore){
    highscore = Math.floor(score);
    localStorage.setItem('drive_mad_high', highscore);
    highEl.textContent = highscore;
  }
}

function resetGame(){
  running = false;
  paused = false;
  cancelAnimationFrame(raf);
  frame = 0;
  score = 0;
  obstacles = [];
  pickups = [];
  speedMultiplier = 1;
  player.x = (W/2) - player.w/2;
  scoreEl.textContent = '0';
  speedEl.textContent = '1.00';
  gameOverUI.classList.add('hidden');
}

// init canvas internal resolution
function initCanvasSize(){
  canvas.width = W;
  canvas.height = H;
  // road boundaries depend on W
  road.left = Math.floor(W * 0.13);
  road.right = Math.floor(W * 0.87);
}
initCanvasSize();

// attach UI
startBtn.disabled = false;
pauseBtn.disabled = false;
restartBtn.disabled = false;

// touch friendly: prevent scrolling on game area when touching controls
document.getElementById('mobileControls')?.addEventListener('touchstart', (e)=>{ e.preventDefault(); });

// keep loop paused when tab not active
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && running) {
    paused = true;
    pauseBtn.textContent = 'Resume';
  }
});

