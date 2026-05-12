import { useState, useEffect, useRef, useCallback } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
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
  @keyframes popIn{
    from{transform:scale(.85);opacity:0;}
    to{transform:scale(1);opacity:1;}
  }
  @keyframes lightningFlash{
    0%,100%{opacity:0;}
    10%,30%{opacity:1;}
    20%{opacity:.3;}
  }
  @keyframes screenShake{
    0%,100%{transform:translate(0,0);}
    25%{transform:translate(-4px,2px);}
    50%{transform:translate(4px,-2px);}
    75%{transform:translate(-2px,4px);}
  }
  @keyframes windSway{
    0%,100%{transform:rotate(-2deg);}
    50%{transform:rotate(2deg);}
  }
  @keyframes legSwing1{
    0%,100%{transform:translateY(0) rotate(0deg);}
    50%{transform:translateY(-1px) rotate(20deg);}
  }
  @keyframes legSwing2{
    0%,100%{transform:translateY(-1px) rotate(20deg);}
    50%{transform:translateY(0) rotate(0deg);}
  }
  @keyframes armSwing1{
    0%,100%{transform:rotate(-15deg);}
    50%{transform:rotate(15deg);}
  }
  @keyframes armSwing2{
    0%,100%{transform:rotate(15deg);}
    50%{transform:rotate(-15deg);}
  }
  @keyframes bodyBob{
    0%,100%{transform:translateY(0);}
    50%{transform:translateY(-1.5px);}
  }
  @keyframes hitFlash{
    0%,100%{filter:none;}
    50%{filter:brightness(2) saturate(2) hue-rotate(-30deg);}
  }
  .btn{transition:transform .14s,filter .14s;cursor:pointer;}
  .btn:hover{transform:translateY(-2px);filter:brightness(1.1);}
  .btn:active{transform:scale(.97);}
`;

const PX_PER_METER = 10;
const FPS = 60;
const DEBRIS_HITBOX = 28;
const CHAR_HITBOX = 18;
const SLOW_DURATION = 1500; // ms slowed after hit
const SLOW_FACTOR = 0.45;   // speed multiplier when hit
const HIT_COOLDOWN = 800;   // ms invincibility after hit

// ─── LEVELS ───────────────────────────────────────────────────
const LEVELS = {
  1: {
    title: "LEVEL 1: KENALI TEMPAT AMAN",
    timeLimit: 20, walkSpeed: 5,
    mapWidth: 1200, mapHeight: 900,
    spawnX: 600, spawnY: 450,
    showMath: false, hasObstacles: false,
    shelters: [
      { id:"tree", x:200, y:200, icon:"🌳", name:"Pohon", safe:false,
        reason:"Pohon adalah KONDUKTOR PETIR! Cabang yang patah bisa menimpamu!" },
      { id:"halte", x:1000, y:200, icon:"🛖", name:"Halte Bus", safe:false,
        reason:"Sisi terbuka! Angin badai bisa menerbangkan barang menabrakmu!" },
      { id:"ruins", x:200, y:700, icon:"🏚️", name:"Bangunan Reot", safe:false,
        reason:"Struktur rapuh AKAN ROBOH oleh angin kencang!" },
      { id:"house", x:1000, y:700, icon:"🏠", name:"Rumah Kokoh", safe:true,
        reason:"Dinding bata kokoh menahan angin & melindungi dari petir!" },
    ],
    decorations: [
      {type:"tree-small", x:400, y:100}, {type:"tree-small", x:800, y:100},
      {type:"lamp", x:350, y:450}, {type:"lamp", x:850, y:450},
      {type:"car", x:500, y:300}, {type:"car", x:700, y:600},
    ]
  },
  2: {
    title: "LEVEL 2: PILIH CEPAT & TEPAT",
    timeLimit: 12, walkSpeed: 5,
    mapWidth: 1600, mapHeight: 1100,
    spawnX: 800, spawnY: 550,
    showMath: false, hasObstacles: false,
    shelters: [
      { id:"house2a", x:900, y:300, icon:"🏠", name:"Rumah Dekat", safe:true,
        reason:"Pilihan tepat & dekat! Perlindungan terbaik dari badai!" },
      { id:"tree2", x:300, y:400, icon:"🌳", name:"Pohon", safe:false,
        reason:"Pohon BAHAYA saat badai — bisa tumbang & menarik petir!" },
      { id:"halte2", x:1300, y:400, icon:"🛖", name:"Halte Bus", safe:false,
        reason:"Halte tidak menahan angin dari semua sisi — BAHAYA!" },
      { id:"ruins2", x:500, y:850, icon:"🏚️", name:"Bangunan Reot", safe:false,
        reason:"Bangunan rapuh AKAN ROBOH — jangan dekati!" },
      { id:"house2b", x:1450, y:950, icon:"🏠", name:"Rumah Jauh", safe:true,
        reason:"Walau aman, TERLALU JAUH! Waktu habis sebelum sampai!", tooFar:true },
    ],
    decorations: [
      {type:"tree-small", x:200, y:200}, {type:"tree-small", x:1100, y:150},
      {type:"tree-small", x:1400, y:700}, {type:"tree-small", x:400, y:1000},
      {type:"lamp", x:600, y:450}, {type:"lamp", x:1100, y:550},
      {type:"car", x:850, y:700}, {type:"car", x:400, y:550}, {type:"car", x:1200, y:850},
    ]
  },
  3: {
    title: "LEVEL 3: HITUNG & HINDARI PUING",
    timeLimit: 18, walkSpeed: 5,
    mapWidth: 1800, mapHeight: 1200,
    spawnX: 900, spawnY: 600,
    showMath: true, hasObstacles: true,
    shelters: [
      { id:"house3a", x:1200, y:400, distance:36, icon:"🏠", name:"Rumah A", safe:true,
        reason:"Pilihan TERBAIK! Aman & jarak masih terjangkau dalam batas waktu!" },
      { id:"tree3", x:600, y:400, distance:36, icon:"🌳", name:"Pohon", safe:false,
        reason:"Pohon = konduktor petir! Hitungan benar pun TETAP MATI!" },
      { id:"ruins3", x:500, y:900, distance:50, icon:"🏚️", name:"Bangunan Reot", safe:false,
        reason:"Bangunan reot AKAN ROBOH walau kamu sampai tepat waktu!" },
      { id:"halte3", x:1400, y:900, distance:58, icon:"🛖", name:"Halte Bus", safe:false,
        reason:"Halte semi-terbuka! Angin BAHAYA walau hitunganmu cukup!" },
      { id:"house3b", x:200, y:200, distance:82, icon:"🏠", name:"Rumah B", safe:true,
        reason:"Aman tapi TERLALU JAUH! 82÷5 = 16.4s, mepet & rawan tertabrak puing!", tooFar:true },
      { id:"house3c", x:1700, y:1100, distance:95, icon:"🏠", name:"Rumah C", safe:true,
        reason:"Aman tapi SANGAT JAUH! 95÷5 = 19s, MELEBIHI batas waktu!", tooFar:true },
    ],
    decorations: [
      {type:"tree-small", x:300, y:600}, {type:"tree-small", x:1500, y:300},
      {type:"tree-small", x:1200, y:1000}, {type:"tree-small", x:700, y:1100},
      {type:"lamp", x:750, y:500}, {type:"lamp", x:1100, y:700},
      {type:"lamp", x:400, y:800}, {type:"lamp", x:1400, y:500},
      {type:"car", x:1000, y:800}, {type:"car", x:550, y:300},
      {type:"car", x:1300, y:200}, {type:"car", x:900, y:1050},
    ]
  }
};

function distanceMeters(x1, y1, x2, y2) {
  const dx = (x2 - x1) / PX_PER_METER;
  const dy = (y2 - y1) / PX_PER_METER;
  return Math.sqrt(dx*dx + dy*dy);
}

// ─── PATH ─────────────────────────────────────────────────────
function PathOverlay({config}) {
  return (
    <svg
      width={config.mapWidth} height={config.mapHeight}
      style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}
    >
      {config.shelters.map(s => {
        const sx = config.spawnX, sy = config.spawnY;
        return (
          <g key={`path-${s.id}`}>
            <path d={`M ${sx} ${sy} L ${s.x} ${sy} L ${s.x} ${s.y}`}
              stroke="#3a2a1a" strokeWidth={42} fill="none"
              strokeLinecap="round" strokeLinejoin="round"/>
            <path d={`M ${sx} ${sy} L ${s.x} ${sy} L ${s.x} ${s.y}`}
              stroke="#5a4a3a" strokeWidth={36} fill="none"
              strokeLinecap="round" strokeLinejoin="round"/>
            <path d={`M ${sx} ${sy} L ${s.x} ${sy} L ${s.x} ${s.y}`}
              stroke="#7a6a5a" strokeWidth={2} fill="none"
              strokeDasharray="8 12" strokeLinecap="round" opacity={0.5}/>
          </g>
        );
      })}
    </svg>
  );
}

// ─── DECORATIONS ──────────────────────────────────────────────
function Decoration({deco}) {
  const map = {
    "tree-small": {icon:"🌲", size:36, sway:true},
    "lamp": {icon:"🪔", size:28, sway:false},
    "car": {icon:"🚗", size:34, sway:false},
  };
  const d = map[deco.type];
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
function Shelter({shelter, isNear}) {
  return (
    <div style={{
      position:"absolute",
      left:shelter.x - 40, top:shelter.y - 40,
      width:80, height:80,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      filter: isNear ? "brightness(1.4) drop-shadow(0 0 12px #fbbf24)" : "drop-shadow(2px 2px 0 #000)",
      transition:"filter .15s", pointerEvents:"none"
    }}>
      <div style={{fontSize:54,lineHeight:1}}>{shelter.icon}</div>
      <div style={{
        fontFamily:"'Press Start 2P',monospace", fontSize:7,
        color:isNear?"#fbbf24":"#e2e8f0",
        background:"#000c", padding:"3px 5px", borderRadius:3,
        marginTop:2, whiteSpace:"nowrap"
      }}>{shelter.name}</div>
    </div>
  );
}

// ─── CHARACTER MANUSIA SVG (top-down) ─────────────────────────
// Karakter dilihat dari atas: kepala (lingkaran), bahu, tangan (2), kaki (2)
function Character({facing, moving, slowed}) {
  // Rotasi seluruh karakter berdasarkan arah
  const rotations = {up:0, right:90, down:180, left:270};
  const rot = rotations[facing] ?? 180;

  return (
    <div style={{
      width:40, height:40,
      transform:`rotate(${rot}deg)`,
      transition:"transform .08s",
      filter: slowed ? "hue-rotate(-30deg) brightness(0.85)" : "drop-shadow(2px 3px 0 #000)",
      animation: moving ? "bodyBob .3s ease-in-out infinite" : "none"
    }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{overflow:"visible"}}>
        {/* Bayangan */}
        <ellipse cx="20" cy="34" rx="11" ry="3" fill="#000" opacity="0.35"/>

        {/* Kaki kiri */}
        <g style={{
          transformOrigin:"15px 24px",
          animation: moving ? "legSwing1 .3s ease-in-out infinite" : "none"
        }}>
          <rect x="13" y="22" width="4" height="10" rx="1.5" fill="#1e3a8a"/>
          <rect x="12" y="30" width="6" height="3" rx="1" fill="#1a1a1a"/>
        </g>
        {/* Kaki kanan */}
        <g style={{
          transformOrigin:"25px 24px",
          animation: moving ? "legSwing2 .3s ease-in-out infinite" : "none"
        }}>
          <rect x="23" y="22" width="4" height="10" rx="1.5" fill="#1e3a8a"/>
          <rect x="22" y="30" width="6" height="3" rx="1" fill="#1a1a1a"/>
        </g>

        {/* Badan (kaos kuning) */}
        <ellipse cx="20" cy="20" rx="9" ry="7.5" fill="#fbbf24"/>
        <path d="M 11 17 Q 20 14 29 17 L 29 22 Q 20 24 11 22 Z" fill="#f59e0b"/>

        {/* Tangan kiri */}
        <g style={{
          transformOrigin:"12px 18px",
          animation: moving ? "armSwing1 .3s ease-in-out infinite" : "none"
        }}>
          <ellipse cx="9" cy="20" rx="2.5" ry="4" fill="#fbbf24"/>
          <circle cx="9" cy="23" r="2.5" fill="#fcd9a8"/>
        </g>
        {/* Tangan kanan */}
        <g style={{
          transformOrigin:"28px 18px",
          animation: moving ? "armSwing2 .3s ease-in-out infinite" : "none"
        }}>
          <ellipse cx="31" cy="20" rx="2.5" ry="4" fill="#fbbf24"/>
          <circle cx="31" cy="23" r="2.5" fill="#fcd9a8"/>
        </g>

        {/* Kepala (rambut + wajah) */}
        <circle cx="20" cy="14" r="7" fill="#fcd9a8"/>
        {/* Rambut hitam */}
        <path d="M 13 14 Q 13 7 20 7 Q 27 7 27 14 Q 27 11 24 10 Q 20 9 16 10 Q 13 11 13 14 Z" fill="#1a1a1a"/>
        {/* Mata kecil (di bagian "depan" = atas karena top-down menghadap atas dalam koord lokal) */}
        <circle cx="17.5" cy="13" r="0.8" fill="#1a1a1a"/>
        <circle cx="22.5" cy="13" r="0.8" fill="#1a1a1a"/>
      </svg>
    </div>
  );
}

// ─── DEBRIS (puing yang interaktif) ───────────────────────────
// Component visual saja; logic gerakan + collision di GameLevel
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

// ─── STORM BG ─────────────────────────────────────────────────
function StormBg() {
  const drops = useRef(
    Array.from({length:50},(_,i)=>({
      id:i, left:`${Math.random()*108}%`,
      delay:`${(Math.random()*2).toFixed(2)}s`,
      dur:`${(0.4+Math.random()*0.4).toFixed(2)}s`,
      h:`${14+Math.random()*16}px`,
      op:0.3+Math.random()*0.4
    }))
  ).current;
  return (
    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:30}}>
      {drops.map(d=>(
        <div key={d.id} style={{
          position:"absolute",left:d.left,top:"-20px",
          width:"1.8px",height:d.h,
          background:`rgba(140,200,255,${d.op})`,
          animation:`rainFall ${d.dur} ${d.delay} infinite linear`,
          borderRadius:"0 0 50% 50%"
        }}/>
      ))}
    </div>
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
          STORM<br/>SURVIVAL
        </h1>
        <p style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:"#fbbf24",letterSpacing:2,marginBottom:24}}>
          TOP-DOWN ADVENTURE
        </p>

        <div style={{background:"#07101e",border:"1px solid #1b2f4a",borderRadius:12,padding:18,marginBottom:18,textAlign:"left"}}>
          <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"#475569",marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>Kontrol:</p>
          {[
            ["⬅️➡️⬆️⬇️","Gerak 4 arah"],
            ["W A S D","Alternatif gerak"],
            ["E / SPACE","Masuk shelter"]
          ].map(([key,desc],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,fontFamily:"'Space Mono',monospace",fontSize:11}}>
              <span style={{color:"#fbbf24",fontWeight:"bold"}}>{key}</span>
              <span style={{color:"#94a3b8"}}>{desc}</span>
            </div>
          ))}
        </div>

        <div style={{background:"#07101e",border:"1px solid #1b2f4a",borderRadius:12,padding:18,marginBottom:24,textAlign:"left"}}>
          <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"#475569",marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>3 Level Tantangan:</p>
          {[
            ["🎯","Level 1: Pilih tempat aman dari badai"],
            ["⏱️","Level 2: Waktu mepet, pilih dekat & aman"],
            ["📐","Level 3: Hitung + hindari puing terbang!"]
          ].map(([icon,text],i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:8,fontFamily:"'Space Mono',monospace",fontSize:11,color:"#cbd5e1"}}>
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>

        <button className="btn" onClick={onStart} style={{
          background:"linear-gradient(135deg,#0ea5e9,#1d4ed8)",border:"none",borderRadius:10,
          padding:"14px 40px",fontFamily:"'Press Start 2P',monospace",fontSize:12,color:"white",
          cursor:"pointer",boxShadow:"0 4px 24px rgba(14,165,233,.4)"
        }}>▶ MULAI BERMAIN</button>
      </div>
    </div>
  );
}

// ─── LEVEL BRIEF ──────────────────────────────────────────────
function LevelBrief({level, onStart}) {
  const config = LEVELS[level];
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
              ⚠️ PUING TERBANG MENGHALANGI!<br/>
              <span style={{color:"#fbbf24"}}>Tertabrak = lambat sementara!</span>
            </div>
          )}
          {config.showMath && (
            <div style={{marginTop:10,padding:10,background:"#1a1230",borderRadius:6,fontFamily:"'Space Mono',monospace",fontSize:10,color:"#a78bfa",textAlign:"center"}}>
              📐 Waktu = Jarak ÷ Kecepatan<br/>
              Misal: 50m ÷ 5 m/s = 10 detik
            </div>
          )}
        </div>

        <p style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#cbd5e1",marginBottom:18,lineHeight:1.5}}>
          {level===1 && "Kenali tempat aman saat badai. Eksplorasi & masuk shelter yang tepat!"}
          {level===2 && "Waktu makin mepet! Pilih shelter yang AMAN dan dekat."}
          {level===3 && "Hitung waktu tempuh & hindari puing! Tertabrak = melambat 1.5 detik!"}
        </p>

        <button className="btn" onClick={onStart} style={{
          background:"linear-gradient(135deg,#0ea5e9,#1d4ed8)",border:"none",borderRadius:10,
          padding:"12px 32px",fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
        }}>▶ MULAI LEVEL {level}</button>
      </div>
    </div>
  );
}

// ─── GAME LEVEL ───────────────────────────────────────────────
function GameLevel({level, onResult}) {
  const config = LEVELS[level];
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

  // Inisialisasi debris (Level 3 saja)
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
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          if (!ended.current) {
            ended.current = true;
            onResult({type:"timeout"});
          }
          return 0;
        }
        return prev - 1;
      });
    },1000);
    return ()=>clearInterval(t);
  },[onResult]);

  useEffect(()=>{
    const loop = ()=>{
      if (ended.current) return;
      const now = Date.now();
      const k = keys.current;

      // Cek slowed status
      const isSlowed = now < slowedUntil.current;
      if (isSlowed !== slowed) setSlowed(isSlowed);

      // Kecepatan efektif
      const baseSpeed = config.walkSpeed * PX_PER_METER / FPS;
      const effSpeed = baseSpeed * (isSlowed ? SLOW_FACTOR : 1);

      let nx = charXRef.current;
      let ny = charYRef.current;
      let newFacing = null;
      let dx = 0, dy = 0;

      if (k["arrowup"]||k["w"]) { dy -= 1; newFacing = "up"; }
      if (k["arrowdown"]||k["s"]) { dy += 1; newFacing = "down"; }
      if (k["arrowleft"]||k["a"]) { dx -= 1; newFacing = "left"; }
      if (k["arrowright"]||k["d"]) { dx += 1; newFacing = "right"; }

      const movingNow = dx !== 0 || dy !== 0;
      if (dx !== 0 && dy !== 0) {
        const inv = 1/Math.sqrt(2);
        dx *= inv; dy *= inv;
      }

      nx += dx * effSpeed;
      ny += dy * effSpeed;
      nx = Math.max(20, Math.min(config.mapWidth-20, nx));
      ny = Math.max(20, Math.min(config.mapHeight-20, ny));

      charXRef.current = nx;
      charYRef.current = ny;
      setCharX(nx);
      setCharY(ny);
      if (newFacing) setFacing(newFacing);
      setMoving(movingNow);

      // Update debris
      if (config.hasObstacles) {
        let updated = debrisRef.current.map(d => ({
          ...d,
          x: d.x + d.vx,
          y: d.y + d.vy,
          rot: d.rot + d.rotSpeed
        }));

        // Buang debris yang keluar map
        updated = updated.filter(d =>
          d.x > -100 && d.x < config.mapWidth + 100 &&
          d.y > -100 && d.y < config.mapHeight + 100
        );

        // Spawn debris baru tiap ~1 detik
        if (now - lastDebrisSpawn.current > 1000 && updated.length < 8) {
          updated.push(spawnDebris(config));
          lastDebrisSpawn.current = now;
        }

        // Collision check (char vs debris)
        if (now - lastHitTime.current > HIT_COOLDOWN) {
          for (const d of updated) {
            const dist = Math.hypot(d.x - nx, d.y - ny);
            const threshold = (d.size/2) * 0.6 + CHAR_HITBOX/2;
            if (dist < threshold) {
              lastHitTime.current = now;
              slowedUntil.current = now + SLOW_DURATION;
              setHitCount(h => h + 1);
              break;
            }
          }
        }

        debrisRef.current = updated;
        setDebrisList(updated);
      }

      // Cek shelter terdekat
      let near = null;
      let minDist = Infinity;
      for (const sh of config.shelters) {
        const d = Math.hypot(sh.x - nx, sh.y - ny);
        if (d < 60 && d < minDist) { minDist = d; near = sh; }
      }
      setNearShelterId(near ? near.id : null);

      if ((k["e"]||k["space"]) && near && !ended.current) {
        ended.current = true;
        const elapsedSec = (Date.now() - startTime.current) / 1000;
        const timeLeftAtChoice = Math.max(0, config.timeLimit - elapsedSec);
        const actualDistance = distanceMeters(config.spawnX, config.spawnY, near.x, near.y);
        onResult({type:"chose", shelter:near, elapsedSec, timeLeftAtChoice, actualDistance, hitCount});
        return;
      }

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line
  },[]);

  const camX = Math.max(0, Math.min(config.mapWidth - viewport.w, charX - viewport.w/2));
  const camY = Math.max(0, Math.min(config.mapHeight - viewport.h, charY - viewport.h/2));
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
        transform:`translate(${-camX}px, ${-camY}px)`,
        transition:"transform .08s linear"
      }}>
        <div style={{
          position:"absolute", inset:0,
          backgroundImage:`
            radial-gradient(ellipse at center, #1a2333 0%, #0c1422 80%),
            repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(255,255,255,.02) 60px, rgba(255,255,255,.02) 61px),
            repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,.02) 60px, rgba(255,255,255,.02) 61px)
          `
        }}/>

        <PathOverlay config={config}/>

        {config.decorations?.map((d,i)=>(
          <Decoration key={`deco-${i}`} deco={d}/>
        ))}

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

        {/* Debris layer (Level 3) */}
        {debrisList.map(d => (
          <DebrisVisual key={d.id} debris={d}/>
        ))}

        {/* Character */}
        <div style={{
          position:"absolute",
          left:charX - 20, top:charY - 20,
          zIndex:10,
          animation: slowed ? "hitFlash .4s ease-in-out infinite" : "none"
        }}>
          <Character facing={facing} moving={moving} slowed={slowed}/>
        </div>

        {nearShelterId && (
          <div style={{
            position:"absolute",
            left:charX - 45, top:charY - 60,
            background:"#fbbf24", color:"#000",
            padding:"4px 8px", borderRadius:4,
            fontFamily:"'Press Start 2P',monospace", fontSize:8,
            animation:"pulseGlow 1s infinite",
            whiteSpace:"nowrap", zIndex:11
          }}>⏎ TEKAN E</div>
        )}
      </div>

      {/* HUD */}
      <div style={{
        position:"fixed",top:0,left:0,right:0,zIndex:50,
        padding:"12px 16px",
        background:"linear-gradient(180deg,rgba(0,0,0,.85),transparent)",
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:8
      }}>
        <div style={{background:"#0a1428",border:"1px solid #1b2f4a",padding:"6px 12px",borderRadius:6}}>
          <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,color:"#fbbf24"}}>LEVEL {level}</span>
        </div>

        {config.hasObstacles && (
          <div style={{background:"#0a1428",border:"1px solid #1b2f4a",padding:"6px 10px",borderRadius:6}}>
            <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:slowed?"#f87171":"#94a3b8"}}>
              💥 {hitCount}
            </span>
          </div>
        )}

        <div style={{
          background:panic?"#1c0404":"#0a1428",
          border:`1px solid ${panic?"#f87171":"#1b2f4a"}`,
          padding:"6px 12px",borderRadius:6,
          animation: panic ? "shakeX .35s infinite" : "none"
        }}>
          <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:12,color:panic?"#f87171":"#4ade80"}}>
            ⏱ {timeLeft}s
          </span>
        </div>
      </div>

      {/* Slowed indicator */}
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

      {config.showMath && (
        <div style={{
          position:"fixed",top:56,left:8,right:8,zIndex:50,
          background:"#070f1cee",border:"1px solid #1b2f4a",
          borderRadius:8,overflow:"hidden",backdropFilter:"blur(4px)"
        }}>
          <div style={{background:"#0c1a2eee",padding:"4px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:"#a78bfa",textAlign:"center"}}>
            📐 Kecepatan {config.walkSpeed} m/s | Sisa: {timeLeft}s
          </div>
          <div style={{display:"flex",overflowX:"auto",padding:6,gap:6}}>
            {config.shelters.map(s=>{
              const tNeed = (s.distance/config.walkSpeed).toFixed(1);
              return (
                <div key={s.id} style={{
                  flex:"0 0 auto",
                  background:"#0c1a2e",border:"1px solid #1b2f4a",
                  borderRadius:6,padding:"4px 8px",minWidth:90,
                  fontFamily:"'Space Mono',monospace",fontSize:9,color:"#cbd5e1"
                }}>
                  <div style={{fontSize:14,textAlign:"center"}}>{s.icon}</div>
                  <div style={{color:"#38bdf8"}}>{s.distance}m</div>
                  <div style={{color:"#fbbf24"}}>={tNeed}s</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{
        position:"fixed",bottom:8,left:0,right:0,zIndex:50,
        textAlign:"center",
        fontFamily:"'Space Mono',monospace",fontSize:9,color:"#94a3b8",
        textShadow:"1px 1px 0 #000"
      }}>
        ⬅⬆⬇➡ atau WASD untuk gerak | E saat dekat shelter
      </div>
    </div>
  );
}

// ─── RESULT ───────────────────────────────────────────────────
function ResultScreen({result, level, onContinue, onRetry, onHome}) {
  const isWin = result.type === "win";
  const accent = isWin ? "#4ade80" : "#f87171";

  let title, subtitle, icon, reason;
  if (isWin) {
    title = "SELAMAT!"; subtitle = "KAMU AMAN DARI BADAI!"; icon = "🎉";
    reason = result.shelter.reason;
    if (result.hitCount > 0) {
      reason += ` (Kamu tertabrak ${result.hitCount}x puing — masih bisa lebih cepat lagi!)`;
    }
  } else if (result.type === "timeout") {
    title = "WAKTU HABIS!"; subtitle = "PETIR MENYAMBARMU!"; icon = "⚡";
    reason = "Kamu terlalu lama atau terlalu sering tertabrak puing! Saat bencana, BERTINDAK CEPAT & HATI-HATI adalah kunci!";
  } else if (result.type === "too_slow") {
    title = "TIDAK SAMPAI!"; subtitle = "PETIR MENYAMBAR DI JALAN!"; icon = "⚡";
    reason = result.shelter.reason + ` Butuh ${result.timeNeeded.toFixed(1)}s, sisa waktumu hanya ${result.timeLeft.toFixed(1)}s.`;
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
              {result.shelter.icon} {result.shelter.name}
            </div>
          )}
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#cbd5e1",lineHeight:1.6}}>{reason}</div>
        </div>

        <div style={{display:"flex",gap:10}}>
          {isWin ? (
            level < 3 ? (
              <button className="btn" onClick={onContinue} style={{
                flex:1,background:"linear-gradient(135deg,#16a34a,#15803d)",
                border:"none",borderRadius:10,padding:"13px",
                fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
              }}>▶ LEVEL {level+1}</button>
            ) : (
              <button className="btn" onClick={onHome} style={{
                flex:1,background:"linear-gradient(135deg,#fbbf24,#d97706)",
                border:"none",borderRadius:10,padding:"13px",
                fontFamily:"'Press Start 2P',monospace",fontSize:11,color:"white",cursor:"pointer"
              }}>🏆 SELESAI!</button>
            )
          ) : (
            <button className="btn" onClick={onRetry} style={{
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
          STORM<br/>SURVIVOR!
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
            "💨 Waspada puing terbang saat badai"
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
  const [result, setResult] = useState(null);

  const handleResult = useCallback((res) => {
    const config = LEVELS[level];

    if (res.type === "timeout") {
      setResult({type:"timeout"});
      setPhase("result");
      return;
    }

    if (res.type === "chose") {
      const sh = res.shelter;

      if (config.showMath) {
        const timeNeeded = res.actualDistance / config.walkSpeed;
        if (sh.tooFar && timeNeeded > config.timeLimit) {
          setResult({type:"too_slow", shelter:sh, timeNeeded, timeLeft:res.timeLeftAtChoice, hitCount:res.hitCount});
          setPhase("result");
          return;
        }
      }

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
  },[level]);

  return (
    <>
      <style>{STYLES}</style>
      {phase === "intro" && <IntroScreen onStart={()=>{setLevel(1);setPhase("brief");}}/>}
      {phase === "brief" && <LevelBrief level={level} onStart={()=>setPhase("play")}/>}
      {phase === "play" && <GameLevel level={level} onResult={handleResult}/>}
      {phase === "result" && result && (
        <ResultScreen result={result} level={level}
          onContinue={()=>{setLevel(l=>l+1);setPhase("brief");}}
          onRetry={()=>{setLevel(1);setPhase("brief");}}
          onHome={()=>setPhase("victory")}/>
      )}
      {phase === "victory" && <VictoryScreen onRestart={()=>{setLevel(1);setPhase("intro");}}/>}
    </>
  );
}