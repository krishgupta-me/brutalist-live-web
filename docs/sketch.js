function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noSmooth();
  // …rest of your setup
}
// === Brutalist Live Video — v4 (recording + responsive HUD) ============================
// Modes & controls are same as before, plus:
//  • REC button (top-right) or key P to start/stop PNG sequence capture
//  • X cancels recording
//  • HUD auto-scales to fit width (no overflow) and collapses swatches if needed

// ----------------------------------------------------------------------------------------
// Camera / buffers
let cam, camW = 320, camH = 240;
let buffer = [];
let maxFrames = 140;
let ringIdx = 0;

// State
let paused = false;
let mode = 3;                // start on Mode 3
let showGrain = true;
let showHUD = true;

// Palettes (bg, c1..c4)
const PALETTES = [
  { name: 'Brutal High-Contrast', c: ['#0b0b0b','#f2f2f2','#e63946','#ffd166','#06d6a0'] },
  { name: 'Gilded Brut',          c: ['#0b0b0b','#fafafa','#d4af37','#c1121f','#3a86ff'] },
  { name: 'Neon Candy',           c: ['#0b0b0b','#eeeeee','#00f5d4','#f15bb5','#fee440'] },
  { name: 'Pop Pastel',           c: ['#0b0b0b','#f7f7f7','#9bf6ff','#ffd6a5','#ffadad'] },
  { name: 'Monochrome + Gold',    c: ['#0b0b0b','#eaeaea','#b08d57','#717171','#1a1a1a'] },
  { name: 'Cyber Teal/Magenta',   c: ['#0b0b0b','#e6f7ff','#00e5ff','#ff2e88','#8cff00'] },
  { name: 'Toxic Green',          c: ['#0b0b0b','#e7ffe7','#00ff5e','#b7ff00','#00ffa8'] },
  { name: 'Heatmap',              c: ['#0b0b0b','#ffe6e6','#ff9e00','#ff3b3b','#8a00ff'] },
  { name: 'Desert Film',          c: ['#0b0b0b','#f5e9da','#d7a86e','#a47e3c','#5b3d1a'] },
  { name: 'Kodak 400',            c: ['#0b0b0b','#f3ede2','#ffd200','#2f2f2f','#e34f4f'] },
  { name: 'Steel & Rust',         c: ['#0b0b0b','#dfe7ef','#7a8a99','#c45d3c','#2b2b2b'] },
  { name: 'Aurora',               c: ['#0b0b0b','#eaf6ff','#37a3ff','#00ffd5','#8a5cf6'] },
  { name: 'Bubblegum',            c: ['#0b0b0b','#fff0fa','#ff79c6','#8be9fd','#50fa7b'] },
  { name: 'Mango Lassi',          c: ['#0b0b0b','#fff1c9','#ffc300','#ff7b54','#6a4c93'] },
  { name: 'Mumbai Local',         c: ['#0b0b0b','#f2efe9','#ff6b35','#2d6cdf','#ffba08'] },
  { name: 'Greyblock',            c: ['#0b0b0b','#f5f5f5','#9e9e9e','#6b6b6b','#2e2e2e'] },
  { name: 'Mint Chocolate',       c: ['#0b0b0b','#e9fff5','#7fffd4','#3dcca3','#5b3a29'] },
  { name: 'Infrared',             c: ['#0b0b0b','#eae7ff','#ff0054','#ff5400','#00f5d4'] },
  { name: 'Sapphire Blaze',       c: ['#0b0b0b','#e7f0ff','#1e88e5','#0d47a1','#ff5252'] },
  { name: 'Street Poster',        c: ['#0b0b0b','#f2f2f2','#ff1b1c','#00c2ff','#ffde59'] },
];
let palIdx = 0;
let pal = PALETTES[palIdx].c;

// Quality / offscreen for Mode 3
const QUAL_LEVELS = [1.0, 0.75, 0.5];
let qualIdx = 0;
let workW, workH, pgSmall;

// Mode 3 style + params
// 0: SOFT GRADE, 1: CUTOUT, 2: INK
let styleIdx = 0;
let posterLevels = 5;   // 3..6
let sep = 0.6;          // 0..1 separation strength
let edgeOn = false;     // soft edges toggle
let edgeAlpha = 60;     // 0..255

// Recording
let recOn = false;
let recTarget = 120;    // number of frames to capture
let recCount = 0;
let recEvery = 1;       // capture every Nth frame
let recLabel = '';      // shown in HUD
let recButton = { x: 0, y: 0, w: 88, h: 34 }; // computed each frame

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noSmooth();

  cam = createCapture({ video: { width: camW, height: camH, facingMode: "user" }, audio: false });
  cam.size(camW, camH);
  cam.hide();

  for (let i = 0; i < maxFrames; i++) buffer[i] = createImage(camW, camH);

  textFont('monospace');
  textAlign(CENTER, CENTER);

  setupOffscreen();
}

function setupOffscreen() {
  const s = QUAL_LEVELS[qualIdx];
  workW = floor(camW * s);
  workH = floor(camH * s);
  pgSmall = createGraphics(workW, workH);
  pgSmall.pixelDensity(1);
  pgSmall.noSmooth();
}

function draw() {
  if (paused) return;

  // store latest frame (p5.Image) into ring buffer
  buffer[ringIdx] = cam.get(0, 0, camW, camH);
  ringIdx = (ringIdx + 1) % maxFrames;

  background(pal[0]);

  // Interaction
  const spd = map(constrain(mouseX, 0, width), 0, width, 0.2, 4.0);
  const scaleAmt = min(width / camW, height / camH);
  const stripe = floor(map(constrain(mouseY, 0, height), 0, height, 3, 28));

  push();
  translate(width / 2, height / 2);
  scale(scaleAmt, scaleAmt);
  translate(-camW / 2, -camH / 2);

  if (mode === 1) renderSlitScan(spd, stripe);
  else if (mode === 2) renderBlockGlitch(spd, stripe);
  else renderMode3(spd);

  pop();

  // Frame border
  noFill(); stroke(240); strokeWeight(6);
  rect(3, 3, width - 6, height - 6);

  if (showHUD) overlayHUD();

  // Grain last so it sits on top
  if (showGrain) grain(900);

  // Recording: save frames
  if (recOn && (frameCount % recEvery === 0)) {
    const fname = `seq_${Date.now()}_${nf(recCount, 4)}`;
    saveCanvas(fname, 'png');
    recCount++;
    if (recCount >= recTarget) stopRecording();
  }
}

// ==================== MODE 1 — SLIT-SCAN ===================================
function renderSlitScan(spd, stripe) {
  const rows = ceil(camH / stripe);
  for (let r = 0; r < rows; r++) {
    const y = r * stripe;
    const phase = r * 0.35;
    const t = frameCount * 0.01 * spd + phase;
    const k = floor((sin(t) * 0.5 + 0.5) * (maxFrames - 1));
    const src = buffer[(ringIdx - 1 - k + maxFrames) % maxFrames];

    const xJitter = floor(map(noise(r * 0.12, t), 0, 1, -6, 6));
    push();
    translate(xJitter, 0);
    copy(src, 0, y, camW, stripe, 0, y, camW, stripe);
    pop();
  }
}

// ==================== MODE 2 — GLITCH MOSAIC ================================
function renderBlockGlitch(spd, block) {
  const cols = ceil(camW / block);
  const rows = ceil(camH / block);
  const t = frameCount * 0.008 * spd;

  noStroke();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = floor((noise(x * 0.21, y * 0.21, t) ** 1.4) * (maxFrames - 1));
      const src = buffer[(ringIdx - 1 - k + maxFrames) % maxFrames];
      const sx = x * block, sy = y * block;
      const tearX = floor(map(noise(y * .09, t * 1.2), 0, 1, -3, 3));
      const tearY = floor(map(noise(x * .09, t * 1.2), 0, 1, -3, 3));
      copy(src, sx, sy, block, block, sx + tearX, sy + tearY, block, block);
    }
  }
}

// ==================== MODE 3 — SOFT GRADE / CUTOUT / INK ====================
function renderMode3(spd) {
  const src = buffer[(ringIdx - 1 + maxFrames) % maxFrames];

  // Downscale to offscreen
  pgSmall.push();
  pgSmall.clear();
  pgSmall.image(src, 0, 0, workW, workH);
  pgSmall.pop();

  if (styleIdx === 0) {
    // SOFT GRADE — video feel, gentle palette pull
    pgSmall.filter(BLUR, 1);
    softGradeToPalette(pgSmall, pal, sep);
    image(pgSmall, 0, 0, camW, camH);
    if (edgeOn) drawEdgesSoft(src, edgeAlpha);
  } else if (styleIdx === 1) {
    // CUTOUT — clean poster with readable separation
    pgSmall.filter(POSTERIZE, constrain(posterLevels, 3, 6));
    cutoutMap(pgSmall, pal, sep);
    image(pgSmall, 0, 0, camW, camH);
    if (edgeOn) drawEdgesSoft(src, edgeAlpha);
  } else {
    // INK — inky fill + soft edges
    pgSmall.filter(POSTERIZE, constrain(posterLevels, 3, 6));
    cutoutMap(pgSmall, pal, sep * 0.85);
    image(pgSmall, 0, 0, camW, camH);
    drawEdgesSoft(src, edgeAlpha + 20);
  }
}

// --- SOFT GRADE: lerp each pixel toward nearest palette color (gentle) -----
function softGradeToPalette(g, palette, strength) {
  g.loadPixels();
  const p = g.pixels;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i+1], b = p[i+2];
    const target = nearestColor([r, gg, b], palette, 1); // skip bg
    p[i]   = r  + (red(target)   - r)  * strength;
    p[i+1] = gg + (green(target) - gg) * strength;
    p[i+2] = b  + (blue(target)  - b)  * strength;
  }
  g.updatePixels();
}

// --- CUTOUT: map luminance bands to exact palette after slight contrast -----
function cutoutMap(g, palette, strength) {
  g.loadPixels();
  const p = g.pixels;
  const k = 0.25 + 0.75 * strength; // 0.25..1 (contrast push)
  const bands = palette.length - 1;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i], gg = p[i+1], b = p[i+2];
    r  = 128 + (r  - 128) * (1 + k);
    gg = 128 + (gg - 128) * (1 + k);
    b  = 128 + (b  - 128) * (1 + k);
    const v = 0.21 * r + 0.72 * gg + 0.07 * b;
    const idx = Math.max(1, Math.min(bands, Math.floor((v / 255) * bands)));
    const col = color(palette[idx]);
    p[i] = red(col); p[i+1] = green(col); p[i+2] = blue(col);
  }
  g.updatePixels();
}

// --- Nearest color in palette (skip index 0 background) --------------------
function nearestColor(rgb, palette, startIndex) {
  let best = null, bestD = 1e12;
  for (let j = startIndex; j < palette.length; j++) {
    const c = color(palette[j]);
    const dr = rgb[0] - red(c);
    const dg = rgb[1] - green(c);
    const db = rgb[2] - blue(c);
    const d = dr*dr + dg*dg + db*db;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best || color(palette[1]);
}

// --- Soft edges from original frame (downscaled → blurred → alpha tint) ----
function drawEdgesSoft(srcImg, alphaVal) {
  const w = workW, h = workH;
  const g = createGraphics(w, h);
  g.pixelDensity(1);
  g.image(srcImg, 0, 0, w, h);

  g.loadPixels();
  const p = g.pixels;
  const out = new Uint8ClampedArray(p);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i  = 4 * (y * w + x);
      const iR = 4 * (y * w + x + 1);
      const iD = 4 * ((y + 1) * w + x);
      const dx = Math.abs(p[i]-p[iR]) + Math.abs(p[i+1]-p[iR+1]) + Math.abs(p[i+2]-p[iR+2]);
      const dy = Math.abs(p[i]-p[iD]) + Math.abs(p[i+1]-p[iD+1]) + Math.abs(p[i+2]-p[iD+2]);
      const e = Math.min(255, (dx + dy) * 0.35);
      out[i]   = Math.max(0, p[i]   - e);
      out[i+1] = Math.max(0, p[i+1] - e);
      out[i+2] = Math.max(0, p[i+2] - e);
      out[i+3] = alphaVal; // constant alpha for softness
    }
  }
  g.pixels.set(out);
  g.updatePixels();
  g.filter(BLUR, 0.6);

  push();
  tint(255, alphaVal);
  image(g, 0, 0, camW, camH);
  pop();
}

// ==================== HUD / Grain / REC button =============================
function overlayHUD() {
  // ---------- Top title block (auto-fit) ----------
  const modeName = (mode===1?'SLIT-SCAN':mode===2?'GLITCH MOSAIC':('MODE 3 — ' + ['SOFT GRADE','CUTOUT','INK'][styleIdx]));
  const label =
    `${modeName} — Q:${QUAL_LEVELS[qualIdx]} ${edgeOn?'E:on':'E:off'} — L:${posterLevels} — Sep:${nf(sep,1,2)} — ${PALETTES[palIdx].name}`;

  // Base size then scale down to fit safely
  let base = min(width, height) * 0.06;
  textSize(base);
  let pad = 18;
  let tw = textWidth(label);
  let maxW = width - 24; // margin
  let scaleFactor = min(1, (maxW - pad*2) / max(1, tw));
  let ts = max(14, base * scaleFactor); // clamp to readable
  textSize(ts);

  // Box height depends on text size
  const boxH = ts * 1.6;
  fill(0, 180);
  noStroke();
  rectMode(CENTER);
  rect(width * 0.5, ts * 1.2, min(maxW, tw*scaleFactor + pad*2), boxH, 10);

  fill(245);
  textAlign(CENTER, CENTER);
  text(label, width * 0.5, ts * 1.2);

  // Swatches — collapse if narrow
  let showSwatches = width > 560;
  if (showSwatches) {
    const sw = 16, gap = 4;
    let rowW = (sw + gap) * pal.length - gap;
    let x0 = width * 0.5 - rowW / 2;
    let y0 = ts * 1.2 + boxH * 0.45;
    rectMode(CORNER);
    for (let i = 0; i < pal.length; i++) {
      stroke(30); strokeWeight(1); fill(pal[i]);
      rect(x0 + i * (sw + gap), y0, sw, sw, 3);
    }
  }

  // ---------- Controls line (auto-fit) ----------
  const controls =
    '1/2/3: modes | [ / ]: palettes | R: random | M: style | L: posterize | -/=: separation | Q: quality | E: edges | G: grain | T: HUD | S: save | P: rec | X: cancel';
  textSize(max(12, ts * 0.28));
  fill(220);
  text(controls, width * 0.5, ts * 1.2 + boxH * (showSwatches ? 1.0 : 0.7));

  // ---------- REC button (top-right) ----------
  const btnPad = 10;
  recButton.w = 88; recButton.h = 34;
  recButton.x = width - recButton.w - btnPad;
  recButton.y = btnPad;
  const isRec = recOn;
  fill(isRec ? '#ff3b3b' : '#1f1f1f');
  stroke(isRec ? '#ffd6d6' : '#444');
  strokeWeight(2);
  rectMode(CORNER);
  rect(recButton.x, recButton.y, recButton.w, recButton.h, 8);
  noStroke(); fill(isRec ? 255 : 220);
  textSize(14);
  textAlign(CENTER, CENTER);
  text(isRec ? `REC ${recCount}/${recTarget}` : 'REC', recButton.x + recButton.w/2, recButton.y + recButton.h/2);

  // Recording label under button
  if (isRec) {
    textSize(12);
    fill(230);
    text(recLabel, recButton.x + recButton.w/2, recButton.y + recButton.h + 10);
  }
}

function grain(count) {
  noStroke();
  for (let i = 0; i < count; i++) {
    fill(255, random(8, 22));
    rect(random(width), random(height), 1, 1);
  }
}

// ==================== Input / Recording / Resize ============================
function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('brutalist-video-' + Date.now(), 'png');

  if (key === 'g' || key === 'G') showGrain = !showGrain;
  if (key === 't' || key === 'T') showHUD = !showHUD;

  if (key === '1') mode = 1;
  if (key === '2') mode = 2;
  if (key === '3') mode = 3;

  if (key === '[') setPalette((palIdx - 1 + PALETTES.length) % PALETTES.length);
  if (key === ']') setPalette((palIdx + 1) % PALETTES.length);
  if (key === 'r' || key === 'R') setPalette(floor(random(PALETTES.length)));

  if (key === 'q' || key === 'Q') { qualIdx = (qualIdx + 1) % QUAL_LEVELS.length; setupOffscreen(); }
  if (key === 'e' || key === 'E') edgeOn = !edgeOn;
  if (key === 'm' || key === 'M') styleIdx = (styleIdx + 1) % 3;
  if (key === 'l' || key === 'L') { posterLevels++; if (posterLevels > 6) posterLevels = 3; }
  if (key === '-' ) sep = max(0.0, sep - 0.05);
  if (key === '=' ) sep = min(1.0, sep + 0.05);

  if (key === 'p' || key === 'P') toggleRecording();
  if (key === 'x' || key === 'X') cancelRecording();

  if (keyCode === 32) { // Space
    paused = !paused;
    if (!paused) loop(); else noLoop();
  }
}

function mousePressed() {
  // Click the REC button
  if (mouseX >= recButton.x && mouseX <= recButton.x + recButton.w &&
      mouseY >= recButton.y && mouseY <= recButton.y + recButton.h) {
    toggleRecording();
  }
}

function toggleRecording() {
  if (!recOn) {
    recOn = true;
    recCount = 0;
    recLabel = `every ${recEvery}f → ${recTarget} frames`;
  } else {
    stopRecording();
  }
}
function stopRecording() {
  recOn = false;
  recLabel = 'saved';
}
function cancelRecording() {
  recOn = false;
  recCount = 0;
  recLabel = 'canceled';
}

function setPalette(i){
  palIdx = i;
  pal = PALETTES[palIdx].c;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

