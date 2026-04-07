import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { dispatchAssistantEvent } from '@/lib/assistantEvents';

// ─── STAGES ──────────────────────────────────────────────────────────────────
const TREE_STAGES = [
  { name: 'Semilla',          description: '¡Todo empieza con una semilla!',          emoji: '🌰' },
  { name: 'Brote',            description: 'Tu árbol empieza a crecer.',              emoji: '🌱' },
  { name: 'Planta joven',     description: 'Pequeño pero lleno de vida.',             emoji: '🌿' },
  { name: 'Arbusto',          description: 'Raíces profundas, hojas frescas.',        emoji: '🍀' },
  { name: 'Árbol joven',      description: 'Tomando forma con fuerza.',               emoji: '🌲' },
  { name: 'Árbol maduro',     description: 'Tu conocimiento florece.',                emoji: '🌳' },
  { name: 'Árbol frondoso',   description: 'Sombra y vida en abundancia.',            emoji: '🌳' },
  { name: 'Árbol fuerte',     description: 'Resistente y sabio.',                     emoji: '🪵' },
  { name: 'Árbol antiguo',    description: 'Siglos de sabiduría en tus ramas.',      emoji: '🏛️' },
  { name: 'Árbol sabio',      description: 'El conocimiento brilla en cada hoja.',   emoji: '✨' },
  { name: 'Árbol legendario', description: 'Una leyenda del aprendizaje.',            emoji: '🌟' },
  { name: 'Bosque vivo',      description: '¡Eres un ecosistema de sabiduría!',      emoji: '🌏' },
];
const STAGE_THRESHOLDS = [0, 5, 15, 30, 60, 100, 150, 220, 300, 400, 550, 750];

// ─── PALETAS POR STAGE ───────────────────────────────────────────────────────
const STAGE_PALETTES = [
  { trunk: '#8B6914', bark: '#A07820', leaf1: null,    leaf2: null,    leaf3: null,    glow: '#d4a017' },
  { trunk: '#8B5E3C', bark: '#A06830', leaf1: '#4ade80', leaf2: '#86efac', leaf3: '#22c55e', glow: '#4ade80' },
  { trunk: '#92400e', bark: '#a05020', leaf1: '#22c55e', leaf2: '#4ade80', leaf3: '#16a34a', glow: '#4ade80' },
  { trunk: '#78350f', bark: '#8a4010', leaf1: '#16a34a', leaf2: '#22c55e', leaf3: '#15803d', glow: '#22c55e' },
  { trunk: '#78350f', bark: '#6b2f0e', leaf1: '#15803d', leaf2: '#22c55e', leaf3: '#166534', glow: '#86efac' },
  { trunk: '#78350f', bark: '#6b2f0e', leaf1: '#14532d', leaf2: '#166534', leaf3: '#15803d', glow: '#86efac' },
  { trunk: '#6b2f0e', bark: '#5a2508', leaf1: '#14532d', leaf2: '#15803d', leaf3: '#166534', glow: '#4ade80' },
  { trunk: '#5a2508', bark: '#4a1e06', leaf1: '#166534', leaf2: '#16a34a', leaf3: '#15803d', glow: '#86efac' },
  { trunk: '#4a1e06', bark: '#3d1804', leaf1: '#15803d', leaf2: '#ca8a04', leaf3: '#166534', glow: '#fbbf24' },
  { trunk: '#3d1804', bark: '#331403', leaf1: '#0f766e', leaf2: '#14b8a6', leaf3: '#0d9488', glow: '#2dd4bf' },
  { trunk: '#331403', bark: '#2a1002', leaf1: '#7e22ce', leaf2: '#a855f7', leaf3: '#9333ea', glow: '#c084fc' },
  { trunk: '#2a1002', bark: '#1e0b01', leaf1: '#065f46', leaf2: '#0f766e', leaf3: '#0369a1', glow: '#6ee7b7' },
];

// ─── UTILIDADES DEL SIMULADOR ─────────────────────────────────────────────────
/**
 * Calcula animation_strength: combinación de energy + vitality + growthFlow reciente.
 * Resultado: 0–1
 */
function calcAnimationStrength(energy, vitality, growthFlow) {
  const energyFactor   = energy / 100;
  const vitalityFactor = vitality;

  // Peso del flujo reciente (últimas 6h)
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const recentWeight = (growthFlow ?? []).reduce((acc, entry) => {
    const age = nowMs - new Date(entry.ts).getTime();
    if (age > sixHoursMs) return acc;
    const freshness = 1 - age / sixHoursMs;
    return acc + entry.weight * freshness;
  }, 0);
  const flowFactor = Math.min(1, recentWeight / 12); // normalizado a [0,1]

  return Math.min(1, energyFactor * 0.5 + vitalityFactor * 0.3 + flowFactor * 0.2);
}

/**
 * Calcula el "ritmo" del árbol basado en growth_flow reciente.
 * Retorna un valor entre 0 (quieto) y 1 (muy activo).
 */
function calcRhythmFactor(growthFlow) {
  if (!growthFlow?.length) return 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const todayEntries = growthFlow.filter(e => (nowMs - new Date(e.ts).getTime()) < oneDayMs);
  const totalWeight = todayEntries.reduce((s, e) => s + e.weight, 0);
  return Math.min(1, totalWeight / 15); // 15 = peso máximo esperado por día
}

// ─── SVG PRINCIPAL ───────────────────────────────────────────────────────────
function TreeSVG({ stage, treeEnergy, vitality, animationStrength, rhythmFactor, isWatering, animationType }) {
  const p = STAGE_PALETTES[Math.min(stage, STAGE_PALETTES.length - 1)];

  // Parámetros continuos derivados del estado del simulador
  const breathSpeed    = 3.5 - animationStrength * 2;       // 1.5s–3.5s
  const breathAmp      = 3 + animationStrength * 5;          // 3px–8px
  const glowOpacity    = 0.15 + vitality * 0.45;            // 0.15–0.6
  const leafOpacity    = 0.5 + rhythmFactor * 0.5;          // 0.5–1
  const sparkleSpeed   = 2.5 - animationStrength * 1.5;     // 1s–2.5s
  const particleCount  = Math.ceil(animationStrength * 5);  // 0–5

  const css = `
    @keyframes treeFloat {
      0%,100% { transform: translateY(0px) rotate(0deg); }
      33%      { transform: translateY(-${breathAmp * 0.6}px) rotate(${animationStrength * 0.4}deg); }
      66%      { transform: translateY(-${breathAmp}px) rotate(-${animationStrength * 0.3}deg); }
    }
    @keyframes dropFall  { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(32px); } }
    @keyframes sparkle   { 0%,100% { opacity:0.2; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.1); } }
    @keyframes leafDrift {
      0% { opacity:${leafOpacity}; transform:translateY(0) rotate(0deg) translateX(0); }
      100% { opacity:0; transform:translateY(42px) rotate(60deg) translateX(10px); }
    }
    @keyframes pulse { 0%,100% { opacity:${glowOpacity * 0.6}; } 50% { opacity:${glowOpacity}; } }
    @keyframes branchSway {
      0%,100% { transform-origin: bottom center; transform: rotate(0deg); }
      50% { transform-origin: bottom center; transform: rotate(${animationStrength * 1.5}deg); }
    }
  `;

  const treeStyle = { animation: `treeFloat ${breathSpeed}s ease-in-out infinite` };

  const drops = (cx1, cy1, cx2, cy2, cx3, cy3, r = 2.5) => isWatering && (
    <>
      <circle cx={cx1} cy={cy1} r={r} fill="#60a5fa" style={{ animation: 'dropFall 0.9s ease-in infinite 0s' }} />
      <circle cx={cx2} cy={cy2} r={r} fill="#93c5fd" style={{ animation: 'dropFall 0.9s ease-in infinite 0.3s' }} />
      <circle cx={cx3} cy={cy3} r={r} fill="#60a5fa" style={{ animation: 'dropFall 0.9s ease-in infinite 0.6s' }} />
    </>
  );

  const glowBase = (cx, cy, rx, ry) => vitality > 0.05 && (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={p.glow} opacity={glowOpacity.toFixed(2)}
      style={{ animation: `pulse ${sparkleSpeed * 0.8}s ease-in-out infinite` }} />
  );

  // Partículas flotantes basadas en animationStrength
  const floatingParticles = (cx, cy) => particleCount > 0 && Array.from({ length: particleCount }).map((_, i) => (
    <circle
      key={i}
      cx={cx + (i % 2 === 0 ? -8 : 8) * (i + 1) * 0.4}
      cy={cy - i * 4}
      r={1.5 + (i % 3) * 0.5}
      fill={p.glow}
      opacity={0.7}
      style={{ animation: `leafDrift ${1.2 + i * 0.3}s ease-in infinite ${i * 0.25}s` }}
    />
  ));

  // Sparkle con velocidad continua
  const sparkle = (cx, cy, r = 3, offset = 0) => (
    <circle cx={cx} cy={cy} r={r} fill={p.glow}
      opacity={animationStrength > 0.1 ? 0.9 : 0.3}
      style={{ animation: `sparkle ${sparkleSpeed}s ease-in-out infinite ${offset}s` }} />
  );

  // ─── STAGE 0: Semilla ───────────────────────────────────────────────────────
  if (stage === 0) return (
    <svg viewBox="0 0 120 120" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="100" rx="28" ry="5" fill="#c8a97e" opacity="0.3" />
      {glowBase(60, 88, 20, 16)}
      <ellipse cx="60" cy="90" rx="10" ry="8" fill={p.trunk} />
      <ellipse cx="60" cy="86" rx="6" ry="5" fill={p.bark} />
      {floatingParticles(60, 78)}
      {drops(50, 68, 60, 62, 70, 68, 2)}
    </svg>
  );

  // ─── STAGE 1: Brote ─────────────────────────────────────────────────────────
  if (stage === 1) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="115" rx="30" ry="6" fill="#c8a97e" opacity="0.3" />
      {glowBase(60, 74, 24, 24)}
      <rect x="57" y="80" width="6" height="30" rx="3" fill={p.trunk} />
      <ellipse cx="60" cy="72" rx="14" ry="16" fill={p.leaf1} opacity={leafOpacity} />
      <ellipse cx="60" cy="68" rx="10" ry="12" fill={p.leaf2} opacity={Math.min(1, leafOpacity + 0.1)} />
      <ellipse cx="52" cy="78" rx="8" ry="6" fill={p.leaf3} opacity={leafOpacity * 0.7} />
      <ellipse cx="68" cy="76" rx="8" ry="6" fill={p.leaf3} opacity={leafOpacity * 0.7} />
      {floatingParticles(60, 55)}
      {drops(48, 50, 60, 44, 72, 50, 2.5)}
    </svg>
  );

  // ─── STAGE 2: Planta joven ──────────────────────────────────────────────────
  if (stage === 2) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="118" rx="32" ry="7" fill="#c8a97e" opacity="0.3" />
      {glowBase(60, 62, 32, 30)}
      <rect x="56" y="70" width="8" height="45" rx="4" fill={p.bark} />
      <ellipse cx="60" cy="60" rx="22" ry="24" fill={p.leaf1} opacity={leafOpacity} />
      <ellipse cx="60" cy="54" rx="16" ry="18" fill={p.leaf2} opacity={Math.min(1, leafOpacity + 0.1)} />
      <ellipse cx="48" cy="65" rx="12" ry="9" fill={p.leaf3} opacity={leafOpacity * 0.8} />
      <ellipse cx="72" cy="63" rx="12" ry="9" fill={p.leaf3} opacity={leafOpacity * 0.8} />
      <ellipse cx="60" cy="48" rx="10" ry="10" fill={p.leaf2} opacity={leafOpacity * 0.7} />
      {floatingParticles(60, 35)}
      {animationStrength > 0.3 && sparkle(80, 45, 2)}
      {drops(45, 34, 60, 28, 75, 34, 2.5)}
    </svg>
  );

  // ─── STAGE 3: Arbusto ───────────────────────────────────────────────────────
  if (stage === 3) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="120" rx="36" ry="7" fill="#c8a97e" opacity="0.3" />
      {glowBase(60, 52, 38, 36)}
      <rect x="54" y="65" width="12" height="52" rx="5" fill={p.trunk} />
      <rect x="40" y="82" width="20" height="6" rx="3" fill={p.trunk} transform="rotate(-20 40 82)" />
      <rect x="60" y="80" width="20" height="6" rx="3" fill={p.trunk} transform="rotate(20 60 80)" />
      <ellipse cx="60" cy="52" rx="28" ry="28" fill={p.leaf3} opacity={leafOpacity * 0.9} />
      <ellipse cx="60" cy="46" rx="22" ry="22" fill={p.leaf1} opacity={leafOpacity} />
      <ellipse cx="44" cy="58" rx="14" ry="10" fill={p.leaf3} opacity={leafOpacity * 0.7} />
      <ellipse cx="76" cy="56" rx="14" ry="10" fill={p.leaf3} opacity={leafOpacity * 0.7} />
      <ellipse cx="60" cy="38" rx="14" ry="13" fill={p.leaf2} opacity={leafOpacity * 0.8} />
      {floatingParticles(60, 22)}
      {animationStrength > 0.25 && sparkle(78, 35, 2.5, 0.3)}
      {drops(42, 16, 60, 10, 78, 16, 3)}
    </svg>
  );

  // ─── STAGE 4: Árbol joven ───────────────────────────────────────────────────
  if (stage === 4) return (
    <svg viewBox="0 0 140 140" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="70" cy="130" rx="44" ry="8" fill="#c8a97e" opacity="0.3" />
      {glowBase(70, 50, 48, 44)}
      <rect x="63" y="65" width="14" height="62" rx="6" fill={p.trunk} />
      <rect x="35" y="88" width="28" height="7" rx="3" fill={p.trunk} transform="rotate(-25 35 88)" />
      <rect x="77" y="85" width="28" height="7" rx="3" fill={p.trunk} transform="rotate(25 77 85)" />
      <ellipse cx="70" cy="50" rx="38" ry="36" fill={p.leaf3} opacity={leafOpacity * 0.9} />
      <ellipse cx="70" cy="42" rx="30" ry="30" fill={p.leaf1} opacity={leafOpacity} />
      <ellipse cx="50" cy="56" rx="18" ry="13" fill={p.leaf3} opacity={leafOpacity * 0.7} />
      <ellipse cx="90" cy="54" rx="18" ry="13" fill={p.leaf3} opacity={leafOpacity * 0.7} />
      <ellipse cx="70" cy="30" rx="20" ry="18" fill={p.leaf2} opacity={leafOpacity * 0.9} />
      <ellipse cx="56" cy="40" rx="10" ry="8" fill={p.leaf2} opacity={leafOpacity * 0.7} />
      <ellipse cx="84" cy="38" rx="10" ry="8" fill={p.leaf2} opacity={leafOpacity * 0.7} />
      {floatingParticles(70, 12)}
      {animationStrength > 0.2 && sparkle(88, 28, 2.5, 0.5)}
      {drops(48, 8, 70, 2, 92, 8, 3)}
    </svg>
  );

  // ─── STAGE 5: Árbol maduro ──────────────────────────────────────────────────
  if (stage === 5) return (
    <svg viewBox="0 0 160 150" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="80" cy="140" rx="55" ry="9" fill="#c8a97e" opacity="0.35" />
      {glowBase(80, 50, 62, 54)}
      <rect x="73" y="70" width="14" height="68" rx="6" fill={p.trunk} />
      <rect x="36" y="96" width="36" height="8" rx="4" fill={p.trunk} transform="rotate(-28 36 96)" />
      <rect x="88" y="92" width="36" height="8" rx="4" fill={p.trunk} transform="rotate(28 88 92)" />
      <ellipse cx="80" cy="52" rx="52" ry="46" fill={p.leaf3} opacity={leafOpacity * 0.9} />
      <ellipse cx="80" cy="44" rx="42" ry="38" fill={p.leaf1} opacity={leafOpacity} />
      <ellipse cx="58" cy="60" rx="22" ry="16" fill={p.leaf3} opacity={leafOpacity * 0.85} />
      <ellipse cx="102" cy="58" rx="22" ry="16" fill={p.leaf3} opacity={leafOpacity * 0.85} />
      <ellipse cx="80" cy="34" rx="30" ry="26" fill={p.leaf1} />
      <ellipse cx="64" cy="44" rx="14" ry="11" fill={p.leaf2} opacity={leafOpacity * 0.85} />
      <ellipse cx="96" cy="42" rx="14" ry="11" fill={p.leaf2} opacity={leafOpacity * 0.85} />
      <ellipse cx="80" cy="24" rx="20" ry="18" fill={p.leaf2} opacity={leafOpacity * 0.9} />
      {sparkle(68, 30, 3, 0)}
      {sparkle(92, 28, 2.5, 0.5)}
      {sparkle(80, 18, 3, 1)}
      {floatingParticles(80, 5)}
      {drops(54, 0, 80, -6, 106, 0, 3.5)}
    </svg>
  );

  // ─── STAGES 6–11: Copa avanzada ─────────────────────────────────────────────
  const extraSparkles = stage >= 8;
  const hasStars = stage >= 9;

  return (
    <svg viewBox="0 0 180 165" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="90" cy="155" rx="66" ry="10" fill="#c8a97e" opacity="0.4" />
      {glowBase(90, 55, 75, 65)}
      {stage >= 8 && (
        <>
          <rect x="58" y="125" width="8" height="20" rx="4" fill={p.trunk} transform="rotate(-15 58 125)" />
          <rect x="114" y="125" width="8" height="20" rx="4" fill={p.trunk} transform="rotate(15 114 125)" />
        </>
      )}
      <rect x="82" y="80" width="16" height="72" rx="7" fill={p.trunk} />
      <rect x="40" y="108" width="42" height="9" rx="4" fill={p.trunk} transform="rotate(-28 40 108)" />
      <rect x="98" y="104" width="42" height="9" rx="4" fill={p.trunk} transform="rotate(28 98 104)" />
      {stage >= 7 && (
        <>
          <rect x="52" y="90" width="30" height="7" rx="3" fill={p.bark} transform="rotate(-18 52 90)" />
          <rect x="98" y="88" width="30" height="7" rx="3" fill={p.bark} transform="rotate(18 98 88)" />
        </>
      )}
      <ellipse cx="90" cy="58" rx="62" ry="54" fill={p.leaf3} opacity={leafOpacity * 0.9} />
      <ellipse cx="90" cy="50" rx="50" ry="44" fill={p.leaf1} opacity={leafOpacity} />
      <ellipse cx="66" cy="68" rx="26" ry="19" fill={p.leaf3} opacity={leafOpacity * 0.85} />
      <ellipse cx="114" cy="66" rx="26" ry="19" fill={p.leaf3} opacity={leafOpacity * 0.85} />
      <ellipse cx="90" cy="38" rx="36" ry="30" fill={p.leaf1} />
      <ellipse cx="72" cy="50" rx="17" ry="13" fill={p.leaf2} opacity={leafOpacity * 0.85} />
      <ellipse cx="108" cy="48" rx="17" ry="13" fill={p.leaf2} opacity={leafOpacity * 0.85} />
      <ellipse cx="90" cy="26" rx="24" ry="21" fill={p.leaf2} opacity={leafOpacity * 0.9} />
      {sparkle(76, 32, 3.5, 0)}
      {sparkle(104, 30, 3, 0.5)}
      {sparkle(90, 18, 3.5, 1)}
      {extraSparkles && (
        <>
          {sparkle(62, 46, 2.5, 0.3)}
          {sparkle(118, 44, 2.5, 0.8)}
          {sparkle(90, 12, 2, 0.2)}
        </>
      )}
      {hasStars && (
        <>
          <polygon points="90,4 92,10 98,10 93,14 95,20 90,16 85,20 87,14 82,10 88,10"
            fill={p.glow} opacity={0.7 + vitality * 0.3}
            style={{ animation: `sparkle ${sparkleSpeed * 0.9}s ease-in-out infinite` }} />
          <polygon points="68,22 69.5,27 74.5,27 70.5,30 72,35 68,32 64,35 65.5,30 61.5,27 66.5,27"
            fill={p.glow} opacity={0.6 + vitality * 0.3}
            style={{ animation: `sparkle ${sparkleSpeed * 1.1}s ease-in-out infinite 0.6s` }} />
          <polygon points="112,20 113.5,25 118.5,25 114.5,28 116,33 112,30 108,33 109.5,28 105.5,25 110.5,25"
            fill={p.glow} opacity={0.6 + vitality * 0.3}
            style={{ animation: `sparkle ${sparkleSpeed}s ease-in-out infinite 1.1s` }} />
        </>
      )}
      {stage === 11 && (
        <>
          <rect x="22" y="128" width="6" height="22" rx="3" fill={p.trunk} />
          <ellipse cx="25" cy="118" rx="12" ry="14" fill={p.leaf1} opacity={leafOpacity * 0.8} />
          <rect x="152" y="128" width="6" height="22" rx="3" fill={p.trunk} />
          <ellipse cx="155" cy="118" rx="12" ry="14" fill={p.leaf3} opacity={leafOpacity * 0.8} />
        </>
      )}
      {floatingParticles(90, 5)}
      {drops(62, -2, 90, -8, 118, -2, 4)}
    </svg>
  );
}

// ─── COMPONENTE PRINCIPAL (SIMULADOR HÍBRIDO) ─────────────────────────────────
export default function TreeVisualization({ profile, userEmail }) {
  const queryClient = useQueryClient();

  // ── Estado del simulador ──────────────────────────────────────────────────
  const [stage, setStage]           = useState(null);
  const [simEnergy, setSimEnergy]   = useState(0);
  const [simVitality, setSimVitality] = useState(0);
  const [simFlow, setSimFlow]       = useState([]);
  const lastSyncRef = useRef(null); // ISO del último rebase autoritativo
  const [activeEffect, setActiveEffect] = useState(null); // 'user_lesson' | 'user_eval' | 'user_exam' | 'watered' | 'decay' | null

  // ── Estado optimista para agua/puntos ────────────────────────────────────
  const [optimistic, setOptimistic] = useState(null);

  // ── Estado de animación de eventos ───────────────────────────────────────
  const [isWatering, setIsWatering]   = useState(false);
  const [treeScale, setTreeScale]     = useState(1);
  const [animationType, setAnimationType] = useState(null);
  const [watering, setWatering]       = useState(false);
  const prevStage = useRef(null);

  // ── Valores derivados del perfil / optimistic ────────────────────────────
  const growthPoints = optimistic?.tree_growth_points ?? profile?.tree_growth_points ?? 0;
  const water        = optimistic?.water_tokens ?? profile?.water_tokens ?? 0;
  const growthStreak = profile?.growth_streak ?? 0;

  // ── SIMULACIÓN LOCAL: decay en tiempo real (tick cada 30s) ───────────────
  // Aplica una fracción del decay del backend para animar suavemente la UI
  // sin necesidad de recargar. No persiste — es puramente visual.
  const simTickRef = useRef(null);
  const startSimTick = useCallback(() => {
    if (simTickRef.current) return;
    simTickRef.current = setInterval(() => {
      const DECAY_ENERGY_PER_30S   = 1.2 / 120;   // proporcional al backend (1.2/h)
      const DECAY_VITALITY_PER_30S = 0.02 / 120;
      setSimEnergy(e => Math.max(0, +(e - DECAY_ENERGY_PER_30S).toFixed(2)));
      setSimVitality(v => Math.max(0, +(v - DECAY_VITALITY_PER_30S).toFixed(4)));
    }, 30000);
  }, []);

  useEffect(() => {
    startSimTick();
    return () => clearInterval(simTickRef.current);
  }, [startSimTick]);

  // ── Lerp helper ──────────────────────────────────────────────────────────
  const lerp = (a, b, t) => a + (b - a) * t;

  // ── Sincronizar simulador con perfil del backend (LERP suavizado) ─────────
  // Rol del frontend: solo predicción visual. Backend es la verdad absoluta.
  // Usamos last_sync_timestamp para detectar escrituras autoritativas.
  // En lugar de overwrite directo, hacemos soft-sync con lerp(local, server, 0.2).
  useEffect(() => {
    if (!profile) return;

    // Siempre sincronizar stage y flow (no visualmente críticos)
    if (profile.tree_stage != null) setStage(profile.tree_stage);
    setSimFlow(profile.growth_flow ?? []);

    const serverSync = profile.last_sync_timestamp;
    const isNewSync  = serverSync && serverSync !== lastSyncRef.current;

    if (isNewSync) {
      lastSyncRef.current = serverSync;
      // Soft sync: converger al valor del backend sin salto brusco
      setSimEnergy(e  => lerp(e,  Math.min(100, profile.tree_energy   ?? 0), 0.2));
      setSimVitality(v => lerp(v, Math.min(1,   profile.tree_vitality ?? 0), 0.2));

      // Disparar efecto visual basado en last_change_event
      const ev = profile.last_change_event;
      if (ev) {
        if (ev.source === 'decay') {
          setActiveEffect('decay');
        } else if (ev.type === 'watered') {
          setActiveEffect('watered');
        } else if (ev.intensity >= 0.8) {
          setActiveEffect('user_exam');
        } else if (ev.intensity >= 0.5) {
          setActiveEffect('user_eval');
        } else {
          setActiveEffect('user_lesson');
        }
        setTimeout(() => setActiveEffect(null), 2500);
      }
    } else if (!serverSync) {
      // Perfil sin last_sync_timestamp (usuarios legacy): overwrite directo solo una vez
      setSimEnergy(Math.min(100, profile.tree_energy   ?? 0));
      setSimVitality(Math.min(1, profile.tree_vitality ?? 0));
    }
  }, [profile?.tree_stage, profile?.tree_energy, profile?.tree_vitality, profile?.growth_flow, profile?.last_sync_timestamp, profile?.last_change_event]);

  // ── Animación de cambio de stage ─────────────────────────────────────────
  useEffect(() => {
    if (stage === null) return;
    if (prevStage.current === null) { prevStage.current = stage; return; }
    if (prevStage.current !== stage) {
      prevStage.current = stage;
      setTreeScale(1.1);
      setTimeout(() => setTreeScale(1), 600);
      // Impulso de vitalidad al subir de stage
      setSimVitality(v => Math.min(1, v + 0.3));
      confetti({
        particleCount: 60 + Math.floor(simEnergy * 0.6),
        spread: 70,
        colors: ['#4ade80', '#86efac', '#22c55e', '#bbf7d0', '#fbbf24'],
        origin: { y: 0.55 },
      });
    }
  }, [stage]);

  // ── Escuchar eventos externos (lesson, eval, exam) ───────────────────────
  useEffect(() => {
    const handle = (e) => {
      const { event_type } = e.detail || {};
      const WEIGHTS = { lesson_completed: 1, mini_eval_passed: 3, exam_passed: 8 };
      const weight = WEIGHTS[event_type] ?? 1;

      // Impulso inmediato en simulador — predicción visual (no escribe backend)
      setSimEnergy(en  => Math.min(100, lerp(en, en + weight * 4, 0.6)));
      setSimVitality(v => Math.min(1,   lerp(v,  v  + (weight / 8) * 0.35, 0.6)));
      setSimFlow(fl => [...fl, { ts: new Date().toISOString(), weight }].slice(-20));

      if (event_type === 'lesson_completed') {
        setActiveEffect('user_lesson');
        setAnimationType('lesson');
        setTreeScale(1.04);
        setTimeout(() => { setTreeScale(1); setAnimationType(null); setActiveEffect(null); }, 2000);
      } else if (event_type === 'mini_eval_passed') {
        setActiveEffect('user_eval');
        setIsWatering(true);
        setTreeScale(1.06);
        setTimeout(() => { setTreeScale(1); setIsWatering(false); setActiveEffect(null); }, 2500);
      } else if (event_type === 'exam_passed') {
        setActiveEffect('user_exam');
        setTreeScale(1.1);
        setTimeout(() => { setTreeScale(1); setActiveEffect(null); }, 3000);
        confetti({
          particleCount: 120, spread: 90,
          colors: ['#fbbf24', '#f59e0b', '#4ade80', '#86efac'],
          origin: { y: 0.5 },
        });
      }
    };
    window.addEventListener('tree_animation_event', handle);
    return () => window.removeEventListener('tree_animation_event', handle);
  }, []);

  // ── Regar árbol ───────────────────────────────────────────────────────────
  const handleWater = async () => {
    if (watering || water <= 0) return;
    const prevOptimistic = optimistic;
    const newGrowth = growthPoints + 1;
    setOptimistic({ tree_growth_points: newGrowth, water_tokens: water - 1 });
    setWatering(true);
    setIsWatering(true);
    setTreeScale(1.06);
    setTimeout(() => setTreeScale(1), 400);

    // Impulso inmediato en el simulador (predicción visual, no escribe backend)
    setSimEnergy(e => Math.min(100, lerp(e, e + 2, 0.6)));
    setSimVitality(v => Math.min(1, lerp(v, v + 0.088, 0.6)));
    setActiveEffect('watered');
    setTimeout(() => setActiveEffect(null), 2500);

    try {
      const res = await base44.functions.invoke('waterTree', {});
      if (!res.data?.success) {
        setOptimistic(prevOptimistic);
      } else {
        setOptimistic({ tree_growth_points: res.data.tree_growth_points, water_tokens: res.data.water_tokens });
        // Soft sync con LERP — backend es la verdad
        if (res.data.tree_energy   != null) setSimEnergy(e  => lerp(e,  res.data.tree_energy,   0.2));
        if (res.data.tree_vitality != null) setSimVitality(v => lerp(v, res.data.tree_vitality, 0.2));
        dispatchAssistantEvent('tree_watered', { new_stage: res.data.tree_stage });
      }
      queryClient.invalidateQueries(['gamificationProfile', userEmail]);
    } catch {
      setOptimistic(prevOptimistic);
    } finally {
      setWatering(false);
      setTimeout(() => setIsWatering(false), 1200);
    }
  };

  // ── Skeleton mientras carga ───────────────────────────────────────────────
  if (stage === null) return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-44 h-44 rounded-full bg-gray-100 animate-pulse" />
      <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
      <div className="w-full h-2.5 bg-gray-100 rounded-full animate-pulse" />
    </div>
  );

  // ── Calcular parámetros del simulador ────────────────────────────────────
  const animationStrength = calcAnimationStrength(simEnergy, simVitality, simFlow);
  const rhythmFactor      = calcRhythmFactor(simFlow);

  const currentStageInfo  = TREE_STAGES[Math.min(stage, TREE_STAGES.length - 1)];
  const isMaxStage        = stage >= STAGE_THRESHOLDS.length;
  const nextThreshold     = !isMaxStage ? STAGE_THRESHOLDS[stage + 1] : null;
  const prevThreshold     = STAGE_THRESHOLDS[stage] ?? 0;
  const progressToNext    = nextThreshold != null
    ? Math.min(100, Math.round(((growthPoints - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100;

  const streakLabel = growthStreak >= 7
    ? '🔥 Racha legendaria'
    : growthStreak >= 3 ? '✨ En racha' : null;

  // Glow causal: activeEffect define el color; fallback a intensidad de animación
  const glowClass = activeEffect === 'user_exam'
    ? 'drop-shadow-[0_0_32px_rgba(251,191,36,0.85)]'   // dorado — examen
    : activeEffect === 'user_eval'
    ? 'drop-shadow-[0_0_24px_rgba(96,165,250,0.8)]'    // azul — evaluación
    : activeEffect === 'user_lesson'
    ? 'drop-shadow-[0_0_18px_rgba(96,165,250,0.55)]'   // azul suave — lección
    : activeEffect === 'watered'
    ? 'drop-shadow-[0_0_22px_rgba(34,211,238,0.75)]'   // cian — riego
    : activeEffect === 'decay'
    ? 'drop-shadow-[0_0_10px_rgba(156,163,175,0.4)]'   // gris — decay
    : animationStrength > 0.6
    ? 'drop-shadow-[0_0_28px_rgba(74,222,128,0.75)]'
    : animationStrength > 0.3
    ? 'drop-shadow-[0_0_16px_rgba(74,222,128,0.5)]'
    : 'drop-shadow-[0_0_6px_rgba(74,222,128,0.2)]';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Árbol SVG — simulador visual */}
      <div
        className={cn('relative w-44 h-44 transition-all duration-500', glowClass)}
        style={{ transform: `scale(${treeScale})`, transition: 'transform 0.5s cubic-bezier(.34,1.56,.64,1)' }}
      >
        <TreeSVG
          stage={stage}
          treeEnergy={simEnergy}
          vitality={simVitality}
          animationStrength={animationStrength}
          rhythmFactor={rhythmFactor}
          isWatering={isWatering}
          animationType={animationType}
        />
      </div>

      {/* Info de stage */}
      <div className="text-center">
        <p className="font-bold text-gray-800 text-base">
          {currentStageInfo.emoji} {currentStageInfo.name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{currentStageInfo.description}</p>
        {streakLabel && (
          <p className="text-xs font-semibold text-amber-500 mt-1">{streakLabel} ({growthStreak} días)</p>
        )}
        {/* Indicador de vitalidad */}
        {simVitality > 0.05 && (
          <p className="text-xs text-green-500 mt-0.5">
            {'🌿'.repeat(Math.ceil(simVitality * 3))} vitalidad {Math.round(simVitality * 100)}%
          </p>
        )}
      </div>

      {/* Progreso */}
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-600 font-medium">💧 {water} agua</span>
          {!isMaxStage && (
            <span className="text-xs text-gray-400">{growthPoints} / {nextThreshold} pts</span>
          )}
        </div>
        {!isMaxStage ? (
          <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-400 to-green-400 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        ) : (
          <p className="text-center text-xs text-green-600 font-semibold">🌏 ¡Bosque vivo del conocimiento!</p>
        )}
      </div>

      {/* Botón regar */}
      {!isMaxStage && (
        <button
          onClick={handleWater}
          disabled={watering || water <= 0}
          className={cn(
            'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200',
            water > 0 && !watering
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md hover:shadow-lg active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {watering
            ? <><span className="animate-bounce">💧</span> Regando...</>
            : water > 0
            ? <>💧 Regar árbol</>
            : <>Sin agua — completa actividades para conseguir más</>}
        </button>
      )}

      {/* Indicadores de etapa */}
      <div className="flex gap-1 justify-center flex-wrap max-w-[180px]">
        {TREE_STAGES.map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-500',
              i < stage ? 'bg-green-500' : i === stage ? 'bg-green-400 ring-2 ring-green-200 scale-125' : 'bg-gray-200'
            )}
          />
        ))}
      </div>
    </div>
  );
}