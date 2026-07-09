// ============================================================
// Tentacalendar — celebrate.js
// Version 0.1.0
// The dopamine engine. celebrate(level):
//   1 = task done (confetti pop)
//   2 = project stage done (double burst + streamers)
//   3 = PROJECT COMPLETE (fireworks + Katie's wave)
// Variants are randomized so it never gets stale.
// ============================================================

let canvas = null, ctx = null, parts = [], raf = null;

const PALETTES = [
  ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc"], // tier ROYGBIV
  ["#4dd0c4", "#80e8de", "#b2f5ee", "#e6fffa", "#ffd43b"],            // ocean + gold
  ["#ff8787", "#ffc078", "#8ce99a", "#74c0fc", "#e599f7"],            // pastel pop
  ["#ffd700", "#ffec99", "#fff3bf", "#ffffff"]                        // gold rush
];

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:100;";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function spawnBurst(x, y, count, palette, speed = 7) {
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2);
    const v = rand(speed * 0.3, speed);
    parts.push({
      x, y,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v - 2,
      g: 0.18,
      life: rand(50, 90),
      size: rand(3, 7),
      color: pick(palette),
      shape: pick(["rect", "circle"]),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.25, 0.25)
    });
  }
}

function spawnStreamers(palette) {
  for (let i = 0; i < 26; i++) {
    parts.push({
      x: rand(0, canvas.width), y: -10,
      vx: rand(-1, 1), vy: rand(2, 4.5),
      g: 0.02, life: rand(120, 200),
      size: rand(6, 11), color: pick(palette),
      shape: "ribbon", rot: rand(0, Math.PI * 2), vr: rand(-0.3, 0.3)
    });
  }
}

function spawnRocket(palette) {
  const x = rand(canvas.width * 0.15, canvas.width * 0.85);
  parts.push({
    x, y: canvas.height + 10,
    vx: rand(-0.6, 0.6), vy: rand(-13, -10.5),
    g: 0.16, life: rand(55, 75),
    size: 3.5, color: pick(palette),
    shape: "circle", rocket: true, palette,
    rot: 0, vr: 0
  });
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life--;
    if (p.rocket && (p.vy > -1.5 || p.life <= 0)) {
      spawnBurst(p.x, p.y, 55, p.palette, 6);
      parts.splice(i, 1);
      continue;
    }
    if (p.life <= 0 || p.y > canvas.height + 20) {
      parts.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === "ribbon") {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2.2);
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(loop) : (ctx.clearRect(0, 0, canvas.width, canvas.height), null);
}

function kick() {
  if (!raf) raf = requestAnimationFrame(loop);
}

/** Sweep Katie's wave across the whole screen (CSS-driven). */
function wave() {
  document.body.classList.remove("celebration-wave");
  void document.body.offsetWidth; // restart animation
  document.body.classList.add("celebration-wave");
  setTimeout(() => document.body.classList.remove("celebration-wave"), 2000);
}

/**
 * @param {1|2|3} level
 * @param {{x?:number, y?:number}} at  optional origin (e.g., the checkbox that was clicked)
 */
export function celebrate(level = 1, at = {}) {
  ensureCanvas();
  const palette = pick(PALETTES);
  const x = at.x ?? canvas.width / 2;
  const y = at.y ?? canvas.height / 2;

  if (level === 1) {
    const variant = pick(["pop", "double", "shower"]);
    if (variant === "pop") spawnBurst(x, y, 34, palette);
    else if (variant === "double") { spawnBurst(x, y, 24, palette); setTimeout(() => { spawnBurst(x + rand(-80, 80), y + rand(-60, 20), 24, palette); kick(); }, 140); }
    else { spawnBurst(x, y, 20, palette, 5); spawnStreamers(palette); }
  } else if (level === 2) {
    spawnBurst(x, y, 60, palette, 8);
    spawnStreamers(palette);
    setTimeout(() => { spawnBurst(rand(canvas.width * .2, canvas.width * .8), rand(canvas.height * .2, canvas.height * .5), 45, palette); kick(); }, 200);
  } else {
    // PROJECT COMPLETE. Full send.
    wave();
    for (let i = 0; i < 6; i++) setTimeout(() => { spawnRocket(palette); kick(); }, i * 260);
    spawnStreamers(palette);
    setTimeout(() => { spawnStreamers(pick(PALETTES)); kick(); }, 900);
  }
  kick();
}
