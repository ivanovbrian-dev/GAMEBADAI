import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  body{overscroll-behavior:none;touch-action:none;}
  @keyframes rainFall{
    0%{transform:translateY(-30px) skewX(-18deg);opacity:0;}
    10%{opacity:.6;} 90%{opacity:.3;}
    100%{transform:translateY(105vh) skewX(-18deg);opacity:0;}
  }
  @keyframes pulseGlow{0%,100%{opacity:1;}50%{opacity:.55;}}
  @keyframes shakeX{
    0%,100%{transform:translateX(0);}
    25%{transform:translateX(-3px);} 75%{transform:translateX(3px);}
  }
  @keyframes popIn{from{transform:scale(.85);opacity:0;}to{transform:scale(1);opacity:1;}}
  @keyframes lightningFlash{0%,100%{opacity:0;}10%,30%{opacity:1;}20%{opacity:.3;}}
  @keyframes screenShake{
    0%,100%{transform:translate(0,0);}
    25%{transform:translate(-4px,2px);}
    50%{transform:translate(4px,-2px);}
    75%{transform:translate(-2px,4px);}
  }
  @keyframes windSway{0%,100%{transform:rotate(-2deg);}50%{transform:rotate(2deg);}}
  @keyframes legSwing1{0%,100%{transform:rotate(0deg);}50%{transform:rotate(20deg);}}
  @keyframes legSwing2{0%,100%{transform:rotate(20deg);}50%{transform:rotate(0deg);}}
  @keyframes armSwing1{0%,100%{transform:rotate(-15deg);}50%{transform:rotate(15deg);}}
  @keyframes armSwing2{0%,100%{transform:rotate(15deg);}50%{transform:rotate(-15deg);}}
  @keyframes bodyBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-1.5px);}}
  @keyframes hitFlash{0%,100%{filter:none;}50%{filter:brightness(2) saturate(2) hue-rotate(-30deg);}}
  @keyframes shakeAnswer{
    0%,100%{transform:translateX(0);}
    20%,60%{transform:translateX(-6px);}
    40%,80%{transform:translateX(6px);}
  }
  @keyframes skyLightning{
    0%,92%,100%{opacity:0;}
    93%,96%{opacity:0.8;}
    94%{opacity:0.3;}
  }
  @keyframes cloudDrift{
    0%{transform:translateX(-10%);}
    100%{transform:translateX(110%);}
  }
  @keyframes trafficCycle{
    0%,30%{background:#ef4444;box-shadow:0 0 8px #ef4444;}
    33%,40%{background:#fbbf24;box-shadow:0 0 8px #fbbf24;}
    43%,90%{background:#22c55e;box-shadow:0 0 8px #22c55e;}
    93%,100%{background:#fbbf24;box-shadow:0 0 8px #fbbf24;}
  }
  @keyframes rainSplash{
    0%{transform:scale(0);opacity:0.8;}
    100%{transform:scale(3);opacity:0;}
  }
  .btn{transition:transform .14s,filter .14s;cursor:pointer;}
  .btn:hover{transform:translateY(-2px);filter:brightness(1.1);}
  .btn:active{transform:scale(.97);}
  .dpad-btn{user-select:none;-webkit-user-select:none;touch-action:none;transition:transform .1s,background .1s;}
  .dpad-btn.active{transform:scale(.9);background:#fbbf24cc!important;}
  .answer-btn{transition:transform .15s,filter .15s,border-color .15s;cursor:pointer;}
  .answer-btn:hover{transform:translateY(-3px);filter:brightness(1.15);border-color:#fbbf24!important;}
  .answer-btn:active{transform:scale(.97);}
`;

const PX_PER_METER = 10;
const FPS = 60;
const CHAR_HITBOX = 18;
const SLOW_DURATION = 1500;
const SLOW_FACTOR = 0.45;
const HIT_COOLDOWN = 800;

// ─── AUDIO SYSTEM (Web Audio API procedural) ──────────────────
// Generate sound effects tanpa file MP3 — pakai oscillator
let audioCtx = null;
let masterGain = null;
let rainNode = null;
let isMuted = false;

function ensureAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.4;
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      console.warn("AudioContext not supported");
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Suara petir (low rumble + crack)
function playLightning() {
  if (isMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // White noise burst untuk crack
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1200;

  const gain = ctx.createGain();
  gain.gain.value = 0.6;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  noise.connect(filter).connect(gain).connect(masterGain);
  noise.start(now);
  noise.stop(now + 0.5);

  // Low rumble
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 60;
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.8);
  const og = ctx.createGain();
  og.gain.value = 0.3;
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc.connect(og).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.8);
}

// Suara klik tombol
function playClick() {
  if (isMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.frequency.value = 800;
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
  const gain = ctx.createGain();
  gain.gain.value = 0.2;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.1);
}

// Suara win (chord positive)
function playWin() {
  if (isMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // C major arpeggio: C5, E5, G5, C6
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.25, now + i * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
    osc.connect(gain).connect(masterGain);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.5);
  });
}

// Suara lose (descending tone)
function playLose() {
  if (isMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 400;
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.6);
}

// Suara langkah kaki (pendek, low thump)
function playFootstep() {
  if (isMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 150 + Math.random() * 30;
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
  const gain = ctx.createGain();
  gain.gain.value = 0.12;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.12);
}

// Suara hujan (white noise looping)
function startRainSound() {
  if (isMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx || rainNode) return;
  // Generate noise buffer
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 800;

  const gain = ctx.createGain();
  gain.gain.value = 0.08;

  noise.connect(filter).connect(gain).connect(masterGain);
  noise.start();
  rainNode = {source:noise, gain};
}

function stopRainSound() {
  if (rainNode) {
    try {
      rainNode.source.stop();
    } catch(e){}
    rainNode = null;
  }
}

function toggleMute() {
  isMuted = !isMuted;
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.4;
  }
  return isMuted;
}

// ─── BUILDING SVG ─────────────────────────────────────────────
function BuildingSVG({type, color}) {
  if (type === "highrise") {
    return (
      <svg viewBox="0 0 80 120" style={{width:"100%",height:"100%"}}>
        <rect x="0" y="0" width="80" height="120" fill={color}/>
        <rect x="0" y="0" width="80" height="4" fill="#000" opacity="0.4"/>
        {Array.from({length:10}).map((_,r)=>(
          Array.from({length:4}).map((_,c)=>(
            <rect key={`w-${r}-${c}`} x={8 + c*16} y={10 + r*11} width="8" height="6"
              fill={((r*7+c*13) % 10) > 6 ? "#fde68a" : "#1a2f4a"}/>
          ))
        ))}
        <rect x="30" y="100" width="20" height="20" fill="#1a1a1a"/>
      </svg>
    );
  }
  if (type === "shop") {
    return (
      <svg viewBox="0 0 80 60" style={{width:"100%",height:"100%"}}>
        <rect x="0" y="0" width="80" height="60" fill={color}/>
        <rect x="0" y="0" width="80" height="14" fill="#dc2626"/>
        <rect x="8" y="20" width="20" height="22" fill="#1a2f4a"/>
        <rect x="32" y="20" width="20" height="22" fill="#1a2f4a"/>
        <rect x="56" y="20" width="16" height="40" fill="#3a2a1a"/>
        <rect x="58" y="22" width="12" height="36" fill="#5a4a3a"/>
        <circle cx="68" cy="40" r="1" fill="#fbbf24"/>
      </svg>
    );
  }
  if (type === "ruko") {
    return (
      <svg viewBox="0 0 60 80" style={{width:"100%",height:"100%"}}>
        <rect x="0" y="0" width="60" height="80" fill={color}/>
        <rect x="0" y="0" width="60" height="6" fill="#000" opacity="0.4"/>
        <rect x="8" y="12" width="14" height="14" fill="#1a2f4a"/>
        <rect x="38" y="12" width="14" height="14" fill="#1a2f4a"/>
        <rect x="8" y="34" width="14" height="14" fill="#1a2f4a"/>
        <rect x="38" y="34" width="14" height="14" fill="#1a2f4a"/>
        <rect x="22" y="55" width="16" height="25" fill="#3a2a1a"/>
      </svg>
    );
  }
  return null;
}

function Building({building}) {
  return (
    <div style={{
      position:"absolute",
      left:building.x, top:building.y,
      width:building.w, height:building.h,
      filter:"drop-shadow(3px 4px 0 #000a)",
      pointerEvents:"none"
    }}>
      <BuildingSVG type={building.type} color={building.color}/>
    </div>
  );
}

// ─── SHELTER TEMPLATES (untuk random pick) ───────────────────
const SHELTER_TEMPLATES = {
  tree: { icon:"🌳", name:"Pohon", safe:false,
    reason:"Pohon adalah KONDUKTOR PETIR! Cabang yang patah bisa menimpamu!" },
  halte: { icon:"🛖", name:"Halte Bus", safe:false,
    reason:"Sisi terbuka! Angin badai bisa menerbangkan barang menabrakmu!" },
  ruins: { icon:"🏚️", name:"Bangunan Reot", safe:false,
    reason:"Struktur rapuh AKAN ROBOH oleh angin kencang!" },
  house: { icon:"🏠", name:"Rumah Kokoh", safe:true,
    reason:"Dinding bata kokoh menahan angin & melindungi dari petir!" },
};

// ─── RANDOM POSITION GENERATOR ────────────────────────────────
// Hasilkan posisi acak yang tidak menumpuk dengan posisi lain
function randomPosition(mapWidth, mapHeight, existing, minDist = 280, margin = 150) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = margin + Math.random() * (mapWidth - 2*margin);
    const y = margin + Math.random() * (mapHeight - 2*margin);
    const tooClose = existing.some(p => Math.hypot(p.x - x, p.y - y) < minDist);
    if (!tooClose) return {x: Math.round(x), y: Math.round(y)};
  }
  // Fallback
  return {x: margin + Math.random() * (mapWidth - 2*margin), y: margin + Math.random() * (mapHeight - 2*margin)};
}

// ─── LEVEL GENERATORS ─────────────────────────────────────────
function generateLevel1(isMobile = false) {
  // Mobile: map lebih kecil agar jarak shelter terlihat di layar HP
  const mapWidth = isMobile ? 900 : 1200;
  const mapHeight = isMobile ? 700 : 900;
  const spawnX = mapWidth / 2;
  const spawnY = mapHeight / 2;
  const existing = [{x:spawnX, y:spawnY}];

  const types = ["tree","halte","ruins","house"];
  const minShelterDist = isMobile ? 200 : 280;
  const shelters = types.map((t,i) => {
    const pos = randomPosition(mapWidth, mapHeight, existing, minShelterDist);
    existing.push(pos);
    return { id:`${t}-${i}`, ...SHELTER_TEMPLATES[t], ...pos };
  });

  // Compute roads grid AFTER shelters are placed
  const levelConfig = {mapWidth, mapHeight, spawnX, spawnY, shelters};
  const roads = getCityRoads(levelConfig);

  // Snap shelter ke pinggir jalan
  const snappedShelters = shelters.map(s => ({...s, ...snapShelterToRoadside(s, roads)}));
  const snappedExisting = [{x:spawnX, y:spawnY}, ...snappedShelters];

  const buildings = generateBuildings(mapWidth, mapHeight, 14, snappedExisting, roads);
  const decorations = generateDecorations(mapWidth, mapHeight, snappedExisting, 30, roads);

  return {
    title: "LEVEL 1: EKSPLORASI KOTA",
    timeLimit: 60, walkSpeed: 5,
    mapWidth, mapHeight, spawnX, spawnY,
    showMath: false, hasObstacles: false, isLevel3: false,
    shelters: snappedShelters,
    buildings,
    decorations,
    obstacles: buildObstacles(buildings, decorations)
  };
}

function generateLevel2(isMobile = false) {
  // Mobile: map lebih kecil
  const mapWidth = isMobile ? 1200 : 1600;
  const mapHeight = isMobile ? 850 : 1100;
  const spawnX = mapWidth / 2;
  const spawnY = mapHeight / 2;
  const existing = [{x:spawnX, y:spawnY}];

  // 1 rumah dekat (aman), 1 rumah jauh (tooFar), + bahaya
  const types = ["house","tree","halte","ruins","house"];
  const tooFarIndex = 4;

  const shelters = types.map((t,i) => {
    let pos;
    if (i === 0) {
      // Rumah dekat: 250-380 px dari spawn (25-38m → 5-7.6 detik untuk capai)
      pos = positionNearSpawn(spawnX, spawnY, mapWidth, mapHeight, existing, 250, 380);
    } else if (i === tooFarIndex) {
      // Rumah jauh: minimal 500 px di mobile, 600 px di desktop
      pos = positionFarFromSpawn(spawnX, spawnY, mapWidth, mapHeight, existing, isMobile ? 500 : 600);
    } else {
      pos = randomPosition(mapWidth, mapHeight, existing, isMobile ? 220 : 280);
    }
    existing.push(pos);
    return {
      id:`${t}-${i}`, ...SHELTER_TEMPLATES[t], ...pos,
      ...(i === 0 ? {reason:"Pilihan tepat & dekat! Perlindungan terbaik dari badai!"} : {}),
      ...(i === tooFarIndex ? {tooFar:true, reason:"Walau aman, TERLALU JAUH! Waktu habis sebelum sampai!"} : {})
    };
  });

  const levelConfig2 = {mapWidth, mapHeight, spawnX, spawnY, shelters};
  const roads2 = getCityRoads(levelConfig2);

  const snappedShelters2 = shelters.map(s => ({...s, ...snapShelterToRoadside(s, roads2)}));
  const snappedExisting2 = [{x:spawnX, y:spawnY}, ...snappedShelters2];

  const buildings2 = generateBuildings(mapWidth, mapHeight, 18, snappedExisting2, roads2);
  const decorations2 = generateDecorations(mapWidth, mapHeight, snappedExisting2, 40, roads2);

  return {
    title: "LEVEL 2: PILIH CEPAT & TEPAT",
    timeLimit: 9, walkSpeed: 5,
    mapWidth, mapHeight, spawnX, spawnY,
    showMath: false, hasObstacles: false, isLevel3: false,
    shelters: snappedShelters2,
    buildings: buildings2,
    decorations: decorations2,
    obstacles: buildObstacles(buildings2, decorations2)
  };
}

function generateLevel3(isMobile = false) {
  // Mobile: map lebih kecil agar pemain bisa lihat rumah aman tanpa terlalu jauh
  const mapWidth = isMobile ? 1500 : 2000;
  const mapHeight = isMobile ? 1100 : 1400;
  const spawnX = mapWidth / 2;
  const spawnY = mapHeight / 2;
  const timeLimit = 13;
  const walkSpeed = 5;
  const maxReachableDist = walkSpeed * timeLimit;

  // Helper internal untuk 1 percobaan generate
  function tryGenerate() {
    const existing = [{x:spawnX, y:spawnY}];

    // Jarak rumah di-skala untuk mobile agar fit di map yang lebih kecil
    // Tetap pertahankan: rumah benar terjangkau, rumah salah MUSTAHIL dicapai
    // Timer 13s × speed 5 = max 65m. Jadi rumah salah harus >65m
    // Mobile: rumah benar 45-49m (9-9.8s), rumah salah 70-78m (mustahil)
    // Desktop: rumah benar 55-59m, rumah salah 70-86m (mustahil)
    let correctDist, wrongDist1, wrongDist2;
    if (isMobile) {
      correctDist = 45 + Math.floor(Math.random() * 4);   // 45-48m → 9-9.6s
      wrongDist1  = 70 + Math.floor(Math.random() * 4);   // 70-73m → 14-14.6s (mustahil)
      wrongDist2  = 76 + Math.floor(Math.random() * 4);   // 76-79m → ~15.5s (sangat mustahil)
    } else {
      correctDist = 55 + Math.floor(Math.random() * 5);
      wrongDist1  = 70 + Math.floor(Math.random() * 5);
      wrongDist2  = 80 + Math.floor(Math.random() * 7);
    }
    const distMeters = [correctDist, wrongDist1, wrongDist2];

    const labels = ["A","B","C"];
    const shuffledLabels = [...labels].sort(()=>Math.random()-0.5);

    // PENTING: 3 rumah ditempatkan di 3 SEKTOR ANGLE BERBEDA
    // Bagi lingkaran 360° jadi 3 sektor (120° each), tiap rumah dapat 1 sektor
    // Sektor diacak agar tidak selalu di posisi yang sama
    const startAngle = Math.random() * Math.PI * 2;
    const sectorOrder = [0, 1, 2].sort(()=>Math.random()-0.5);

    const safeShelters = shuffledLabels.map((label, i) => {
      const distM = distMeters[i];
      const distPx = distM * PX_PER_METER;

      // Sektor angle: 120° per rumah dengan random dalam sektor
      const sectorIdx = sectorOrder[i];
      const sectorStart = startAngle + sectorIdx * (Math.PI * 2 / 3);
      const sectorEnd = sectorStart + (Math.PI * 2 / 3);

      const pos = positionInSector(
        spawnX, spawnY, mapWidth, mapHeight, existing,
        distPx, 40, sectorStart, sectorEnd
      );
      existing.push(pos);
      return {
        id: `house-${label}`,
        ...SHELTER_TEMPLATES.house,
        ...pos,
        label,
        distance: distM,
        isCorrectAnswer: i === 0,
        tooFar: i !== 0
      };
    });

    const dangerTypes = ["tree","halte","ruins"];
    const dangerShelters = dangerTypes.map((t,i) => {
      const distM = 20 + Math.floor(Math.random()*21);  // 20-40m
      const distPx = distM * PX_PER_METER;
      const pos = positionAtDistance(spawnX, spawnY, mapWidth, mapHeight, existing, distPx, 50);
      existing.push(pos);
      return {
        id:`${t}-${i}`, ...SHELTER_TEMPLATES[t], ...pos,
        distance: distM
      };
    });

    const shelters = [...safeShelters, ...dangerShelters].sort(()=>Math.random()-0.5);
    const correctLabel = shuffledLabels[0];

    const levelConfig3 = {mapWidth, mapHeight, spawnX, spawnY, shelters};
    const roads3 = getCityRoads(levelConfig3);

    // Snap ke pinggir jalan
    const snappedShelters3 = shelters.map(s => ({...s, ...snapShelterToRoadside(s, roads3)}));

    // RECALCULATE jarak aktual untuk safe shelters setelah snap
    const safeWithRealDist = snappedShelters3
      .filter(s => s.safe)
      .map(s => ({
        ...s,
        distance: Math.round(distanceMeters(spawnX, spawnY, s.x, s.y))
      }));

    // VALIDASI 1: Semua rumah harus di dalam map dengan margin (tidak ngumpet di pojok)
    const safeMargin = 200;
    const allInside = safeWithRealDist.every(s =>
      s.x > safeMargin && s.x < mapWidth - safeMargin &&
      s.y > safeMargin && s.y < mapHeight - safeMargin
    );
    if (!allInside) return null;

    // VALIDASI 2: rumah benar HARUS jarak terpendek dari semua rumah
    const correctSh = safeWithRealDist.find(s => s.label === correctLabel);
    const otherSafe = safeWithRealDist.filter(s => s.label !== correctLabel);
    const stillCorrect = otherSafe.every(w => correctSh.distance < w.distance);
    if (!stillCorrect) return null;

    // VALIDASI 3: Selisih jarak rumah benar vs rumah salah terdekat minimal 8m
    // (agar pemain bisa lihat perbedaan yang signifikan saat menghitung)
    const minOtherDist = Math.min(...otherSafe.map(w => w.distance));
    if (minOtherDist - correctSh.distance < 8) return null;

    // VALIDASI 4: Jarak antar rumah min 250px agar tidak overlap secara visual
    const allSafePositions = safeWithRealDist;
    for (let i = 0; i < allSafePositions.length; i++) {
      for (let j = i+1; j < allSafePositions.length; j++) {
        const d = Math.hypot(allSafePositions[i].x - allSafePositions[j].x,
                              allSafePositions[i].y - allSafePositions[j].y);
        if (d < 250) return null;
      }
    }

    // VALIDASI 5: Ketiga rumah harus TERSEBAR (tidak menumpuk di 1 kuadran)
    // Hitung sudut setiap rumah dari spawn, pastikan tidak ada 2 rumah dengan sudut <60°
    const anglesFromSpawn = safeWithRealDist.map(s => Math.atan2(s.y - spawnY, s.x - spawnX));
    // Normalize ke 0-2π lalu sort
    const sortedAngles = anglesFromSpawn.map(a => (a + Math.PI * 2) % (Math.PI * 2)).sort((a,b) => a - b);
    // Hitung gap antar sudut (termasuk wrap-around)
    const gaps = [];
    for (let i = 0; i < sortedAngles.length; i++) {
      const next = sortedAngles[(i+1) % sortedAngles.length];
      let gap = next - sortedAngles[i];
      if (gap < 0) gap += Math.PI * 2;
      gaps.push(gap);
    }
    // Setiap gap harus minimal 80° (1.4 rad) agar rumah benar-benar tersebar
    const minGap = Math.min(...gaps);
    if (minGap < 1.4) return null;

    // Update shelter list dengan jarak baru
    const finalShelters = snappedShelters3.map(s => {
      if (!s.safe) return s;
      const updated = safeWithRealDist.find(ss => ss.id === s.id);
      return updated || s;
    });

    return {
      shelters: finalShelters,
      safeChoices: safeWithRealDist,
      correctLabel,
      roads: roads3
    };
  }

  // Coba sampai dapat layout yang valid (banyak iterasi karena validasi lebih ketat)
  let result = null;
  for (let i = 0; i < 60; i++) {
    result = tryGenerate();
    if (result) break;
  }

  // Fallback (jika 30x gagal): pakai tryGenerate terakhir tanpa validasi snap
  // tapi tetap urutkan label sesuai jarak aktual
  if (!result) {
    console.warn("Level 3: 30x retry gagal, paksa relabel berdasarkan jarak aktual");
    // Re-run tanpa validasi & re-label berdasarkan jarak setelah snap
    const existing = [{x:spawnX, y:spawnY}];
    const labels = ["A","B","C"];
    const shuffledLabels = [...labels].sort(()=>Math.random()-0.5);

    const pseudoShelters = shuffledLabels.map((label, i) => {
      const distM = isMobile ? [46, 71, 78][i] : [56, 72, 82][i];
      const pos = positionAtDistance(spawnX, spawnY, mapWidth, mapHeight, existing, distM * PX_PER_METER, 40);
      existing.push(pos);
      return {
        id: `house-${label}`,
        ...SHELTER_TEMPLATES.house,
        ...pos,
        label,
        distance: distM,
        safe: true
      };
    });

    const dangerTypes = ["tree","halte","ruins"];
    const dangerShelters = dangerTypes.map((t,i) => {
      const distM = 20 + Math.floor(Math.random()*21);
      const pos = positionAtDistance(spawnX, spawnY, mapWidth, mapHeight, existing, distM * PX_PER_METER, 50);
      existing.push(pos);
      return {
        id:`${t}-${i}`, ...SHELTER_TEMPLATES[t], ...pos,
        distance: distM
      };
    });

    const shelters = [...pseudoShelters, ...dangerShelters].sort(()=>Math.random()-0.5);
    const levelConfig = {mapWidth, mapHeight, spawnX, spawnY, shelters};
    const roads = getCityRoads(levelConfig);
    const snapped = shelters.map(s => ({...s, ...snapShelterToRoadside(s, roads)}));

    // Re-label rumah berdasarkan jarak aktual setelah snap
    const safeAfterSnap = snapped
      .filter(s => s.safe)
      .map(s => ({...s, distance: Math.round(distanceMeters(spawnX, spawnY, s.x, s.y))}))
      .sort((a,b) => a.distance - b.distance);  // terdekat di index 0

    const relabeled = safeAfterSnap.map((s, i) => ({
      ...s,
      label: labels[i],
      isCorrectAnswer: i === 0,
      tooFar: i !== 0
    }));

    const finalShelters = snapped.map(s => {
      if (!s.safe) return s;
      const upd = relabeled.find(r => r.id === s.id);
      return upd ? {...upd, id: s.id} : s;
    });

    result = {
      shelters: finalShelters,
      safeChoices: relabeled,
      correctLabel: "A",  // setelah re-label, A selalu yang terdekat
      roads
    };
  }

  const snappedExisting3 = [{x:spawnX, y:spawnY}, ...result.shelters];
  const buildings3 = generateBuildings(mapWidth, mapHeight, 22, snappedExisting3, result.roads);
  const decorations3 = generateDecorations(mapWidth, mapHeight, snappedExisting3, 50, result.roads);

  return {
    title: "LEVEL 3: HITUNG & HINDARI PUING",
    timeLimit, walkSpeed,
    mapWidth, mapHeight, spawnX, spawnY,
    showMath: true, hasObstacles: true, isLevel3: true,
    shelters: result.shelters,
    safeChoices: result.safeChoices,
    correctLabel: result.correctLabel,
    maxReachableDist,
    buildings: buildings3,
    decorations: decorations3,
    obstacles: buildObstacles(buildings3, decorations3)
  };
}

function positionNearSpawn(sx, sy, mw, mh, existing, minPx, maxPx) {
  for (let i=0; i<50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minPx + Math.random() * (maxPx - minPx);
    const x = Math.max(150, Math.min(mw-150, sx + Math.cos(angle)*dist));
    const y = Math.max(150, Math.min(mh-150, sy + Math.sin(angle)*dist));
    const tooClose = existing.some(p => Math.hypot(p.x - x, p.y - y) < 250);
    if (!tooClose) return {x: Math.round(x), y: Math.round(y)};
  }
  return {x: sx + minPx, y: sy};
}

function positionFarFromSpawn(sx, sy, mw, mh, existing, minPx) {
  for (let i=0; i<50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minPx + Math.random() * 200;
    const x = Math.max(150, Math.min(mw-150, sx + Math.cos(angle)*dist));
    const y = Math.max(150, Math.min(mh-150, sy + Math.sin(angle)*dist));
    const tooClose = existing.some(p => Math.hypot(p.x - x, p.y - y) < 250);
    if (!tooClose) return {x: Math.round(x), y: Math.round(y)};
  }
  return {x: sx + minPx, y: sy};
}

// Tempatkan posisi pada jarak tertentu DI DALAM sektor angle [angleStart, angleEnd]
// Berguna untuk memastikan shelter tersebar di arah berbeda (tidak menumpuk)
function positionInSector(sx, sy, mw, mh, existing, distPx, tolerance, angleStart, angleEnd) {
  const margin = 180;
  const angleRange = angleEnd - angleStart;

  // Coba 100x angle dalam sektor
  for (let i = 0; i < 100; i++) {
    const angle = angleStart + Math.random() * angleRange;
    const d = distPx + (Math.random() - 0.5) * tolerance;
    const rawX = sx + Math.cos(angle) * d;
    const rawY = sy + Math.sin(angle) * d;

    if (rawX < margin || rawX > mw - margin || rawY < margin || rawY > mh - margin) continue;

    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const tooClose = existing.some(p => Math.hypot(p.x - x, p.y - y) < 220);
    if (!tooClose) return {x, y};
  }

  // Relax constraint
  for (let i = 0; i < 50; i++) {
    const angle = angleStart + Math.random() * angleRange;
    const d = distPx + (Math.random() - 0.5) * tolerance;
    const rawX = sx + Math.cos(angle) * d;
    const rawY = sy + Math.sin(angle) * d;
    if (rawX < margin || rawX > mw - margin || rawY < margin || rawY > mh - margin) continue;
    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const tooClose = existing.some(p => Math.hypot(p.x - x, p.y - y) < 140);
    if (!tooClose) return {x, y};
  }

  // Fallback: pakai angle tengah sektor, clamp ke map
  const midAngle = (angleStart + angleEnd) / 2;
  const rawX = sx + Math.cos(midAngle) * distPx;
  const rawY = sy + Math.sin(midAngle) * distPx;
  return {
    x: Math.round(Math.max(margin, Math.min(mw - margin, rawX))),
    y: Math.round(Math.max(margin, Math.min(mh - margin, rawY)))
  };
}

function positionAtDistance(sx, sy, mw, mh, existing, distPx, tolerance = 50) {
  // Margin dari pinggir map
  const margin = 180;
  const maxDistX = Math.max(sx - margin, mw - margin - sx);
  const maxDistY = Math.max(sy - margin, mh - margin - sy);
  const maxRealisticDist = Math.min(maxDistX, maxDistY);

  // Kalau jarak target lebih besar dari yang mungkin di map, clamp dulu
  // tapi pastikan tidak di pojok (bias ke arah yang lebih lapang)
  const effectiveDist = Math.min(distPx, maxRealisticDist - 50);

  // Coba banyak angle, prioritaskan posisi yang TIDAK clamp ke pinggir
  // (artinya, posisi yang utuh di dalam map dengan margin)
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const d = effectiveDist + (Math.random() - 0.5) * tolerance;
    const rawX = sx + Math.cos(angle) * d;
    const rawY = sy + Math.sin(angle) * d;

    // SKIP jika posisi raw di luar margin (mencegah clamp yang distorsi jarak)
    if (rawX < margin || rawX > mw - margin || rawY < margin || rawY > mh - margin) continue;

    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const tooClose = existing.some(p => Math.hypot(p.x - x, p.y - y) < 220);
    if (!tooClose) return {x, y};
  }

  // Fallback 1: relax minimum distance constraint
  for (let i = 0; i < 100; i++) {
    const angle = Math.random() * Math.PI * 2;
    const d = effectiveDist + (Math.random() - 0.5) * tolerance;
    const rawX = sx + Math.cos(angle) * d;
    const rawY = sy + Math.sin(angle) * d;
    if (rawX < margin || rawX > mw - margin || rawY < margin || rawY > mh - margin) continue;
    const x = Math.round(rawX);
    const y = Math.round(rawY);
    const tooClose = existing.some(p => Math.hypot(p.x - x, p.y - y) < 140);
    if (!tooClose) return {x, y};
  }

  // Fallback 2: pakai sektor 8 arah, pilih yang paling jauh dari existing
  const sectors = 8;
  let best = null, bestMinDist = -1;
  for (let i = 0; i < sectors; i++) {
    const angle = (i / sectors) * Math.PI * 2;
    const rawX = sx + Math.cos(angle) * effectiveDist;
    const rawY = sy + Math.sin(angle) * effectiveDist;
    const x = Math.max(margin, Math.min(mw - margin, rawX));
    const y = Math.max(margin, Math.min(mh - margin, rawY));
    const minDistToExisting = existing.length > 0
      ? Math.min(...existing.map(p => Math.hypot(p.x - x, p.y - y)))
      : Infinity;
    if (minDistToExisting > bestMinDist) {
      bestMinDist = minDistToExisting;
      best = {x: Math.round(x), y: Math.round(y)};
    }
  }
  return best;
}

// Gedung dekorasi sekarang ditempatkan di "city blocks" (area antara jalan)
function generateBuildings(mw, mh, count, existing, roads) {
  if (!roads || roads.verticalRoads.length < 2 || roads.horizontalRoads.length < 2) {
    // Fallback bila tidak ada cukup jalan untuk membuat block
    return [];
  }

  const buildings = [];
  const types = ["highrise","shop","ruko"];
  const colors = ["#475569","#64748b","#52525b","#3f3f46","#7c2d12","#365314","#1e3a8a","#78350f","#831843","#581c87","#0c4a6e"];

  const halfRoad = roads.ROAD_W/2;
  const sidewalk = roads.SIDEWALK_W;

  // Buat list semua "city blocks" (area antara 2 jalan)
  const xEdges = [0, ...roads.verticalRoads, mw];
  const yEdges = [0, ...roads.horizontalRoads, mh];

  const blocks = [];
  for (let i = 0; i < xEdges.length - 1; i++) {
    for (let j = 0; j < yEdges.length - 1; j++) {
      const blockX1 = xEdges[i] + (i === 0 ? 0 : halfRoad + sidewalk + 5);
      const blockX2 = xEdges[i+1] - (i === xEdges.length - 2 ? 0 : halfRoad + sidewalk + 5);
      const blockY1 = yEdges[j] + (j === 0 ? 0 : halfRoad + sidewalk + 5);
      const blockY2 = yEdges[j+1] - (j === yEdges.length - 2 ? 0 : halfRoad + sidewalk + 5);
      const w = blockX2 - blockX1;
      const h = blockY2 - blockY1;
      if (w > 80 && h > 80) {
        blocks.push({x1:blockX1, y1:blockY1, x2:blockX2, y2:blockY2, w, h});
      }
    }
  }

  // Shuffle blocks, isi dengan gedung
  const shuffled = [...blocks].sort(() => Math.random() - 0.5);

  for (const block of shuffled) {
    if (buildings.length >= count) break;
    const type = types[Math.floor(Math.random()*types.length)];
    const sz = type==="highrise" ? {w:80,h:120} : type==="shop" ? {w:80,h:60} : {w:60,h:80};

    // Cek apakah block muat untuk gedung
    if (block.w < sz.w + 10 || block.h < sz.h + 10) continue;

    // Posisi acak di dalam block
    const x = block.x1 + Math.random() * (block.w - sz.w);
    const y = block.y1 + Math.random() * (block.h - sz.h);

    // Cek jangan tumpang tindih dengan shelter
    const cx = x + sz.w/2;
    const cy = y + sz.h/2;
    const tooClose = existing.some(p => Math.hypot(p.x - cx, p.y - cy) < 120);
    if (tooClose) continue;

    // Cek jangan tumpang tindih dengan gedung lain
    const overlap = buildings.some(b =>
      x < b.x + b.w + 20 && x + sz.w > b.x - 20 &&
      y < b.y + b.h + 20 && y + sz.h > b.y - 20
    );
    if (overlap) continue;

    buildings.push({
      type, x:Math.round(x), y:Math.round(y),
      ...sz,
      color: colors[Math.floor(Math.random()*colors.length)]
    });
  }
  return buildings;
}

// Decorations sekarang HANYA di trotoar (pinggir jalan)
// roads = {verticalRoads, horizontalRoads, ROAD_W, SIDEWALK_W}
function generateDecorations(mw, mh, existing, count, roads) {
  // Tipe yang cocok untuk pinggir jalan:
  // - lamp/sign: tepat di pinggir jalan (di trotoar)
  // - car: tepat di tepi jalan (parkir di aspal pinggir)
  // - tree-small/plant: di trotoar
  // - bench, trash, hydrant: di trotoar
  const types = ["tree-small","lamp","car","hydrant","trash","bench","sign","plant"];
  const decos = [];
  const halfRoad = roads.ROAD_W / 2;
  const sidewalkInner = halfRoad + 4;   // sedikit dari aspal
  const sidewalkOuter = halfRoad + roads.SIDEWALK_W + 8; // batas luar trotoar

  // Generate candidate positions di trotoar
  // Strategi: untuk setiap jalan horizontal, taruh dekorasi di atas & bawah
  const candidates = [];

  // Trotoar di sepanjang jalan horizontal (atas & bawah)
  for (const ry of roads.horizontalRoads) {
    // Step setiap 70-100px sepanjang jalan
    for (let x = 80; x < mw - 80; x += 70 + Math.random() * 40) {
      // Trotoar atas
      const yTop = ry - halfRoad - roads.SIDEWALK_W - 6;
      if (yTop > 50) candidates.push({x: Math.round(x), y: yTop, side:"horizontal-top", ry});
      // Trotoar bawah
      const yBot = ry + halfRoad + roads.SIDEWALK_W + 6;
      if (yBot < mh - 50) candidates.push({x: Math.round(x), y: yBot, side:"horizontal-bot", ry});
    }
  }

  // Trotoar di sepanjang jalan vertikal (kiri & kanan)
  for (const rx of roads.verticalRoads) {
    for (let y = 80; y < mh - 80; y += 70 + Math.random() * 40) {
      const xLeft = rx - halfRoad - roads.SIDEWALK_W - 6;
      if (xLeft > 50) candidates.push({x: xLeft, y: Math.round(y), side:"vertical-left", rx});
      const xRight = rx + halfRoad + roads.SIDEWALK_W + 6;
      if (xRight < mw - 50) candidates.push({x: xRight, y: Math.round(y), side:"vertical-right", rx});
    }
  }

  // Hindari posisi yang dekat dengan perempatan (zebra cross area)
  const filtered = candidates.filter(c => {
    for (const rx of roads.verticalRoads) {
      for (const ry of roads.horizontalRoads) {
        if (Math.abs(c.x - rx) < halfRoad + 15 && Math.abs(c.y - ry) < halfRoad + 15) return false;
      }
    }
    return true;
  });

  // Shuffle & pick `count` posisi
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);

  for (const candidate of shuffled) {
    if (decos.length >= count) break;
    // Cek jarak dengan dekorasi lain & shelter
    const tooCloseSh = existing.some(p => Math.hypot(p.x - candidate.x, p.y - candidate.y) < 70);
    const tooCloseDeco = decos.some(p => Math.hypot(p.x - candidate.x, p.y - candidate.y) < 55);
    if (tooCloseSh || tooCloseDeco) continue;

    // Pilih tipe: car cuma di sisi yang menempel jalan (parking)
    let availableTypes = types;
    if (candidate.side?.startsWith("vertical")) {
      // Untuk trotoar di sisi jalan vertikal, mobil parkir membujur (sebenarnya semua bisa, biarkan saja)
    }
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    decos.push({type, x: candidate.x, y: candidate.y});
  }

  return decos;
}

function distanceMeters(x1, y1, x2, y2) {
  const dx = (x2 - x1) / PX_PER_METER;
  const dy = (y2 - y1) / PX_PER_METER;
  return Math.sqrt(dx*dx + dy*dy);
}

// Collision: cek apakah lingkaran (cx, cy, r) bertabrakan dengan rectangle (rx, ry, rw, rh)
function rectCircleCollide(rx, ry, rw, rh, cx, cy, r) {
  // Cari titik terdekat di rectangle ke pusat lingkaran
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx*dx + dy*dy) < r*r;
}

// Snap shelter ke pinggir jalan (trotoar)
function snapShelterToRoadside(shelter, roads) {
  const halfRoad = roads.ROAD_W/2;
  const sidewalkOffset = halfRoad + roads.SIDEWALK_W + 35;

  let nearestHy = null, nearestHdist = Infinity;
  for (const ry of roads.horizontalRoads) {
    const d = Math.abs(shelter.y - ry);
    if (d < nearestHdist) { nearestHdist = d; nearestHy = ry; }
  }
  let nearestVx = null, nearestVdist = Infinity;
  for (const rx of roads.verticalRoads) {
    const d = Math.abs(shelter.x - rx);
    if (d < nearestVdist) { nearestVdist = d; nearestVx = rx; }
  }

  if (nearestHdist < nearestVdist && nearestHy !== null) {
    const above = shelter.y < nearestHy;
    return {
      ...shelter,
      x: shelter.x,
      y: above ? nearestHy - sidewalkOffset : nearestHy + sidewalkOffset
    };
  } else if (nearestVx !== null) {
    const left = shelter.x < nearestVx;
    return {
      ...shelter,
      x: left ? nearestVx - sidewalkOffset : nearestVx + sidewalkOffset,
      y: shelter.y
    };
  }
  return shelter;
}

// Build daftar obstacle dari config (gedung + dekorasi)
// Setiap obstacle = {x, y, w, h} dalam world coords
function buildObstacles(buildings, decorations) {
  const obstacles = [];

  // Gedung pixel art = obstacle besar
  for (const b of buildings || []) {
    obstacles.push({
      x: b.x + 4, y: b.y + 8,
      w: b.w - 8, h: b.h - 12
    });
  }

  // Decorations: object hitbox kecil di sekitar posisi (deco.x, deco.y) adalah CENTER
  for (const d of decorations || []) {
    // Skip jenis yang tidak perlu collide (terlalu kecil/datar)
    if (d.type === "sign") continue; // rambu kecil & tipis, lewatkan saja
    if (d.type === "plant") continue;

    const sizes = {
      "car": {w: 50, h: 28},
      "lamp": {w: 18, h: 18},
      "tree-small": {w: 26, h: 26},
      "hydrant": {w: 18, h: 22},
      "trash": {w: 22, h: 22},
      "bench": {w: 26, h: 18},
      "pole": {w: 18, h: 18},
    };
    const sz = sizes[d.type];
    if (!sz) continue;
    obstacles.push({
      x: d.x - sz.w/2, y: d.y - sz.h/2,
      w: sz.w, h: sz.h
    });
  }

  return obstacles;
}

// ─── CITY GRID — jalan lengkap dengan perempatan ──────────────
// Buat grid jalan horizontal & vertikal yang mencakup seluruh map
// dan termasuk semua shelter
function CityGrid({config}) {
  const ROAD_W = 60;  // lebar jalan (pas untuk 1 mobil & karakter)
  const SIDEWALK_W = 8;  // lebar trotoar di pinggir jalan

  // Tentukan posisi jalan horizontal & vertikal
  // Strategi: pastikan setiap shelter ada di pinggir jalan
  // Caranya: ambil X,Y unik dari spawn + semua shelter sebagai "garis jalan"
  const pointsX = [config.spawnX, ...config.shelters.map(s => s.x)];
  const pointsY = [config.spawnY, ...config.shelters.map(s => s.y)];

  // Kumpulkan posisi jalan vertikal (X coords)
  // Bulatkan ke kelipatan 50 agar grid rapi
  const verticalRoads = [...new Set(pointsX.map(x => Math.round(x/50)*50))]
    .filter(x => x > ROAD_W && x < config.mapWidth - ROAD_W)
    .sort((a,b)=>a-b);

  // Jalan horizontal (Y coords)
  const horizontalRoads = [...new Set(pointsY.map(y => Math.round(y/50)*50))]
    .filter(y => y > ROAD_W && y < config.mapHeight - ROAD_W)
    .sort((a,b)=>a-b);

  return (
    <svg width={config.mapWidth} height={config.mapHeight}
      style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}>
      {/* Background = city blocks (lebih gelap dari jalan) */}
      <rect x="0" y="0" width={config.mapWidth} height={config.mapHeight} fill="#1a1f2e"/>

      {/* Trotoar (lebih terang, sedikit lebih lebar dari jalan) */}
      {horizontalRoads.map((y,i) => (
        <rect key={`hs-${i}`}
          x="0" y={y - ROAD_W/2 - SIDEWALK_W}
          width={config.mapWidth} height={ROAD_W + SIDEWALK_W*2}
          fill="#3a3f4e"/>
      ))}
      {verticalRoads.map((x,i) => (
        <rect key={`vs-${i}`}
          x={x - ROAD_W/2 - SIDEWALK_W} y="0"
          width={ROAD_W + SIDEWALK_W*2} height={config.mapHeight}
          fill="#3a3f4e"/>
      ))}

      {/* Aspal jalan horizontal */}
      {horizontalRoads.map((y,i) => (
        <rect key={`hr-${i}`}
          x="0" y={y - ROAD_W/2}
          width={config.mapWidth} height={ROAD_W}
          fill="#2a2a2f"/>
      ))}

      {/* Aspal jalan vertikal */}
      {verticalRoads.map((x,i) => (
        <rect key={`vr-${i}`}
          x={x - ROAD_W/2} y="0"
          width={ROAD_W} height={config.mapHeight}
          fill="#2a2a2f"/>
      ))}

      {/* Garis tengah putus-putus jalan HORIZONTAL */}
      {horizontalRoads.map((y,i) => (
        <line key={`hl-${i}`}
          x1="0" y1={y} x2={config.mapWidth} y2={y}
          stroke="#fbbf24" strokeWidth="2"
          strokeDasharray="20 18" opacity="0.7"/>
      ))}

      {/* Garis tengah putus-putus jalan VERTIKAL */}
      {verticalRoads.map((x,i) => (
        <line key={`vl-${i}`}
          x1={x} y1="0" x2={x} y2={config.mapHeight}
          stroke="#fbbf24" strokeWidth="2"
          strokeDasharray="20 18" opacity="0.7"/>
      ))}

      {/* Zebra cross di setiap perempatan/pertigaan */}
      {horizontalRoads.map(y =>
        verticalRoads.map(x => (
          <g key={`zebra-${x}-${y}`} opacity="0.5">
            {/* Zebra cross atas (di jalan vertikal, atas dari perempatan) */}
            {Array.from({length:5}).map((_,i)=>(
              <rect key={`zu-${i}`}
                x={x - ROAD_W/2 + 4 + i*11}
                y={y - ROAD_W/2 - 6}
                width={6} height={6} fill="#fff"/>
            ))}
            {/* Zebra cross bawah */}
            {Array.from({length:5}).map((_,i)=>(
              <rect key={`zd-${i}`}
                x={x - ROAD_W/2 + 4 + i*11}
                y={y + ROAD_W/2}
                width={6} height={6} fill="#fff"/>
            ))}
            {/* Zebra cross kiri */}
            {Array.from({length:5}).map((_,i)=>(
              <rect key={`zl-${i}`}
                x={x - ROAD_W/2 - 6}
                y={y - ROAD_W/2 + 4 + i*11}
                width={6} height={6} fill="#fff"/>
            ))}
            {/* Zebra cross kanan */}
            {Array.from({length:5}).map((_,i)=>(
              <rect key={`zr-${i}`}
                x={x + ROAD_W/2}
                y={y - ROAD_W/2 + 4 + i*11}
                width={6} height={6} fill="#fff"/>
            ))}
          </g>
        ))
      )}
    </svg>
  );
}

// Helper untuk decoration generator: cek apakah posisi (x,y) di jalan/trotoar
// dan dapatkan grid jalan dari config (sama logikanya dengan CityGrid)
function getCityRoads(config) {
  const ROAD_W = 60, SIDEWALK_W = 8;
  const pointsX = [config.spawnX, ...config.shelters.map(s => s.x)];
  const pointsY = [config.spawnY, ...config.shelters.map(s => s.y)];
  const verticalRoads = [...new Set(pointsX.map(x => Math.round(x/50)*50))]
    .filter(x => x > ROAD_W && x < config.mapWidth - ROAD_W)
    .sort((a,b)=>a-b);
  const horizontalRoads = [...new Set(pointsY.map(y => Math.round(y/50)*50))]
    .filter(y => y > ROAD_W && y < config.mapHeight - ROAD_W)
    .sort((a,b)=>a-b);
  return {verticalRoads, horizontalRoads, ROAD_W, SIDEWALK_W};
}

function isOnRoad(x, y, roads) {
  const halfRoad = roads.ROAD_W/2 + roads.SIDEWALK_W;
  for (const ry of roads.horizontalRoads) {
    if (Math.abs(y - ry) < halfRoad) return true;
  }
  for (const rx of roads.verticalRoads) {
    if (Math.abs(x - rx) < halfRoad) return true;
  }
  return false;
}

function isOnSidewalk(x, y, roads) {
  // Di trotoar = bukan di aspal, tapi dekat dengan jalan (max 30px dari jalan)
  const halfRoad = roads.ROAD_W/2;
  const sidewalkMax = halfRoad + roads.SIDEWALK_W + 18;
  for (const ry of roads.horizontalRoads) {
    const d = Math.abs(y - ry);
    if (d > halfRoad && d < sidewalkMax) {
      for (const rx of roads.verticalRoads) {
        if (Math.abs(x - rx) > halfRoad + roads.SIDEWALK_W) return true;
      }
    }
  }
  for (const rx of roads.verticalRoads) {
    const d = Math.abs(x - rx);
    if (d > halfRoad && d < sidewalkMax) {
      for (const ry of roads.horizontalRoads) {
        if (Math.abs(y - ry) > halfRoad + roads.SIDEWALK_W) return true;
      }
    }
  }
  return false;
}



// ─── DECORATIONS ──────────────────────────────────────────────
// CP_V1.0.4.png = 1024x1024 tileset
// Koordinat (X, Y, width, height) dalam pixel asli sprite sheet
// MUDAH DI-ADJUST: ubah angka di CITY_TILES untuk fine-tuning posisi
const CITY_TILES = {
  // Kendaraan (baris ke-4 & ke-5 di tileset)
  truck_red:  {x: 10,  y: 380, w: 75, h: 40},
  car_red:    {x: 118, y: 388, w: 65, h: 30},
  bus_blue:   {x: 10,  y: 445, w: 75, h: 40},
  car_black:  {x: 118, y: 450, w: 65, h: 30},

  // Lampu jalan & traffic light
  traffic_light: {x: 375, y: 378, w: 25, h: 52},
  lamp_post:     {x: 375, y: 432, w: 28, h: 58},

  // Rambu lalu lintas (icon kecil)
  sign_yellow: {x: 372, y: 495, w: 25, h: 32},
  sign_white:  {x: 408, y: 495, w: 25, h: 32},
  sign_stop:   {x: 444, y: 495, w: 25, h: 32},

  // Pohon kecil (top-down)
  tree_topdown: {x: 405, y: 522, w: 28, h: 32},
};

// Fungsi untuk render 1 tile dari CP_V1.0.4
function CityTile({tileKey, displaySize}) {
  const tile = CITY_TILES[tileKey];
  if (!tile) return null;

  // Scale: tile asli → ukuran tampil
  // Asumsi proporsi dipertahankan berdasarkan width
  const scale = displaySize / tile.w;
  const displayH = tile.h * scale;

  return (
    <div style={{
      width: displaySize,
      height: displayH,
      overflow: "hidden",
      position: "relative",
      imageRendering: "pixelated",
    }}>
      <img
        src="/assets/city/CP_V1.0.4.png"
        alt={tileKey}
        style={{
          position: "absolute",
          left: `-${tile.x * scale}px`,
          top: `-${tile.y * scale}px`,
          width: `${1024 * scale}px`,
          height: `${1024 * scale}px`,
          imageRendering: "pixelated",
          maxWidth: "none",
        }}
        draggable={false}
      />
    </div>
  );
}

// Traffic light dengan animasi merah->kuning->hijau looping
function AnimatedTrafficLight() {
  return (
    <div style={{
      width: 24, height: 50,
      filter: "drop-shadow(2px 2px 0 #000)",
      pointerEvents: "none"
    }}>
      {/* Tiang */}
      <div style={{
        position:"absolute", left:11, top:38, width:2, height:12,
        background:"#1a1a1a"
      }}/>
      {/* Box traffic light */}
      <div style={{
        position:"absolute", left:4, top:0, width:16, height:38,
        background:"#1a1a1a", borderRadius:3, border:"1px solid #333"
      }}>
        {/* Lampu (animated) */}
        <div style={{
          position:"absolute", left:4, top:3, width:8, height:8,
          borderRadius:"50%",
          background:"#3a0a0a",
          animation:"trafficCycle 4s infinite",
          animationDelay:"0s"
        }}/>
        <div style={{
          position:"absolute", left:4, top:14, width:8, height:8,
          borderRadius:"50%",
          background:"#1a1a1a"
        }}/>
        <div style={{
          position:"absolute", left:4, top:25, width:8, height:8,
          borderRadius:"50%",
          background:"#1a1a1a"
        }}/>
      </div>
    </div>
  );
}

function Decoration({deco}) {
  // Pilih tile berdasarkan tipe & variasi
  const pixelDecoMap = {
    "car":  ["car_red", "car_black", "truck_red", "bus_blue"],
    "lamp": ["lamp_post"],
    "sign": ["sign_yellow", "sign_white", "sign_stop"],
    "tree-small": ["tree_topdown"],
  };

  // Spesial: traffic light dengan animasi CSS (override 1 dari lamp)
  if (deco.type === "lamp" && Math.floor((deco.x + deco.y) / 31) % 2 === 1) {
    return (
      <div style={{
        position:"absolute",
        left:deco.x - 12,
        top:deco.y - 25,
        pointerEvents:"none",
        zIndex: 4
      }}>
        <AnimatedTrafficLight/>
      </div>
    );
  }

  // Untuk yang sudah dipixel art-kan
  if (pixelDecoMap[deco.type]) {
    const variants = pixelDecoMap[deco.type];
    const tileKey = variants[Math.floor((deco.x + deco.y) / 31) % variants.length];
    const sizes = {car: 60, lamp: 40, sign: 32, "tree-small": 36};
    const displaySize = sizes[deco.type];

    return (
      <div style={{
        position:"absolute",
        left:deco.x - displaySize/2,
        top:deco.y - displaySize/2,
        filter:"drop-shadow(2px 2px 0 #000)",
        pointerEvents:"none",
      }}>
        <CityTile tileKey={tileKey} displaySize={displaySize}/>
      </div>
    );
  }

  // Sisanya tetap emoji
  const emojiMap = {
    "hydrant": {icon:"🧯", size:24, sway:false},
    "trash": {icon:"🗑️", size:26, sway:false},
    "bench": {icon:"🪑", size:28, sway:false},
    "pole": {icon:"📡", size:30, sway:true},
    "plant": {icon:"🪴", size:24, sway:false},
  };
  const d = emojiMap[deco.type];
  if (!d) return null;
  return (
    <div style={{
      position:"absolute",
      left:deco.x - d.size/2, top:deco.y - d.size/2,
      fontSize:d.size,
      filter:"drop-shadow(2px 2px 0 #000)",
      animation:d.sway ? "windSway 1.5s ease-in-out infinite" : "none",
      transformOrigin:"bottom center", pointerEvents:"none"
    }}>{d.icon}</div>
  );
}

// ─── SHELTER ──────────────────────────────────────────────────
// BD001.png: 393x1104
// Layout sebenarnya: 3 kolom × 9 baris, tapi 3 kolom = 3 GEDUNG BERBEDA (bukan animasi!)
// Tiap tile: 131 × 122.67 pixel
// Baris yang dipakai untuk Rumah Kokoh: baris ke-8 (gedung biru) = index 7
// Kolom yang dipakai: kolom tengah (index 1) = bentuk paling rapi
const BUILDING_TILE_W = 131;        // lebar 1 gedung di sprite sheet
const BUILDING_TILE_H = 123;        // tinggi 1 gedung di sprite sheet
const BUILDING_ROW_INDEX = 7;       // baris ke-8 (gedung biru tinggi)
const BUILDING_COL_INDEX = 1;       // kolom tengah
const BUILDING_DISPLAY_W = 75;      // ukuran tampil
const BUILDING_DISPLAY_H = 70;

function PixelBuilding({isNear}) {
  // Scale factor
  const scaleX = BUILDING_DISPLAY_W / BUILDING_TILE_W;
  const scaleY = BUILDING_DISPLAY_H / BUILDING_TILE_H;

  return (
    <div style={{
      width: BUILDING_DISPLAY_W,
      height: BUILDING_DISPLAY_H,
      overflow: "hidden",
      position: "relative",
      imageRendering: "pixelated",
    }}>
      <img
        src="/assets/city/BD001.png"
        alt="building"
        style={{
          position: "absolute",
          // Offset untuk pilih tile spesifik
          left: `-${BUILDING_COL_INDEX * BUILDING_DISPLAY_W}px`,
          top: `-${BUILDING_ROW_INDEX * BUILDING_DISPLAY_H}px`,
          // Total ukuran image saat di-scale: 3 kolom × ukuran tampil
          width: `${3 * BUILDING_DISPLAY_W}px`,
          height: `${9 * BUILDING_DISPLAY_H}px`,
          imageRendering: "pixelated",
        }}
        draggable={false}
      />
    </div>
  );
}

function Shelter({shelter, isNear}) {
  const isHouse = shelter.safe === true;

  return (
    <div style={{
      position:"absolute",
      left:shelter.x - (isHouse ? BUILDING_DISPLAY_W/2 : 40),
      top:shelter.y - (isHouse ? BUILDING_DISPLAY_H/2 : 40),
      width: isHouse ? BUILDING_DISPLAY_W : 80,
      height: isHouse ? BUILDING_DISPLAY_H + 18 : 90,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"flex-end",
      filter: isNear ? "brightness(1.4) drop-shadow(0 0 12px #fbbf24)" : "drop-shadow(2px 2px 0 #000)",
      transition:"filter .15s", pointerEvents:"none"
    }}>
      {isHouse ? (
        <PixelBuilding isNear={isNear}/>
      ) : (
        <div style={{fontSize:54,lineHeight:1}}>{shelter.icon}</div>
      )}
      <div style={{
        fontFamily:"'Press Start 2P',monospace", fontSize:7,
        color:isNear?"#fbbf24":"#e2e8f0",
        background:"#000c", padding:"3px 5px", borderRadius:3,
        marginTop:2, whiteSpace:"nowrap"
      }}>
        {shelter.label ? `${shelter.name} ${shelter.label}` : shelter.name}
      </div>
    </div>
  );
}

// ─── CHARACTER (Sprite Sheet Animation) ──────────────────────
// Setiap sprite sheet: 288x24, 12 frame @ 24x24
const CHAR_FRAME_SIZE = 24;        // ukuran asli tiap frame
const CHAR_TOTAL_FRAMES = 12;      // jumlah frame per arah
const CHAR_DISPLAY_SIZE = 60;      // ukuran tampil di layar (scale up ~2.5x)
const CHAR_FRAME_DURATION = 80;    // ms per frame (lebih kecil = lebih cepat)

function Character({facing, moving, slowed}) {
  const [frame, setFrame] = useState(0);
  const lastFrameTime = useRef(Date.now());

  // Animasi frame: ganti frame tiap CHAR_FRAME_DURATION ms saat moving
  useEffect(() => {
    if (!moving) {
      setFrame(0);
      return;
    }
    let raf;
    const loop = () => {
      const now = Date.now();
      if (now - lastFrameTime.current >= CHAR_FRAME_DURATION) {
        setFrame(f => {
          const next = (f + 1) % CHAR_TOTAL_FRAMES;
          // Play footstep saat frame 3 dan 9 (kaki menapak tanah)
          if (next === 3 || next === 9) {
            playFootstep();
          }
          return next;
        });
        lastFrameTime.current = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [moving]);

  // Pilih sprite sheet berdasarkan arah hadap
  const spriteMap = {
    up:    "/assets/character/Walk Up.png",
    down:  "/assets/character/Walk Down.png",
    left:  "/assets/character/Walk Left.png",
    right: "/assets/character/Walk Right.png",
  };
  const spriteSrc = spriteMap[facing] || spriteMap.down;

  // Scaling factor: 24px asli → CHAR_DISPLAY_SIZE px tampil
  const scale = CHAR_DISPLAY_SIZE / CHAR_FRAME_SIZE;

  return (
    <div style={{
      width: CHAR_DISPLAY_SIZE,
      height: CHAR_DISPLAY_SIZE,
      overflow: "hidden",
      position: "relative",
      filter: slowed ? "hue-rotate(-30deg) brightness(0.7) saturate(1.5)" : "drop-shadow(2px 3px 0 #000)",
      imageRendering: "pixelated",  // PENTING: agar pixel art tetap tajam saat di-scale
    }}>
      <img
        src={spriteSrc}
        alt="character"
        style={{
          position: "absolute",
          left: `-${frame * CHAR_DISPLAY_SIZE}px`,
          top: 0,
          width: `${CHAR_TOTAL_FRAMES * CHAR_DISPLAY_SIZE}px`,
          height: `${CHAR_DISPLAY_SIZE}px`,
          imageRendering: "pixelated",
          // Frame 0 = idle saat tidak moving, frame 1-11 = animation
          // Image otomatis di-scale via width
        }}
        draggable={false}
      />
    </div>
  );
}

function DebrisVisual({debris}) {
  const sprites = ["🪵","📰","🍂","🌿","📦"];
  return (
    <div style={{
      position:"absolute",
      left:debris.x - debris.size/2,
      top:debris.y - debris.size/2,
      fontSize:debris.size,
      transform:`rotate(${debris.rot}deg)`,
      pointerEvents:"none",
      filter:"drop-shadow(1px 1px 0 #000)",
      willChange:"transform"
    }}>{sprites[debris.spriteIdx]}</div>
  );
}

function StormBg({intense = false}) {
  // Lebih banyak hujan + bervariasi
  const drops = useRef(
    Array.from({length:70},(_,i)=>({
      id:i, left:`${Math.random()*108}%`,
      delay:`${(Math.random()*2).toFixed(2)}s`,
      dur:`${(0.35+Math.random()*0.4).toFixed(2)}s`,
      h:`${16+Math.random()*18}px`,
      op:0.35+Math.random()*0.5
    }))
  ).current;

  // Awan badai bergerak di langit
  const clouds = useRef(
    Array.from({length:4},(_,i)=>({
      id:i,
      top:`${5 + i*12}%`,
      dur:`${25 + Math.random()*15}s`,
      delay:`${-i*6}s`,
      size:`${180 + Math.random()*120}px`,
      op:0.12 + Math.random()*0.15
    }))
  ).current;

  return (
    <>
      {/* Awan bergerak di langit */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:28}}>
        {clouds.map(c=>(
          <div key={c.id} style={{
            position:"absolute",
            top:c.top,
            width:c.size,
            height:"45px",
            background:`radial-gradient(ellipse at center, rgba(50,55,75,${c.op}), transparent 70%)`,
            animation:`cloudDrift ${c.dur} ${c.delay} infinite linear`,
            filter:"blur(8px)"
          }}/>
        ))}
      </div>

      {/* Vignette gelap di pinggir layar untuk efek atmosphere */}
      <div style={{
        position:"fixed",inset:0,pointerEvents:"none",zIndex:29,
        background:"radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)"
      }}/>

      {/* Petir kilat di langit (random) */}
      <div style={{
        position:"fixed",inset:0,pointerEvents:"none",zIndex:31,
        background:"linear-gradient(180deg, rgba(220,230,255,0.3) 0%, transparent 40%)",
        animation:"skyLightning 8s infinite ease-in-out"
      }}/>

      {/* Hujan deras */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:30}}>
        {drops.map(d=>(
          <div key={d.id} style={{
            position:"absolute",left:d.left,top:"-20px",
            width:"2px",height:d.h,
            background:`rgba(140,200,255,${d.op})`,
            animation:`rainFall ${d.dur} ${d.delay} infinite linear`,
            borderRadius:"0 0 50% 50%"
          }}/>
        ))}
      </div>
    </>
  );
}

// ─── MUTE BUTTON ──────────────────────────────────────────────
function MuteButton() {
  const [muted, setMuted] = useState(false);
  return (
    <button
      onClick={()=>{
        const newMuted = toggleMute();
        setMuted(newMuted);
      }}
      style={{
        background:"#0a1428", border:"1px solid #1b2f4a",
        padding:"6px 10px", borderRadius:6,
        cursor:"pointer", color:"#fbbf24",
        fontSize:14, lineHeight:1,
        fontFamily:"'Press Start 2P',monospace"
      }}
      title={muted ? "Unmute" : "Mute"}
    >{muted ? "🔇" : "🔊"}</button>
  );
}

// ─── MOBILE CONTROLS ──────────────────────────────────────────
function MobileControls({onPress, onRelease, onAction, nearShelter}) {
  const handleStart = (dir) => (e) => { e.preventDefault(); e.stopPropagation(); onPress(dir); };
  const handleEnd = (dir) => (e) => { e.preventDefault(); e.stopPropagation(); onRelease(dir); };

  const BTN_SIZE = 72;  // dari 54 → 72 (lebih besar, mudah ditekan)
  const GAP = 6;

  const dpadBtnStyle = {
    width: BTN_SIZE, height: BTN_SIZE,
    background:"rgba(15,30,56,0.78)",
    border:"3px solid rgba(56,189,248,0.7)",
    borderRadius:10,
    color:"#fbbf24", fontSize:28,
    display:"flex", alignItems:"center", justifyContent:"center",
    fontFamily:"'Press Start 2P',monospace",
    backdropFilter:"blur(4px)",
    boxShadow:"0 3px 10px rgba(0,0,0,0.6)",
    cursor:"pointer"
  };

  return (
    <>
      {/* D-Pad lebih besar di kiri bawah */}
      <div style={{
        position:"fixed", bottom:36, left:24, zIndex:100,
        display:"grid",
        gridTemplateColumns:`${BTN_SIZE}px ${BTN_SIZE}px ${BTN_SIZE}px`,
        gridTemplateRows:`${BTN_SIZE}px ${BTN_SIZE}px ${BTN_SIZE}px`,
        gap:GAP
      }}>
        <div></div>
        <button className="dpad-btn" style={dpadBtnStyle}
          onTouchStart={handleStart("up")} onTouchEnd={handleEnd("up")} onTouchCancel={handleEnd("up")}
          onMouseDown={handleStart("up")} onMouseUp={handleEnd("up")} onMouseLeave={handleEnd("up")}
        >▲</button>
        <div></div>

        <button className="dpad-btn" style={dpadBtnStyle}
          onTouchStart={handleStart("left")} onTouchEnd={handleEnd("left")} onTouchCancel={handleEnd("left")}
          onMouseDown={handleStart("left")} onMouseUp={handleEnd("left")} onMouseLeave={handleEnd("left")}
        >◀</button>
        <div style={{
          ...dpadBtnStyle,
          background:"rgba(15,30,56,0.4)",
          border:"3px dashed rgba(56,189,248,0.3)",
          cursor:"default"
        }}></div>
        <button className="dpad-btn" style={dpadBtnStyle}
          onTouchStart={handleStart("right")} onTouchEnd={handleEnd("right")} onTouchCancel={handleEnd("right")}
          onMouseDown={handleStart("right")} onMouseUp={handleEnd("right")} onMouseLeave={handleEnd("right")}
        >▶</button>

        <div></div>
        <button className="dpad-btn" style={dpadBtnStyle}
          onTouchStart={handleStart("down")} onTouchEnd={handleEnd("down")} onTouchCancel={handleEnd("down")}
          onMouseDown={handleStart("down")} onMouseUp={handleEnd("down")} onMouseLeave={handleEnd("down")}
        >▼</button>
        <div></div>
      </div>

      {/* Tombol Aksi lebih besar di kanan bawah */}
      <button className="dpad-btn"
        onTouchStart={(e)=>{e.preventDefault();onAction();}}
        onMouseDown={(e)=>{e.preventDefault();onAction();}}
        style={{
          position:"fixed", bottom:80, right:36, zIndex:100,
          width:120, height:120,
          background: nearShelter ? "rgba(251,191,36,0.9)" : "rgba(15,30,56,0.78)",
          border:`4px solid ${nearShelter?"#fbbf24":"rgba(56,189,248,0.7)"}`,
          borderRadius:"50%",
          color: nearShelter ? "#000" : "#fbbf24",
          fontFamily:"'Press Start 2P',monospace",
          fontSize: nearShelter ? 14 : 13,
          backdropFilter:"blur(4px)",
          boxShadow:"0 5px 15px rgba(0,0,0,0.6)",
          animation: nearShelter ? "pulseGlow 0.8s infinite" : "none",
          lineHeight: 1.4,
          cursor:"pointer"
        }}
      >
        {nearShelter ? "MASUK!" : "AKSI"}
      </button>
    </>
  );
}

// ─── INTRO ────────────────────────────────────────────────────
function IntroScreen({onStart}) {
  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(180deg,#020a18 0%,#060f20 60%,#030810 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:20,position:"relative",overflow:"hidden"
    }}>
      <StormBg/>
      <div style={{
        position:"relative",zIndex:40,maxWidth:480,width:"100%",
        textAlign:"center",animation:"popIn .5s"
      }}>
        <div style={{fontSize:56,marginBottom:12,animation:"pulseGlow 2s infinite"}}>🌪️</div>
        <h1 style={{fontFamily:"'Press Start 2P',monospace",fontSize:18,color:"#38bdf8",lineHeight:1.8,marginBottom:6}}>
          SELAMATKAN<br/>AKUUUU!!!
        </h1>
        <p style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:"#fbbf24",letterSpacing:2,marginBottom:24}}>
          URBAN ADVENTURE
        </p>

        <div style={{background:"#07101e",border:"1px solid #1b2f4a",borderRadius:12,padding:18,marginBottom:18,textAlign:"left"}}>
          <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"#475569",marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>
            Kontrol:
          </p>
          {[
            ["💻 PC","Arrow keys / WASD"],
            ["📱 Mobile","D-pad di layar"],
            ["🎯 Aksi","E / SPACE / Tombol MASUK"]
          ].map(([key,desc],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,fontFamily:"'Space Mono',monospace",fontSize:11}}>
              <span style={{color:"#fbbf24",fontWeight:"bold"}}>{key}</span>
              <span style={{color:"#94a3b8"}}>{desc}</span>
            </div>
          ))}
        </div>

        <div style={{background:"#07101e",border:"1px solid #1b2f4a",borderRadius:12,padding:18,marginBottom:24,textAlign:"left"}}>
          <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"#475569",marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>
            3 Level Tantangan:
          </p>
          {[
            ["🎯","Level 1: Pilih tempat aman dari badai"],
            ["⏱️","Level 2: Waktu mepet, pilih dekat & aman"],
            ["📐","Level 3: Hitung soal dulu + hindari puing!"]
          ].map(([icon,text],i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:8,fontFamily:"'Space Mono',monospace",fontSize:11,color:"#cbd5e1"}}>
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>

        <button className="btn" onClick={()=>{playClick();onStart();}} style={{
          background:"linear-gradient(135deg,#0ea5e9,#1d4ed8)",border:"none",borderRadius:10,
          padding:"14px 40px",fontFamily:"'Press Start 2P',monospace",fontSize:12,color:"white",
          cursor:"pointer",boxShadow:"0 4px 24px rgba(14,165,233,.4)"
        }}>▶ MULAI BERMAIN</button>
      </div>
    </div>
  );
}

// ─── LEVEL BRIEF ──────────────────────────────────────────────
function LevelBrief({level, config, onStart}) {
  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(180deg,#020a18 0%,#060f20 60%,#030810 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:20,position:"relative",overflow:"hidden"
    }}>
      <StormBg/>
      <div style={{
        position:"relative",zIndex:40,maxWidth:450,width:"100%",
        background:"#060e1c",border:"2px solid #38bdf8",
        borderRadius:16,padding:24,textAlign:"center",animation:"popIn .4s"
      }}>
        <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"#fbbf24",marginBottom:14}}>LEVEL {level}</div>
        <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:12,color:"#38bdf8",marginBottom:18,lineHeight:1.7}}>{config.title}</div>

        <div style={{background:"#0c1a2e",border:"1px solid #1b2f4a",borderRadius:10,padding:14,marginBottom:18,textAlign:"left"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontFamily:"'Space Mono',monospace",fontSize:11}}>
            <span style={{color:"#94a3b8"}}>⏱ Batas waktu:</span>
            <strong style={{color:"#f87171"}}>{config.timeLimit} detik</strong>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontFamily:"'Space Mono',monospace",fontSize:11}}>
            <span style={{color:"#94a3b8"}}>🏃 Kecepatan:</span>
            <strong style={{color:"#4ade80"}}>{config.walkSpeed} m/s</strong>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Space Mono',monospace",fontSize:11}}>
            <span style={{color:"#94a3b8"}}>🏠 Shelter:</span>
            <strong style={{color:"#fbbf24"}}>{config.shelters.length} pilihan</strong>
          </div>
          {config.hasObstacles && (
            <div style={{marginTop:10,padding:8,background:"#1c0404",borderRadius:6,fontFamily:"'Space Mono',monospace",fontSize:10,color:"#f87171",textAlign:"center",lineHeight:1.5}}>
              ⚠️ PUING TERBANG MENGHALANGI!
            </div>
          )}
        </div>

        <p style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#cbd5e1",marginBottom:18,lineHeight:1.5}}>
          {level===1 && "🗺️ Mode EKSPLORASI — waktu santai 60 detik. Eksplor kota & kenali tempat-tempat berlindung saat badai!"}
          {level===2 && "⏱️ Waktu MEPET! Pilih shelter yang AMAN dan paling DEKAT — tidak ada waktu untuk salah!"}
          {level===3 && "❤️ Ada 3 NYAWA. Pilih rumah dengan waktu tempuh PALING SEDIKIT. Salah pilih = -1 nyawa & respawn!"}
        </p>

        {/* Info khusus Level 3: Health system */}
        {level===3 && (
          <div style={{
            background:"#1c0404",border:"1px solid #f8717144",
            borderRadius:8,padding:10,marginBottom:14,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8
          }}>
            <span style={{fontSize:18}}>❤️❤️❤️</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#fecaca"}}>
              3 nyawa — gunakan dengan bijak!
            </span>
          </div>
        )}

        <button className="btn" onClick={()=>{playClick();onStart();}} style={{
          background:"linear-gradient(135deg,#0ea5e9,#1d4ed8)",border:"none",borderRadius:10,
          padding:"12px 32px",fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
        }}>▶ MULAI LEVEL {level}</button>
      </div>
    </div>
  );
}

// ─── PRE-LEVEL 3 QUIZ ─────────────────────────────────────────
function QuizScreen({config, onAnswer}) {
  const [selected, setSelected] = useState(null);
  const [showError, setShowError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const choices = config.safeChoices;
  const speed = config.walkSpeed;
  const correctLabel = config.correctLabel;

  // Sort by label A, B, C untuk tampilan
  const sortedChoices = [...choices].sort((a,b) => a.label.localeCompare(b.label));

  function handleChoose(label) {
    setSelected(label);
    if (label === correctLabel) {
      setTimeout(()=>onAnswer(true), 800);
    } else {
      setAttempts(a => a + 1);
      setShowError(true);
      setTimeout(()=>{
        setShowError(false);
        setSelected(null);
      }, 1500);
    }
  }

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(180deg,#1a1230 0%,#060f20 60%,#030810 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:20,position:"relative",overflow:"hidden"
    }}>
      <StormBg/>
      <div style={{
        position:"relative",zIndex:40,maxWidth:500,width:"100%",
        background:"#060e1c",border:"2px solid #a78bfa",
        borderRadius:16,padding:24,
        animation:"popIn .4s"
      }}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:10}}>📐</div>
          <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"#a78bfa",marginBottom:6}}>
            SOAL SEBELUM LEVEL 3
          </div>
          <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:8,color:"#fde68a",letterSpacing:1}}>
            BERPIKIR DULU, JALAN KEMUDIAN!
          </div>
        </div>

        <div style={{
          background:"#1a1230",border:"1px solid #a78bfa44",
          borderRadius:10,padding:14,marginBottom:16
        }}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#cbd5e1",lineHeight:1.7}}>
            Saat badai datang, ada <strong style={{color:"#4ade80"}}>3 rumah aman</strong> dengan jarak berbeda dari posisimu.
            Kecepatan larimu <strong style={{color:"#fbbf24"}}>{speed} m/s</strong>.
            <br/><br/>
            <strong style={{color:"#a78bfa"}}>Rumah mana yang waktu tempuhnya PALING SEDIKIT?</strong>
          </div>
        </div>

        <div style={{
          background:"#070f1c",border:"1px solid #1b2f4a",
          borderRadius:10,padding:14,marginBottom:16
        }}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#64748b",textAlign:"center",marginBottom:10,letterSpacing:1}}>
            📋 DATA JARAK
          </div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th style={{padding:"6px",textAlign:"left",fontSize:9,color:"#475569",fontFamily:"'Space Mono',monospace",borderBottom:"1px solid #1b2f4a"}}>Rumah</th>
                <th style={{padding:"6px",textAlign:"center",fontSize:9,color:"#475569",fontFamily:"'Space Mono',monospace",borderBottom:"1px solid #1b2f4a"}}>Jarak</th>
              </tr>
            </thead>
            <tbody>
              {sortedChoices.map(c=>(
                <tr key={c.id} style={{borderBottom:"1px solid #0f1d30"}}>
                  <td style={{padding:"10px 6px",fontFamily:"'Space Mono',monospace",fontSize:12,color:"#e2e8f0"}}>
                    🏠 Rumah {c.label}
                  </td>
                  <td style={{padding:"10px 6px",textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:13,color:"#38bdf8",fontWeight:"bold"}}>
                    {c.distance} m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#94a3b8",textAlign:"center",marginBottom:14,letterSpacing:1}}>
          💡 PILIH JAWABANMU:
        </div>

        <div style={{
          display:"grid",
          gridTemplateColumns:"1fr 1fr 1fr",
          gap:10,
          marginBottom:14
        }}>
          {sortedChoices.map(c=>{
            const isSelected = selected === c.label;
            const isWrong = isSelected && c.label !== correctLabel;
            const isCorrect = isSelected && c.label === correctLabel;
            return (
              <button
                key={c.id}
                className="answer-btn"
                onClick={()=>!selected && handleChoose(c.label)}
                disabled={selected !== null}
                style={{
                  background: isCorrect ? "#064e3b" : isWrong ? "#7f1d1d" : "#0c1a2e",
                  border: `2px solid ${isCorrect ? "#4ade80" : isWrong ? "#f87171" : "#1b2f4a"}`,
                  borderRadius:10,
                  padding:"14px 8px",
                  cursor: selected ? "default" : "pointer",
                  textAlign:"center",
                  animation: isWrong ? "shakeAnswer .4s" : "none"
                }}
              >
                <div style={{fontSize:30,marginBottom:6}}>🏠</div>
                <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:16,color:isCorrect?"#4ade80":isWrong?"#f87171":"#fbbf24"}}>
                  {c.label}
                </div>
              </button>
            );
          })}
        </div>

        {showError && (
          <div style={{
            background:"#7f1d1d",border:"1px solid #f87171",
            borderRadius:8,padding:10,
            fontFamily:"'Space Mono',monospace",fontSize:10,color:"#fecaca",
            textAlign:"center",lineHeight:1.5,marginBottom:10
          }}>
            ❌ Salah! Coba hitung lagi: jarak ÷ kecepatan = waktu. <br/>
            Yang paling sedikit waktunya = jarak paling pendek!
          </div>
        )}

        {attempts >= 2 && !showError && !selected && (
          <div style={{
            background:"#1a1230",border:"1px solid #a78bfa44",
            borderRadius:8,padding:10,
            fontFamily:"'Space Mono',monospace",fontSize:10,color:"#a78bfa",
            textAlign:"center",lineHeight:1.6
          }}>
            💡 <strong>Hint:</strong> Bandingkan angka jarak. Yang paling kecil = waktu tempuh paling sedikit!
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GAME LEVEL ───────────────────────────────────────────────
function GameLevel({level, config, onResult}) {
  const [charX, setCharX] = useState(config.spawnX);
  const [charY, setCharY] = useState(config.spawnY);
  const [facing, setFacing] = useState("down");
  const [moving, setMoving] = useState(false);
  const [slowed, setSlowed] = useState(false);
  const [hitCount, setHitCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.timeLimit);
  const [nearShelterId, setNearShelterId] = useState(null);
  const [viewport, setViewport] = useState({w:window.innerWidth, h:window.innerHeight});
  const [debrisList, setDebrisList] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  // Manual override: user bisa paksa show/hide controls
  const [forceShowControls, setForceShowControls] = useState(false);
  // Level 3: health system (3 nyawa)
  const [health, setHealth] = useState(3);
  const [respawnFeedback, setRespawnFeedback] = useState(null);
  const [isPausedDisplay, setIsPausedDisplay] = useState(false);  // untuk UI badge

  const touchKeys = useRef({});
  const keys = useRef({});
  const charXRef = useRef(config.spawnX);
  const charYRef = useRef(config.spawnY);
  const slowedUntil = useRef(0);
  const lastHitTime = useRef(0);
  const animRef = useRef();
  const startTime = useRef(Date.now());
  const ended = useRef(false);
  const debrisRef = useRef([]);
  const lastDebrisSpawn = useRef(0);
  const healthRef = useRef(3);
  const respawnLockUntil = useRef(0); // hindari double-trigger respawn
  const timerPaused = useRef(false);    // pause timer saat respawn, lanjut saat input
  const eKeyConsumed = useRef(false);   // tombol E harus dilepas dulu setelah respawn
  const lastLoopTime = useRef(0);       // untuk delta-time agar kecepatan konstan di semua refresh rate

  useEffect(()=>{
    const checkMobile = () => {
      const w = window.innerWidth;
      const ua = navigator.userAgent || "";
      // Deteksi PASTI mobile via user agent (paling reliable)
      const isMobileUA = /android|iphone|ipad|ipod|webos|blackberry|opera mini|iemobile/i.test(ua);
      // Atau layar SANGAT kecil (HP portrait <700px)
      const isSmallScreen = w < 700;
      // CATATAN: TIDAK pakai 'hasTouch' karena banyak laptop touchscreen dengan layar besar
      // yang sebenarnya pemain mau pakai keyboard
      setIsMobile(isMobileUA || isSmallScreen);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return ()=>window.removeEventListener("resize", checkMobile);
  },[]);

  // Start rain sound saat masuk level
  useEffect(()=>{
    startRainSound();
    return ()=>{
      stopRainSound();
    };
  },[]);

  useEffect(()=>{
    if (!config.hasObstacles) return;
    const initial = Array.from({length:6},()=>spawnDebris(config));
    debrisRef.current = initial;
    setDebrisList(initial);
  // eslint-disable-next-line
  },[]);

  function spawnDebris(cfg) {
    const fromLeft = Math.random() > 0.5;
    return {
      id: Math.random().toString(36).slice(2),
      x: fromLeft ? -50 : cfg.mapWidth + 50,
      y: Math.random() * cfg.mapHeight,
      vx: (fromLeft ? 1 : -1) * (3 + Math.random()*2),
      vy: (Math.random() - 0.5) * 0.5,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      size: 28 + Math.random() * 14,
      spriteIdx: Math.floor(Math.random() * 5)
    };
  }

  useEffect(()=>{
    const onResize = ()=>setViewport({w:window.innerWidth, h:window.innerHeight});
    window.addEventListener("resize", onResize);
    return ()=>window.removeEventListener("resize", onResize);
  },[]);

  useEffect(()=>{
    const handleDown = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowleft","arrowright","arrowup","arrowdown","a","d","w","s","e"," "].includes(k)) {
        e.preventDefault();
      }
      keys.current[k] = true;
      if (e.key === " ") keys.current["space"] = true;
    };
    const handleUp = (e) => {
      keys.current[e.key.toLowerCase()] = false;
      if (e.key === " ") keys.current["space"] = false;
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return ()=>{
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  },[]);

  useEffect(()=>{
    const t = setInterval(()=>{
      // PAUSE: skip decrement saat timer dipause (saat respawn menunggu input)
      if (timerPaused.current) return;

      setTimeLeft(prev => {
        if (prev <= 1) {
          // === LEVEL 3: timeout = kurangi nyawa + respawn (jika masih ada) ===
          if (config.isLevel3 && !ended.current) {
            const newHealth = healthRef.current - 1;
            healthRef.current = newHealth;
            setHealth(newHealth);

            if (newHealth <= 0) {
              clearInterval(t);
              ended.current = true;
              onResult({type:"timeout", isLevel3:true, healthExhausted:true});
              return 0;
            }

            // Respawn + PAUSE timer sampai pemain bergerak
            charXRef.current = config.spawnX;
            charYRef.current = config.spawnY;
            setCharX(config.spawnX);
            setCharY(config.spawnY);
            startTime.current = Date.now();
            timerPaused.current = true;  // ⏸ pause timer
            setIsPausedDisplay(true);

            playLightning();

            setRespawnFeedback({
              title: "⏱️ WAKTU HABIS!",
              message: "Kamu kehabisan waktu! Bergerak untuk memulai timer lagi.",
              type: "timeout"
            });
            setTimeout(()=>setRespawnFeedback(null), 2500);

            return config.timeLimit;
          }

          // === LEVEL 1 & 2: game over ===
          clearInterval(t);
          if (!ended.current) {
            ended.current = true;
            onResult({type:"timeout", isLevel3: config.isLevel3});
          }
          return 0;
        }
        return prev - 1;
      });
    },1000);
    return ()=>clearInterval(t);
  // eslint-disable-next-line
  },[onResult]);

  const handleMobilePress = useCallback((dir) => { touchKeys.current[dir] = true; },[]);
  const handleMobileRelease = useCallback((dir) => { touchKeys.current[dir] = false; },[]);
  const handleMobileAction = useCallback(() => {
    keys.current["e"] = true;
    setTimeout(()=>{ keys.current["e"] = false; }, 100);
  },[]);

  useEffect(()=>{
    const loop = ()=>{
      if (ended.current) return;
      const now = performance.now();  // Lebih akurat dari Date.now() di mobile
      const dateNow = Date.now();     // untuk compatibility dengan timing lain
      const k = keys.current;
      const t = touchKeys.current;

      // === DELTA TIME (frame-rate independent) ===
      // Hitung selisih waktu sejak frame terakhir (dalam detik)
      let deltaSec = 1/60; // default fallback
      if (lastLoopTime.current > 0) {
        deltaSec = (now - lastLoopTime.current) / 1000;
        // Clamp: minimum 1/120 (saat HP 120Hz), maksimum 1/20 (saat lag berat)
        deltaSec = Math.max(1/120, Math.min(0.05, deltaSec));
      }
      lastLoopTime.current = now;

      const isSlowed = dateNow < slowedUntil.current;
      if (isSlowed !== slowed) setSlowed(isSlowed);

      // walkSpeed (m/s) × PX_PER_METER (px/m) = pixel per detik
      // dikali deltaSec → pixel per frame (tergantung refresh rate)
      const pixelPerSec = config.walkSpeed * PX_PER_METER;
      const baseSpeed = pixelPerSec * deltaSec;
      const effSpeed = baseSpeed * (isSlowed ? SLOW_FACTOR : 1);

      let nx = charXRef.current;
      let ny = charYRef.current;
      let newFacing = null;
      let dx = 0, dy = 0;

      if (k["arrowup"]||k["w"]||t["up"]) { dy -= 1; newFacing = "up"; }
      if (k["arrowdown"]||k["s"]||t["down"]) { dy += 1; newFacing = "down"; }
      if (k["arrowleft"]||k["a"]||t["left"]) { dx -= 1; newFacing = "left"; }
      if (k["arrowright"]||k["d"]||t["right"]) { dx += 1; newFacing = "right"; }

      const movingNow = dx !== 0 || dy !== 0;
      if (dx !== 0 && dy !== 0) {
        const inv = 1/Math.sqrt(2);
        dx *= inv; dy *= inv;
      }

      // Resume timer saat player mulai bergerak (setelah respawn yang pause timer)
      if (movingNow && timerPaused.current) {
        timerPaused.current = false;
        startTime.current = Date.now();
        setIsPausedDisplay(false);
      }

      // === COLLISION SYSTEM (sliding wall) ===
      // Coba bergerak di X dulu — kalau collide, batal X movement
      // Lalu coba bergerak di Y — kalau collide, batal Y movement
      // Hasilnya: karakter "slide" di sepanjang dinding obstacle
      const tryX = charXRef.current + dx * effSpeed;
      const tryY = charYRef.current + dy * effSpeed;

      const charR = 14;  // radius hitbox karakter

      // Cek collide setiap obstacle
      const obstacles = config.obstacles || [];

      let resultX = tryX;
      let resultY = charYRef.current;
      // Test movement di X
      if (dx !== 0) {
        const collideX = obstacles.some(o =>
          rectCircleCollide(o.x, o.y, o.w, o.h, resultX, resultY, charR)
        );
        if (collideX) resultX = charXRef.current; // batal X
      }
      // Test movement di Y dengan resultX yang sudah ditentukan
      resultY = tryY;
      if (dy !== 0) {
        const collideY = obstacles.some(o =>
          rectCircleCollide(o.x, o.y, o.w, o.h, resultX, resultY, charR)
        );
        if (collideY) resultY = charYRef.current; // batal Y
      }

      nx = Math.max(20, Math.min(config.mapWidth-20, resultX));
      ny = Math.max(20, Math.min(config.mapHeight-20, resultY));

      charXRef.current = nx;
      charYRef.current = ny;
      setCharX(nx);
      setCharY(ny);
      if (newFacing) setFacing(newFacing);
      setMoving(movingNow);

      if (config.hasObstacles) {
        // Scale debris velocity dengan deltaSec * 60 (asumsi vx/vy didesain untuk 60fps)
        const debrisScale = deltaSec * 60;
        let updated = debrisRef.current.map(d => ({
          ...d,
          x: d.x + d.vx * debrisScale,
          y: d.y + d.vy * debrisScale,
          rot: d.rot + d.rotSpeed * debrisScale
        }));
        updated = updated.filter(d =>
          d.x > -100 && d.x < config.mapWidth + 100 &&
          d.y > -100 && d.y < config.mapHeight + 100
        );
        if (dateNow - lastDebrisSpawn.current > 1000 && updated.length < 8) {
          updated.push(spawnDebris(config));
          lastDebrisSpawn.current = dateNow;
        }
        if (dateNow - lastHitTime.current > HIT_COOLDOWN) {
          for (const d of updated) {
            const dist = Math.hypot(d.x - nx, d.y - ny);
            const threshold = (d.size/2) * 0.6 + CHAR_HITBOX/2;
            if (dist < threshold) {
              lastHitTime.current = dateNow;
              slowedUntil.current = dateNow + SLOW_DURATION;
              setHitCount(h => h + 1);
              break;
            }
          }
        }
        debrisRef.current = updated;
        setDebrisList(updated);
      }

      // Reset eKeyConsumed flag saat tombol E dilepas
      if (!k["e"] && !k["space"]) {
        eKeyConsumed.current = false;
      }

      let near = null;
      let minDist = Infinity;
      for (const sh of config.shelters) {
        const d = Math.hypot(sh.x - nx, sh.y - ny);
        if (d < 60 && d < minDist) { minDist = d; near = sh; }
      }
      setNearShelterId(near ? near.id : null);

      if ((k["e"]||k["space"]) && !eKeyConsumed.current && near && !ended.current) {
        eKeyConsumed.current = true;  // tandai E sudah dipakai
        const elapsedSec = (Date.now() - startTime.current) / 1000;
        const timeLeftAtChoice = Math.max(0, config.timeLimit - elapsedSec);
        const actualDistance = distanceMeters(config.spawnX, config.spawnY, near.x, near.y);

        // === LEVEL 3 HEALTH SYSTEM ===
        if (config.isLevel3) {
          const sh = near;
          // Cek apakah pilihan benar (Rumah A/B/C dengan label benar + sampai tepat waktu)
          let mistakeType = null;
          let feedbackTitle = "";
          let feedbackMsg = "";

          if (sh.safe) {
            // Pilih rumah → cek label benar
            if (sh.label !== config.correctLabel) {
              mistakeType = "wrong_house";
              feedbackTitle = "❌ RUMAH SALAH!";
              feedbackMsg = `Rumah ${sh.label} bukan yang terdekat! Yang benar adalah Rumah ${config.correctLabel} (jarak paling pendek = waktu tempuh paling sedikit). Hitung lagi dengan teliti!`;
            } else {
              // Pilih rumah benar & sudah sampai sebelum timer habis → MENANG
              // (Tidak perlu cek timeNeeded vs timeLeft, karena player sudah sampai!)
              ended.current = true;
              onResult({type:"chose", shelter:near, elapsedSec, timeLeftAtChoice, actualDistance, hitCount, healthRemaining: healthRef.current});
              return;
            }
          } else {
            // Pilih shelter bahaya (pohon/halte/reot)
            mistakeType = "wrong_shelter";
            feedbackTitle = "❌ SHELTER BAHAYA!";
            feedbackMsg = sh.reason;
          }

          // Kurangi nyawa & respawn
          const newHealth = healthRef.current - 1;
          healthRef.current = newHealth;
          setHealth(newHealth);

          if (newHealth <= 0) {
            // Game over total
            ended.current = true;
            onResult({type:"chose", shelter:near, elapsedSec, timeLeftAtChoice, actualDistance, hitCount, mistakeType, gameOver:true});
            return;
          }

          // Respawn ke spawn point
          charXRef.current = config.spawnX;
          charYRef.current = config.spawnY;
          setCharX(config.spawnX);
          setCharY(config.spawnY);
          // Hilangkan respawnLock yang bikin player tidak bisa gerak.
          // Sebagai gantinya, pause timer; akan resume saat player gerak.
          respawnLockUntil.current = 0;

          // RESET TIMER & PAUSE — akan jalan lagi saat player bergerak pertama kali
          setTimeLeft(config.timeLimit);
          startTime.current = Date.now();
          timerPaused.current = true;
          setIsPausedDisplay(true);
          // Tandai E sudah dikonsumsi: pemain harus lepas dulu sebelum tekan lagi
          eKeyConsumed.current = true;
          // Reset key state untuk movement juga, supaya tidak ada residual input
          keys.current["e"] = false;
          keys.current["space"] = false;

          // Suara petir kecil saat respawn
          playLightning();

          // Tampilkan feedback popup
          setRespawnFeedback({
            title: feedbackTitle,
            message: feedbackMsg,
            type: mistakeType
          });
          // Auto-hide popup setelah 2.5s
          setTimeout(()=>setRespawnFeedback(null), 2500);
          // CRITICAL: continue the loop, jangan return! Tanpa ini animasi berhenti.
          animRef.current = requestAnimationFrame(loop);
          return;
        }

        // === LEVEL 1 & 2: langsung result (tidak ada health) ===
        ended.current = true;
        onResult({type:"chose", shelter:near, elapsedSec, timeLeftAtChoice, actualDistance, hitCount});
        return;
      }

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line
  },[]);

  // Mobile: zoom out sedikit (0.75x) agar viewport menampilkan area lebih luas
  // Akibatnya karakter terlihat bergerak lebih cepat secara relatif terhadap map
  const zoom = isMobile ? 0.75 : 1;
  const effectiveViewportW = viewport.w / zoom;
  const effectiveViewportH = viewport.h / zoom;
  const camX = Math.max(0, Math.min(config.mapWidth - effectiveViewportW, charX - effectiveViewportW/2));
  const camY = Math.max(0, Math.min(config.mapHeight - effectiveViewportH, charY - effectiveViewportH/2));
  const panic = timeLeft <= 5;

  return (
    <div style={{
      minHeight:"100vh",
      background:"#0a0a14",
      position:"relative",overflow:"hidden",
      animation: panic ? "screenShake .3s infinite" : "none"
    }}>
      <StormBg/>

      <div style={{
        position:"absolute", left:0, top:0,
        width:config.mapWidth, height:config.mapHeight,
        transform:`scale(${zoom}) translate(${-camX}px, ${-camY}px)`,
        transformOrigin: "top left",
        transition:"transform .08s linear"
      }}>
        {/* City grid (jalan + blok kota) sebagai background */}
        <CityGrid config={config}/>

        {/* Gedung dekorasi di atas city blocks */}
        {config.buildings?.map((b,i)=>(<Building key={`b-${i}`} building={b}/>))}

        {/* Dekorasi (mobil, lampu, dll) di trotoar */}
        {config.decorations?.map((d,i)=>(<Decoration key={`deco-${i}`} deco={d}/>))}

        <div style={{
          position:"absolute",
          left:config.spawnX - 30, top:config.spawnY - 30,
          width:60, height:60,
          border:"2px dashed #38bdf877", borderRadius:"50%",
          pointerEvents:"none"
        }}/>

        {config.shelters.map(sh => (
          <Shelter key={sh.id} shelter={sh} isNear={nearShelterId === sh.id}/>
        ))}

        {debrisList.map(d => (<DebrisVisual key={d.id} debris={d}/>))}

        <div style={{
          position:"absolute",
          left:charX - 30, top:charY - 30,
          zIndex:10,
          animation: slowed ? "hitFlash .4s ease-in-out infinite" : "none"
        }}>
          <Character facing={facing} moving={moving} slowed={slowed}/>
        </div>

        {nearShelterId && !isMobile && (
          <div style={{
            position:"absolute",
            left:charX - 45, top:charY - 70,
            background:"#fbbf24", color:"#000",
            padding:"4px 8px", borderRadius:4,
            fontFamily:"'Press Start 2P',monospace", fontSize:8,
            animation:"pulseGlow 1s infinite",
            whiteSpace:"nowrap", zIndex:11
          }}>⏎ TEKAN E</div>
        )}
      </div>

      <div style={{
        position:"fixed",top:0,left:0,right:0,zIndex:50,
        padding:"12px 16px",
        background:"linear-gradient(180deg,rgba(0,0,0,.85),transparent)",
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:8
      }}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{background:"#0a1428",border:"1px solid #1b2f4a",padding:"6px 12px",borderRadius:6}}>
            <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,color:"#fbbf24"}}>LEVEL {level}</span>
          </div>
          <MuteButton/>
          {/* Toggle Mobile Controls — manual override */}
          <button
            onClick={()=>setForceShowControls(v=>!v)}
            style={{
              background:(isMobile || forceShowControls) ? "#1e3a8a" : "#0a1428",
              border:"1px solid #1b2f4a",
              padding:"6px 10px", borderRadius:6,
              cursor:"pointer", color:"#fbbf24",
              fontSize:14, lineHeight:1,
              fontFamily:"'Press Start 2P',monospace"
            }}
            title="Toggle on-screen controls (D-pad)"
          >🎮</button>
        </div>

        {/* Health Bar — hanya di Level 3 */}
        {config.isLevel3 && (
          <div style={{
            background:"#0a1428",border:"1px solid #1b2f4a",
            padding:"6px 10px",borderRadius:6,
            display:"flex",alignItems:"center",gap:4
          }}>
            {[0,1,2].map(i=>(
              <span key={i} style={{
                fontSize:16, lineHeight:1,
                opacity: i < health ? 1 : 0.2,
                filter: i < health ? "drop-shadow(0 0 4px #f87171)" : "grayscale(1)",
                transition:"opacity .3s, filter .3s"
              }}>❤️</span>
            ))}
          </div>
        )}

        {config.hasObstacles && (
          <div style={{background:"#0a1428",border:"1px solid #1b2f4a",padding:"6px 10px",borderRadius:6}}>
            <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:slowed?"#f87171":"#94a3b8"}}>
              💥 {hitCount}
            </span>
          </div>
        )}

        <div style={{
          background:isPausedDisplay?"#1a1230":panic?"#1c0404":"#0a1428",
          border:`1px solid ${isPausedDisplay?"#a78bfa":panic?"#f87171":"#1b2f4a"}`,
          padding:"6px 12px",borderRadius:6,
          animation: (panic && !isPausedDisplay) ? "shakeX .35s infinite" : "none"
        }}>
          <span style={{
            fontFamily:"'Press Start 2P',monospace",fontSize:12,
            color: isPausedDisplay?"#a78bfa":panic?"#f87171":"#4ade80"
          }}>
            {isPausedDisplay ? "⏸" : "⏱"} {timeLeft}s
          </span>
        </div>
      </div>

      {slowed && (
        <div style={{
          position:"fixed", top:"50%", left:"50%",
          transform:"translate(-50%, -50%)",
          background:"#f87171dd", color:"#fff",
          padding:"8px 16px", borderRadius:6,
          fontFamily:"'Press Start 2P',monospace", fontSize:10,
          zIndex:60, pointerEvents:"none",
          animation:"pulseGlow .6s infinite"
        }}>🐌 LAMBAT!</div>
      )}

      {/* Respawn Feedback Popup (Level 3 saat salah pilih) */}
      {respawnFeedback && (
        <div style={{
          position:"fixed",
          top:"50%", left:"50%",
          transform:"translate(-50%, -50%)",
          background:"#1c0404",
          border:"2px solid #f87171",
          borderRadius:12,
          padding:"18px 22px",
          maxWidth:380, width:"90%",
          zIndex:70,
          pointerEvents:"none",
          animation:"popIn .3s cubic-bezier(.34,1.56,.64,1)",
          boxShadow:"0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(248,113,113,0.4)"
        }}>
          <div style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:12,
            color:"#f87171", textAlign:"center",
            marginBottom:10, lineHeight:1.5
          }}>{respawnFeedback.title}</div>
          <div style={{
            fontFamily:"'Space Mono',monospace", fontSize:11,
            color:"#fecaca", lineHeight:1.6, textAlign:"center",
            marginBottom:10
          }}>{respawnFeedback.message}</div>
          <div style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:9,
            color:"#fbbf24", textAlign:"center",
            paddingTop:8, borderTop:"1px solid #f8717144"
          }}>
            ❤️ Sisa nyawa: {health}/3 — Kembali ke awal!
          </div>
        </div>
      )}

      {/* Badge "BERGERAK UNTUK MULAI" — saat timer paused TANPA popup */}
      {isPausedDisplay && !respawnFeedback && (
        <div style={{
          position:"fixed",
          top:"55%", left:"50%",
          transform:"translate(-50%, -50%)",
          background:"#1a1230ee",
          border:"2px solid #a78bfa",
          borderRadius:10,
          padding:"12px 22px",
          zIndex:65,
          pointerEvents:"none",
          backdropFilter:"blur(4px)",
          animation:"pulseGlow 1s infinite"
        }}>
          <div style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:11,
            color:"#a78bfa", textAlign:"center", lineHeight:1.5
          }}>⏸ TIMER PAUSED</div>
          <div style={{
            fontFamily:"'Space Mono',monospace", fontSize:10,
            color:"#cbd5e1", textAlign:"center", marginTop:6
          }}>Bergerak untuk mulai!</div>
        </div>
      )}

      {/* Reminder soal di level 3 — sisakan ruang untuk minimap di kanan */}
      {config.isLevel3 && (
        <div style={{
          position:"fixed",
          top: isMobile ? 144 : 56,  // di mobile, taruh DI BAWAH minimap
          left:8,
          right: isMobile ? 8 : 200,  // di desktop, beri ruang untuk minimap
          zIndex:50,
          background:"#1a1230ee",border:"1px solid #a78bfa44",
          borderRadius:8,padding:"6px 10px",
          backdropFilter:"blur(4px)",textAlign:"center"
        }}>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#a78bfa"}}>
            🎯 Cari <strong style={{color:"#fbbf24"}}>Rumah {config.correctLabel}</strong> — yang sudah kamu hitung!
          </span>
        </div>
      )}

      {/* Minimap — tunjukkan posisi semua shelter & player (semua level) */}
      <div style={{
        position:"fixed",
        top: isMobile ? 56 : 90,
        right: isMobile ? 8 : 16,
        zIndex:55,
        width: isMobile ? 110 : 160,
        height: isMobile ? 82 : 120,
        background:"#0a1428dd",
        border:"2px solid #a78bfa66",
        borderRadius:8,
        padding: isMobile ? 4 : 6,
        backdropFilter:"blur(4px)"
      }}>
          <div style={{
            fontFamily:"'Press Start 2P',monospace",fontSize:7,color:"#a78bfa",
            textAlign:"center",marginBottom:3
          }}>🗺️ PETA MINI</div>
          <div style={{
            position:"relative",
            width:"100%", height: isMobile ? 56 : 90,
            background:"#000",
            borderRadius:4,
            overflow:"hidden"
          }}>
            {/* Shelter markers (scaled to minimap) */}
            {config.shelters.map(s => {
              const innerW = isMobile ? 100 : 148;
              const innerH = isMobile ? 54 : 86;
              const mx = (s.x / config.mapWidth) * innerW;
              const my = (s.y / config.mapHeight) * innerH;
              const isHouse = s.safe === true;
              // Catatan: SEMUA rumah terlihat SAMA di minimap (hijau)
              // Pemain harus eksplor & hitung untuk tahu mana yang benar
              return (
                <div key={`mini-${s.id}`} style={{
                  position:"absolute",
                  left:mx-3, top:my-3,
                  width:6, height:6,
                  borderRadius: isHouse ? 0 : "50%",
                  background: isHouse ? "#4ade80" : "#f87171",
                }}
                title={isHouse ? `Rumah ${s.label || ""}` : s.name}/>
              );
            })}
            {/* Player position */}
            <div style={{
              position:"absolute",
              left:(charX / config.mapWidth) * (isMobile ? 100 : 148) - 3,
              top:(charY / config.mapHeight) * (isMobile ? 54 : 86) - 3,
              width:6, height:6,
              borderRadius:"50%",
              background:"#38bdf8",
              boxShadow:"0 0 6px #38bdf8",
              animation:"pulseGlow 1.2s infinite"
            }}/>
            {/* Spawn point marker */}
            <div style={{
              position:"absolute",
              left:(config.spawnX / config.mapWidth) * (isMobile ? 100 : 148) - 4,
              top:(config.spawnY / config.mapHeight) * (isMobile ? 54 : 86) - 4,
              width:8, height:8,
              borderRadius:"50%",
              border:"1px dashed #94a3b8",
              opacity:0.5
            }}/>
          </div>
          {!isMobile && (
            <div style={{
              display:"flex",justifyContent:"space-between",
              fontFamily:"'Space Mono',monospace",fontSize:7,color:"#94a3b8",
              marginTop:3
            }}>
              <span>🟢 Rumah</span>
              <span>🔴 Bahaya</span>
              <span>🔵 Kamu</span>
            </div>
          )}
        </div>

      {!isMobile && (
        <div style={{
          position:"fixed",bottom:8,left:0,right:0,zIndex:50,
          textAlign:"center",
          fontFamily:"'Space Mono',monospace",fontSize:9,color:"#94a3b8",
          textShadow:"1px 1px 0 #000"
        }}>
          ⬅⬆⬇➡ atau WASD | E saat dekat shelter
        </div>
      )}

      {(isMobile || forceShowControls) && (
        <MobileControls
          onPress={handleMobilePress}
          onRelease={handleMobileRelease}
          onAction={handleMobileAction}
          nearShelter={!!nearShelterId}
        />
      )}
    </div>
  );
}

// ─── RESULT ───────────────────────────────────────────────────
function ResultScreen({result, level, onContinue, onRetry, onHome}) {
  const isWin = result.type === "win";
  const accent = isWin ? "#4ade80" : "#f87171";

  // Play sound saat result muncul
  useEffect(()=>{
    stopRainSound();  // Stop rain saat result screen
    if (isWin) {
      playWin();
    } else {
      playLightning();
      setTimeout(playLose, 300);
    }
  },[isWin]);

  let title, subtitle, icon, reason;
  if (isWin) {
    title = "SELAMAT!"; subtitle = "KAMU AMAN DARI BADAI!"; icon = "🎉";
    reason = result.shelter.reason;
    if (result.healthRemaining !== undefined) {
      reason += ` Sisa nyawa: ❤️ ${result.healthRemaining}/3.`;
    }
    if (result.hitCount > 0) {
      reason += ` (Kamu tertabrak ${result.hitCount}x puing — masih bisa lebih cepat lagi!)`;
    }
  } else if (result.type === "timeout") {
    title = "WAKTU HABIS!"; subtitle = "PETIR MENYAMBARMU!"; icon = "⚡";
    if (result.isLevel3) {
      reason = "Waktu habis! Saat bencana, kamu harus bertindak CEPAT dan tepat. Pilih rumah dengan jarak TERPENDEK agar selalu selamat!";
    } else {
      reason = "Kamu terlalu lama! Saat bencana, BERTINDAK CEPAT adalah kunci!";
    }
  } else if (result.type === "too_slow") {
    title = "TIDAK SAMPAI!"; subtitle = "PETIR MENYAMBAR DI JALAN!"; icon = "⚡";
    reason = result.shelter.reason + ` Butuh ${result.timeNeeded.toFixed(1)}s, sisa hanya ${result.timeLeft.toFixed(1)}s.`;
  } else if (result.type === "health_depleted") {
    title = "NYAWA HABIS!"; subtitle = "KAMU GAGAL SELAMAT!"; icon = "💔";
    if (result.mistakeType === "wrong_house") {
      reason = `Kamu beberapa kali memilih rumah yang SALAH. Rumah ${result.correctLabel} adalah jawaban yang benar (jarak paling pendek = waktu tempuh paling sedikit). Ingat: saat bencana, hitung baik-baik mana shelter terdekat!`;
    } else if (result.mistakeType === "wrong_shelter") {
      reason = `Kamu beberapa kali memilih shelter yang TIDAK AMAN (pohon/halte/bangunan reot). Hanya RUMAH KOKOH yang aman saat badai. Pelajari lagi tipe-tipe shelter yang benar!`;
    } else {
      reason = "Kamu kehabisan nyawa karena terlalu sering salah pilih. Coba pelajari lagi tipe shelter aman dan hitung jarak dengan teliti!";
    }
  } else if (result.type === "wrong_house") {
    title = "TERLALU JAUH!"; subtitle = "KAMU TIDAK SELAMAT!"; icon = "⚡";
    reason = `Rumah ${result.shelter.label} terlalu jauh — kamu tidak akan sampai tepat waktu. Hati-hati, potensi bencana lebih tinggi jika memilih shelter yang jauh! Rumah ${result.correctLabel} yang paling dekat (waktu tempuh tercepat) adalah jawaban yang benar.`;
  } else {
    title = "PILIHAN SALAH!"; subtitle = "TEMPAT TIDAK AMAN!"; icon = "💀";
    reason = result.shelter.reason;
  }

  return (
    <div style={{
      minHeight:"100vh",
      background: isWin ? "linear-gradient(180deg,#021208,#041a0e)" : "linear-gradient(180deg,#160202,#0a0000)",
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:20,position:"relative",overflow:"hidden"
    }}>
      {!isWin && (
        <div style={{
          position:"absolute",inset:0,background:"#ffff99",
          animation:"lightningFlash .7s ease-out forwards",
          opacity:0,zIndex:1,pointerEvents:"none"
        }}/>
      )}
      <StormBg/>
      <div style={{
        position:"relative",zIndex:40,maxWidth:430,width:"100%",
        background:"#060e1c",border:`2px solid ${accent}`,
        borderRadius:16,padding:24,textAlign:"center",
        animation:"popIn .35s cubic-bezier(.34,1.56,.64,1)"
      }}>
        <div style={{fontSize:44,marginBottom:10}}>{icon}</div>
        <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:13,color:accent,lineHeight:1.8,marginBottom:6}}>{title}</div>
        <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:accent,lineHeight:1.6,marginBottom:18,opacity:.85}}>{subtitle}</div>

        <div style={{
          background: isWin ? "#071a0e" : "#1c0404",
          border:`1px solid ${accent}44`,
          borderRadius:10,padding:14,marginBottom:18,textAlign:"left"
        }}>
          {result.shelter && (
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:accent,fontWeight:"bold",marginBottom:8}}>
              {result.shelter.icon} {result.shelter.name}{result.shelter.label ? ` ${result.shelter.label}` : ""}
            </div>
          )}
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#cbd5e1",lineHeight:1.6}}>{reason}</div>
        </div>

        <div style={{display:"flex",gap:10}}>
          {isWin ? (
            level < 3 ? (
              <button className="btn" onClick={()=>{playClick();onContinue();}} style={{
                flex:1,background:"linear-gradient(135deg,#16a34a,#15803d)",
                border:"none",borderRadius:10,padding:"13px",
                fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
              }}>▶ LEVEL {level+1}</button>
            ) : (
              <button className="btn" onClick={()=>{playClick();onHome();}} style={{
                flex:1,background:"linear-gradient(135deg,#fbbf24,#d97706)",
                border:"none",borderRadius:10,padding:"13px",
                fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
              }}>🏆 SELESAI!</button>
            )
          ) : (
            <button className="btn" onClick={()=>{playClick();onRetry();}} style={{
              flex:1,background:"linear-gradient(135deg,#dc2626,#991b1b)",
              border:"none",borderRadius:10,padding:"13px",
              fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
            }}>🔄 ULANG DARI LEVEL 1</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VICTORY ──────────────────────────────────────────────────
function VictoryScreen({onRestart}) {
  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(180deg,#021208,#041a0e)",
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:20,position:"relative",overflow:"hidden"
    }}>
      <StormBg/>
      <div style={{
        position:"relative",zIndex:40,maxWidth:450,width:"100%",
        background:"#060e1c",border:"2px solid #fbbf24",
        borderRadius:16,padding:28,textAlign:"center",animation:"popIn .5s"
      }}>
        <div style={{fontSize:60,marginBottom:12,animation:"pulseGlow 2s infinite"}}>🏆</div>
        <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:16,color:"#fbbf24",lineHeight:1.8,marginBottom:8}}>
          KAMU<br/>SELAMAT!
        </div>
        <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:"#fde68a",letterSpacing:1,marginBottom:20}}>
          SEMUA LEVEL DITAKLUKKAN
        </div>

        <div style={{background:"#1a1408",border:"1px solid #fbbf2444",borderRadius:10,padding:16,marginBottom:20,textAlign:"left"}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#fbbf24",fontWeight:"bold",marginBottom:10}}>
            🎓 YANG KAMU PELAJARI:
          </div>
          {[
            "✅ Aman saat badai: rumah/bangunan kokoh",
            "❌ Bahaya: pohon, bangunan reot, halte terbuka",
            "⏱️ Bertindak cepat saat bencana",
            "📐 Hitung jarak ÷ kecepatan = waktu tempuh",
            "💨 Pilih waktu tercepat untuk selamat!"
          ].map((t,i)=>(
            <div key={i} style={{fontFamily:"'Space Mono',monospace",fontSize:10.5,color:"#cbd5e1",marginBottom:6,lineHeight:1.5}}>{t}</div>
          ))}
        </div>

        <button className="btn" onClick={onRestart} style={{
          background:"linear-gradient(135deg,#0ea5e9,#1d4ed8)",border:"none",borderRadius:10,
          padding:"13px 32px",fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
        }}>🔄 MAIN LAGI</button>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("intro");
  const [level, setLevel] = useState(1);
  const [config, setConfig] = useState(null);
  const [result, setResult] = useState(null);

  // Detect mobile sekali di awal — dipakai untuk size map yang lebih kecil
  const isMobileRef = useRef(false);
  useEffect(()=>{
    const w = window.innerWidth;
    const ua = navigator.userAgent || "";
    const isMobileUA = /android|iphone|ipad|ipod|webos|blackberry|opera mini|iemobile/i.test(ua);
    const isSmallScreen = w < 700;
    isMobileRef.current = isMobileUA || isSmallScreen;
  },[]);

  // Generate level fresh
  const generateLevelConfig = useCallback((lvl) => {
    const mobile = isMobileRef.current;
    if (lvl === 1) return generateLevel1(mobile);
    if (lvl === 2) return generateLevel2(mobile);
    if (lvl === 3) return generateLevel3(mobile);
    return null;
  },[]);

  const handleResult = useCallback((res) => {
    if (!config) return;

    if (res.type === "timeout") {
      setResult({type:"timeout", isLevel3: config.isLevel3, healthExhausted: false});
      setPhase("result");
      return;
    }

    if (res.type === "chose") {
      const sh = res.shelter;

      // === LEVEL 3 (GameLevel sudah filter dengan health system) ===
      // Yang sampai sini cuma 2 case:
      // 1. gameOver:true → nyawa habis (final lose)
      // 2. Tidak ada flag gameOver → menang (pilih rumah benar + tepat waktu)
      if (config.isLevel3) {
        if (res.gameOver) {
          setResult({
            type:"health_depleted",
            shelter: sh,
            mistakeType: res.mistakeType,
            correctLabel: config.correctLabel,
            hitCount: res.hitCount,
            isLevel3: true
          });
          setPhase("result");
          return;
        }
        // Menang!
        setResult({type:"win", shelter:sh, hitCount:res.hitCount, healthRemaining: res.healthRemaining});
        setPhase("result");
        return;
      }

      // === LEVEL 1 & 2 (tanpa health) ===
      // Level 2: shelter tooFar
      if (sh.tooFar && res.timeLeftAtChoice <= 2) {
        setResult({type:"too_slow", shelter:sh, timeNeeded:config.timeLimit, timeLeft:res.timeLeftAtChoice, hitCount:res.hitCount});
        setPhase("result");
        return;
      }

      if (sh.safe) {
        setResult({type:"win", shelter:sh, hitCount:res.hitCount});
      } else {
        setResult({type:"wrong", shelter:sh, hitCount:res.hitCount});
      }
      setPhase("result");
    }
  },[config]);

  function startGame() {
    const cfg = generateLevelConfig(1);
    setConfig(cfg);
    setLevel(1);
    setPhase("brief");
  }

  function startLevel() {
    if (level === 3) {
      setPhase("quiz");
    } else {
      setPhase("play");
    }
  }

  function continueNext() {
    const newLevel = level + 1;
    const cfg = generateLevelConfig(newLevel);
    setConfig(cfg);
    setLevel(newLevel);
    setPhase("brief");
  }

  function retryFromStart() {
    const cfg = generateLevelConfig(1);
    setConfig(cfg);
    setLevel(1);
    setPhase("brief");
  }

  function handleQuizAnswer(correct) {
    if (correct) setPhase("play");
  }

  return (
    <>
      <style>{STYLES}</style>
      {phase === "intro" && <IntroScreen onStart={startGame}/>}
      {phase === "brief" && config && <LevelBrief level={level} config={config} onStart={startLevel}/>}
      {phase === "quiz" && config && <QuizScreen config={config} onAnswer={handleQuizAnswer}/>}
      {phase === "play" && config && <GameLevel level={level} config={config} onResult={handleResult}/>}
      {phase === "result" && result && (
        <ResultScreen result={result} level={level}
          onContinue={continueNext} onRetry={retryFromStart}
          onHome={()=>setPhase("victory")}/>
      )}
      {phase === "victory" && <VictoryScreen onRestart={()=>{setPhase("intro");}}/>}
    </>
  );
}