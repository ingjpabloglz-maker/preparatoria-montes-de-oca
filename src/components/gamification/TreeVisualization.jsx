import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { dispatchAssistantEvent } from '@/lib/assistantEvents';

// ─── SISTEMA DE 12 NIVELES ────────────────────────────────────────────────────
const TREE_STAGES = [
  { name: 'Semilla',          description: '¡Todo empieza con una semilla!',           emoji: '🌰' },
  { name: 'Brote',            description: 'Tu árbol empieza a crecer.',               emoji: '🌱' },
  { name: 'Planta joven',     description: 'Pequeño pero lleno de vida.',              emoji: '🌿' },
  { name: 'Arbusto',          description: 'Raíces profundas, hojas frescas.',         emoji: '🍀' },
  { name: 'Árbol joven',      description: 'Tomando forma con fuerza.',                emoji: '🌲' },
  { name: 'Árbol maduro',     description: 'Tu conocimiento florece.',                 emoji: '🌳' },
  { name: 'Árbol frondoso',   description: 'Sombra y vida en abundancia.',             emoji: '🌳' },
  { name: 'Árbol fuerte',     description: 'Resistente y sabio.',                      emoji: '🪵' },
  { name: 'Árbol antiguo',    description: 'Siglos de sabiduría en tus ramas.',       emoji: '🏛️' },
  { name: 'Árbol sabio',      description: 'El conocimiento brilla en cada hoja.',    emoji: '✨' },
  { name: 'Árbol legendario', description: 'Una leyenda del aprendizaje.',             emoji: '🌟' },
  { name: 'Bosque vivo',      description: '¡Eres un ecosistema de sabiduría!',       emoji: '🌏' },
];

const STAGE_THRESHOLDS = [0, 5, 15, 30, 60, 100, 150, 220, 300, 400, 550, 750];

// ─── COLOR PALETTES POR STAGE ─────────────────────────────────────────────────
const STAGE_PALETTES = [
  // 0: semilla
  { trunk: '#8B6914', bark: '#A07820', leaf1: null, leaf2: null, leaf3: null, glow: '#d4a017' },
  // 1: brote
  { trunk: '#8B5E3C', bark: '#A06830', leaf1: '#4ade80', leaf2: '#86efac', leaf3: '#22c55e', glow: '#4ade80' },
  // 2: planta joven
  { trunk: '#92400e', bark: '#a05020', leaf1: '#22c55e', leaf2: '#4ade80', leaf3: '#16a34a', glow: '#4ade80' },
  // 3: arbusto
  { trunk: '#78350f', bark: '#8a4010', leaf1: '#16a34a', leaf2: '#22c55e', leaf3: '#15803d', glow: '#22c55e' },
  // 4: árbol joven
  { trunk: '#78350f', bark: '#6b2f0e', leaf1: '#15803d', leaf2: '#22c55e', leaf3: '#166534', glow: '#86efac' },
  // 5: árbol maduro
  { trunk: '#78350f', bark: '#6b2f0e', leaf1: '#14532d', leaf2: '#166534', leaf3: '#15803d', glow: '#86efac' },
  // 6: árbol frondoso (tono más oscuro/profundo)
  { trunk: '#6b2f0e', bark: '#5a2508', leaf1: '#14532d', leaf2: '#15803d', leaf3: '#166534', glow: '#4ade80' },
  // 7: árbol fuerte (tono otoñal)
  { trunk: '#5a2508', bark: '#4a1e06', leaf1: '#166534', leaf2: '#16a34a', leaf3: '#15803d', glow: '#86efac' },
  // 8: árbol antiguo (tono dorado)
  { trunk: '#4a1e06', bark: '#3d1804', leaf1: '#15803d', leaf2: '#ca8a04', leaf3: '#166534', glow: '#fbbf24' },
  // 9: árbol sabio (tono azulado/estelar)
  { trunk: '#3d1804', bark: '#331403', leaf1: '#0f766e', leaf2: '#14b8a6', leaf3: '#0d9488', glow: '#2dd4bf' },
  // 10: árbol legendario (púrpura)
  { trunk: '#331403', bark: '#2a1002', leaf1: '#7e22ce', leaf2: '#a855f7', leaf3: '#9333ea', glow: '#c084fc' },
  // 11: bosque vivo (multicolor)
  { trunk: '#2a1002', bark: '#1e0b01', leaf1: '#065f46', leaf2: '#0f766e', leaf3: '#0369a1', glow: '#6ee7b7' },
];

// ─── SVG DEL ÁRBOL ───────────────────────────────────────────────────────────
function TreeSVG({ stage, isGlowing, isWatering, treeEnergy, animationType }) {
  const p = STAGE_PALETTES[Math.min(stage, STAGE_PALETTES.length - 1)];
  const energyLevel = Math.min(treeEnergy || 0, 100);
  const particleCount = Math.floor(energyLevel / 20) + 1; // 1-5 partículas

  const css = `
    @keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-${4 + (energyLevel / 25)}px); } }
    @keyframes dropFall  { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(32px); } }
    @keyframes sparkle   { 0%,100% { opacity:0.3; } 50% { opacity:1; } }
    @keyframes leafFall  { 0% { opacity:1; transform:translateY(0) rotate(0deg); } 100% { opacity:0; transform:translateY(40px) rotate(45deg); } }
    @keyframes pulse     { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:0.9; transform:scale(1.08); } }
    @keyframes bloom     { 0% { opacity:0; transform:scale(0.5); } 100% { opacity:0.35; transform:scale(1); } }
  `;

  const treeStyle = { animation: `treeFloat ${3 - (energyLevel / 100)}s ease-in-out infinite` };

  const drops = (cx1, cy1, cx2, cy2, cx3, cy3, r = 2.5) => isWatering && (
    <>
      <circle cx={cx1} cy={cy1} r={r} fill="#60a5fa" style={{ animation: 'dropFall 0.9s ease-in infinite 0s' }} />
      <circle cx={cx2} cy={cy2} r={r} fill="#93c5fd" style={{ animation: 'dropFall 0.9s ease-in infinite 0.3s' }} />
      <circle cx={cx3} cy={cy3} r={r} fill="#60a5fa" style={{ animation: 'dropFall 0.9s ease-in infinite 0.6s' }} />
    </>
  );

  const glowEllipse = (cx, cy, rx, ry) => isGlowing && (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={p.glow} opacity="0.3" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
  );

  const leaves = (cx, cy) => animationType === 'lesson' && (
    <>
      <circle cx={cx - 5} cy={cy} r={2} fill={p.leaf1} opacity="0.8" style={{ animation: 'leafFall 1.2s ease-in infinite 0s' }} />
      <circle cx={cx + 5} cy={cy - 5} r={1.5} fill={p.leaf2} opacity="0.8" style={{ animation: 'leafFall 1.2s ease-in infinite 0.4s' }} />
      <circle cx={cx} cy={cy + 3} r={2} fill={p.leaf1} opacity="0.7" style={{ animation: 'leafFall 1.2s ease-in infinite 0.8s' }} />
    </>
  );

  // Sparkles adicionales según energía (streak 7+)
  const sparkles = (cx, cy, offset = 0) => energyLevel > 60 && (
    <circle cx={cx} cy={cy} r={2.5} fill={p.glow} opacity="0.9"
      style={{ animation: `sparkle 1.8s ease-in-out infinite ${offset}s` }} />
  );

  // ─── STAGE 0: Semilla ───────────────────────────────────────────────────────
  if (stage === 0) return (
    <svg viewBox="0 0 120 120" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="100" rx="28" ry="5" fill="#c8a97e" opacity="0.3" />
      {glowEllipse(60, 88, 20, 16)}
      <ellipse cx="60" cy="90" rx="10" ry="8" fill={p.trunk} />
      <ellipse cx="60" cy="86" rx="6" ry="5" fill={p.bark} />
      {drops(50, 68, 60, 62, 70, 68, 2)}
    </svg>
  );

  // ─── STAGE 1: Brote ─────────────────────────────────────────────────────────
  if (stage === 1) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="115" rx="30" ry="6" fill="#c8a97e" opacity="0.3" />
      {glowEllipse(60, 74, 24, 24)}
      <rect x="57" y="80" width="6" height="30" rx="3" fill={p.trunk} />
      <ellipse cx="60" cy="72" rx="14" ry="16" fill={p.leaf1} />
      <ellipse cx="60" cy="68" rx="10" ry="12" fill={p.leaf2} />
      <ellipse cx="52" cy="78" rx="8" ry="6" fill={p.leaf3} opacity="0.7" />
      <ellipse cx="68" cy="76" rx="8" ry="6" fill={p.leaf3} opacity="0.7" />
      {leaves(60, 55)}
      {drops(48, 50, 60, 44, 72, 50, 2.5)}
    </svg>
  );

  // ─── STAGE 2: Planta joven ──────────────────────────────────────────────────
  if (stage === 2) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="118" rx="32" ry="7" fill="#c8a97e" opacity="0.3" />
      {glowEllipse(60, 62, 32, 30)}
      <rect x="56" y="70" width="8" height="45" rx="4" fill={p.bark} />
      <ellipse cx="60" cy="60" rx="22" ry="24" fill={p.leaf1} />
      <ellipse cx="60" cy="54" rx="16" ry="18" fill={p.leaf2} />
      <ellipse cx="48" cy="65" rx="12" ry="9" fill={p.leaf3} opacity="0.8" />
      <ellipse cx="72" cy="63" rx="12" ry="9" fill={p.leaf3} opacity="0.8" />
      <ellipse cx="60" cy="48" rx="10" ry="10" fill={p.leaf2} opacity="0.7" />
      {leaves(60, 35)}
      {sparkles(80, 45)}
      {drops(45, 34, 60, 28, 75, 34, 2.5)}
    </svg>
  );

  // ─── STAGE 3: Arbusto ───────────────────────────────────────────────────────
  if (stage === 3) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="120" rx="36" ry="7" fill="#c8a97e" opacity="0.3" />
      {glowEllipse(60, 52, 38, 36)}
      <rect x="54" y="65" width="12" height="52" rx="5" fill={p.trunk} />
      <rect x="40" y="82" width="20" height="6" rx="3" fill={p.trunk} transform="rotate(-20 40 82)" />
      <rect x="60" y="80" width="20" height="6" rx="3" fill={p.trunk} transform="rotate(20 60 80)" />
      <ellipse cx="60" cy="52" rx="28" ry="28" fill={p.leaf3} />
      <ellipse cx="60" cy="46" rx="22" ry="22" fill={p.leaf1} />
      <ellipse cx="44" cy="58" rx="14" ry="10" fill={p.leaf3} opacity="0.7" />
      <ellipse cx="76" cy="56" rx="14" ry="10" fill={p.leaf3} opacity="0.7" />
      <ellipse cx="60" cy="38" rx="14" ry="13" fill={p.leaf2} opacity="0.8" />
      {leaves(60, 22)}
      {sparkles(78, 35, 0.3)}
      {drops(42, 16, 60, 10, 78, 16, 3)}
    </svg>
  );

  // ─── STAGE 4: Árbol joven ───────────────────────────────────────────────────
  if (stage === 4) return (
    <svg viewBox="0 0 140 140" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="70" cy="130" rx="44" ry="8" fill="#c8a97e" opacity="0.3" />
      {glowEllipse(70, 50, 48, 44)}
      <rect x="63" y="65" width="14" height="62" rx="6" fill={p.trunk} />
      <rect x="35" y="88" width="28" height="7" rx="3" fill={p.trunk} transform="rotate(-25 35 88)" />
      <rect x="77" y="85" width="28" height="7" rx="3" fill={p.trunk} transform="rotate(25 77 85)" />
      <ellipse cx="70" cy="50" rx="38" ry="36" fill={p.leaf3} />
      <ellipse cx="70" cy="42" rx="30" ry="30" fill={p.leaf1} />
      <ellipse cx="50" cy="56" rx="18" ry="13" fill={p.leaf3} opacity="0.7" />
      <ellipse cx="90" cy="54" rx="18" ry="13" fill={p.leaf3} opacity="0.7" />
      <ellipse cx="70" cy="30" rx="20" ry="18" fill={p.leaf2} opacity="0.9" />
      <ellipse cx="56" cy="40" rx="10" ry="8" fill={p.leaf2} opacity="0.7" />
      <ellipse cx="84" cy="38" rx="10" ry="8" fill={p.leaf2} opacity="0.7" />
      {leaves(70, 12)}
      {sparkles(88, 28, 0.5)}
      {drops(48, 8, 70, 2, 92, 8, 3)}
    </svg>
  );

  // ─── STAGE 5: Árbol maduro ──────────────────────────────────────────────────
  if (stage === 5) return (
    <svg viewBox="0 0 160 150" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="80" cy="140" rx="55" ry="9" fill="#c8a97e" opacity="0.35" />
      {glowEllipse(80, 50, 62, 54)}
      <rect x="73" y="70" width="14" height="68" rx="6" fill={p.trunk} />
      <rect x="36" y="96" width="36" height="8" rx="4" fill={p.trunk} transform="rotate(-28 36 96)" />
      <rect x="88" y="92" width="36" height="8" rx="4" fill={p.trunk} transform="rotate(28 88 92)" />
      <ellipse cx="80" cy="52" rx="52" ry="46" fill={p.leaf3} />
      <ellipse cx="80" cy="44" rx="42" ry="38" fill={p.leaf1} />
      <ellipse cx="58" cy="60" rx="22" ry="16" fill={p.leaf3} opacity="0.85" />
      <ellipse cx="102" cy="58" rx="22" ry="16" fill={p.leaf3} opacity="0.85" />
      <ellipse cx="80" cy="34" rx="30" ry="26" fill={p.leaf1} />
      <ellipse cx="64" cy="44" rx="14" ry="11" fill={p.leaf2} opacity="0.85" />
      <ellipse cx="96" cy="42" rx="14" ry="11" fill={p.leaf2} opacity="0.85" />
      <ellipse cx="80" cy="24" rx="20" ry="18" fill={p.leaf2} opacity="0.9" />
      <circle cx="68" cy="30" r="3" fill={p.glow} opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 0s' }} />
      <circle cx="92" cy="28" r="2.5" fill={p.glow} opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 0.5s' }} />
      <circle cx="80" cy="18" r="3" fill={p.glow} opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 1s' }} />
      {leaves(80, 5)}
      {drops(54, 0, 80, -6, 106, 0, 3.5)}
    </svg>
  );

  // ─── STAGES 6-11: Extensiones visuales con paletas únicas ──────────────────
  // Reutilizamos la forma del stage 5 con paleta diferente + más detalles
  const extraSparkles = stage >= 8;
  const hasStars = stage >= 9;

  return (
    <svg viewBox="0 0 180 165" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      {/* Suelo */}
      <ellipse cx="90" cy="155" rx="66" ry="10" fill="#c8a97e" opacity="0.4" />
      {/* Glow base */}
      {glowEllipse(90, 55, 75, 65)}
      {/* Raíces extra para stages avanzados */}
      {stage >= 8 && (
        <>
          <rect x="58" y="125" width="8" height="20" rx="4" fill={p.trunk} transform="rotate(-15 58 125)" />
          <rect x="114" y="125" width="8" height="20" rx="4" fill={p.trunk} transform="rotate(15 114 125)" />
        </>
      )}
      {/* Tronco */}
      <rect x="82" y="80" width="16" height="72" rx="7" fill={p.trunk} />
      {/* Ramas */}
      <rect x="40" y="108" width="42" height="9" rx="4" fill={p.trunk} transform="rotate(-28 40 108)" />
      <rect x="98" y="104" width="42" height="9" rx="4" fill={p.trunk} transform="rotate(28 98 104)" />
      {stage >= 7 && (
        <>
          <rect x="52" y="90" width="30" height="7" rx="3" fill={p.bark} transform="rotate(-18 52 90)" />
          <rect x="98" y="88" width="30" height="7" rx="3" fill={p.bark} transform="rotate(18 98 88)" />
        </>
      )}
      {/* Copa principal */}
      <ellipse cx="90" cy="58" rx="62" ry="54" fill={p.leaf3} />
      <ellipse cx="90" cy="50" rx="50" ry="44" fill={p.leaf1} />
      <ellipse cx="66" cy="68" rx="26" ry="19" fill={p.leaf3} opacity="0.85" />
      <ellipse cx="114" cy="66" rx="26" ry="19" fill={p.leaf3} opacity="0.85" />
      <ellipse cx="90" cy="38" rx="36" ry="30" fill={p.leaf1} />
      <ellipse cx="72" cy="50" rx="17" ry="13" fill={p.leaf2} opacity="0.85" />
      <ellipse cx="108" cy="48" rx="17" ry="13" fill={p.leaf2} opacity="0.85" />
      <ellipse cx="90" cy="26" rx="24" ry="21" fill={p.leaf2} opacity="0.9" />
      {/* Sparkles básicos */}
      <circle cx="76" cy="32" r="3.5" fill={p.glow} opacity="0.85" style={{ animation: 'sparkle 2s ease-in-out infinite 0s' }} />
      <circle cx="104" cy="30" r="3" fill={p.glow} opacity="0.85" style={{ animation: 'sparkle 2s ease-in-out infinite 0.5s' }} />
      <circle cx="90" cy="18" r="3.5" fill={p.glow} opacity="0.85" style={{ animation: 'sparkle 2s ease-in-out infinite 1s' }} />
      {/* Sparkles extra para stages avanzados */}
      {extraSparkles && (
        <>
          <circle cx="62" cy="46" r="2.5" fill={p.glow} opacity="0.7" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }} />
          <circle cx="118" cy="44" r="2.5" fill={p.glow} opacity="0.7" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.8s' }} />
          <circle cx="90" cy="12" r="2" fill={p.glow} opacity="0.9" style={{ animation: 'sparkle 1.2s ease-in-out infinite 0.2s' }} />
        </>
      )}
      {/* Estrellas para stages legendarios */}
      {hasStars && (
        <>
          <polygon points="90,4 92,10 98,10 93,14 95,20 90,16 85,20 87,14 82,10 88,10" fill={p.glow} opacity="0.9" style={{ animation: 'sparkle 1.8s ease-in-out infinite' }} />
          <polygon points="68,22 69.5,27 74.5,27 70.5,30 72,35 68,32 64,35 65.5,30 61.5,27 66.5,27" fill={p.glow} opacity="0.8" style={{ animation: 'sparkle 2.2s ease-in-out infinite 0.6s' }} />
          <polygon points="112,20 113.5,25 118.5,25 114.5,28 116,33 112,30 108,33 109.5,28 105.5,25 110.5,25" fill={p.glow} opacity="0.8" style={{ animation: 'sparkle 1.9s ease-in-out infinite 1.1s' }} />
        </>
      )}
      {/* Bosque vivo: árboles pequeños laterales stage 11 */}
      {stage === 11 && (
        <>
          <rect x="22" y="128" width="6" height="22" rx="3" fill={p.trunk} />
          <ellipse cx="25" cy="118" rx="12" ry="14" fill={p.leaf1} opacity="0.8" />
          <rect x="152" y="128" width="6" height="22" rx="3" fill={p.trunk} />
          <ellipse cx="155" cy="118" rx="12" ry="14" fill={p.leaf3} opacity="0.8" />
        </>
      )}
      {/* Animación hojas */}
      {leaves(90, 5)}
      {/* Gotas */}
      {drops(62, -2, 90, -8, 118, -2, 4)}
    </svg>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TreeVisualization({ profile, userEmail }) {
  const queryClient = useQueryClient();

  const [optimistic, setOptimistic] = useState(null);
  const [stage, setStage] = useState(null);
  const [isWatering, setIsWatering] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const [treeScale, setTreeScale] = useState(1);
  const [watering, setWatering] = useState(false);
  const [animationType, setAnimationType] = useState(null); // 'lesson' | 'eval' | 'exam' | null
  const prevStage = useRef(null);

  const growthPoints = optimistic?.tree_growth_points ?? profile?.tree_growth_points ?? 0;
  const water = optimistic?.water_tokens ?? profile?.water_tokens ?? 0;
  // Fix #3: tree_energy siempre limitado a 100
  const treeEnergy = Math.min(100, optimistic?.tree_energy ?? profile?.tree_energy ?? 0);
  const growthStreak = profile?.growth_streak ?? 0;

  // ─── Fix #1: stage SOLO desde backend (perfil real), optimistic solo para water_tokens/growth_points ──
  useEffect(() => {
    if (profile?.tree_stage != null) {
      setStage(profile.tree_stage);
    }
  }, [profile?.tree_stage]);

  // ─── Animación al cambiar de stage (solo en cambios reales) ─────────────
  useEffect(() => {
    if (stage === null) return;
    if (prevStage.current === null) { prevStage.current = stage; return; }
    if (prevStage.current !== stage) {
      prevStage.current = stage;
      setIsGlowing(true);
      setTreeScale(1.1);
      setTimeout(() => { setTreeScale(1); }, 600);
      setTimeout(() => { setIsGlowing(false); }, 2500);
      // Confetti de crecimiento
      confetti({
        particleCount: 60 + (treeEnergy > 60 ? 60 : 0),
        spread: 70,
        colors: ['#4ade80', '#86efac', '#22c55e', '#bbf7d0', '#fbbf24'],
        origin: { y: 0.55 },
      });
    }
  }, [stage]);

  // ─── Escuchar eventos de animación externos ──────────────────────────────
  useEffect(() => {
    const handleExternalEvent = (e) => {
      const { event_type } = e.detail || {};
      if (event_type === 'lesson_completed') {
        setAnimationType('lesson');
        setTreeScale(1.04);
        setTimeout(() => { setTreeScale(1); setAnimationType(null); }, 1500);
      } else if (event_type === 'mini_eval_passed') {
        setIsWatering(true);
        setTreeScale(1.06);
        setTimeout(() => { setTreeScale(1); setIsWatering(false); }, 1800);
      } else if (event_type === 'exam_passed') {
        setIsGlowing(true);
        setTreeScale(1.1);
        setTimeout(() => { setTreeScale(1); }, 700);
        setTimeout(() => { setIsGlowing(false); }, 3000);
        confetti({
          particleCount: 120,
          spread: 90,
          colors: ['#fbbf24', '#f59e0b', '#4ade80', '#86efac'],
          origin: { y: 0.5 },
        });
      }
    };
    window.addEventListener('tree_animation_event', handleExternalEvent);
    return () => window.removeEventListener('tree_animation_event', handleExternalEvent);
  }, []);

  const currentStageInfo = TREE_STAGES[Math.min(stage ?? 0, TREE_STAGES.length - 1)];
  const isMaxStage = stage >= STAGE_THRESHOLDS.length;
  const nextThreshold = !isMaxStage ? STAGE_THRESHOLDS[stage + 1] : null;
  const prevThreshold = STAGE_THRESHOLDS[stage] ?? 0;
  const progressToNext = nextThreshold != null
    ? Math.min(100, Math.round(((growthPoints - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100;

  // ─── Indicador visual de streak ─────────────────────────────────────────
  const streakLabel = growthStreak >= 7
    ? '🔥 Racha legendaria'
    : growthStreak >= 3
      ? '✨ En racha'
      : null;

  const handleWater = async () => {
    if (watering || water <= 0) return;

    const prevOptimistic = optimistic;
    const newGrowth = growthPoints + 1;
    // Fix #1: optimistic NO toca tree_stage, solo tokens/points para UI inmediata
    setOptimistic({
      tree_growth_points: newGrowth,
      water_tokens: water - 1,
      tree_energy: Math.min(100, newGrowth + (growthStreak * 2)),
    });
    setWatering(true);
    setIsWatering(true);
    setTreeScale(1.06);
    setTimeout(() => setTreeScale(1), 400);

    try {
      const res = await base44.functions.invoke('waterTree', {});
      if (!res.data?.success) {
        setOptimistic(prevOptimistic);
      } else {
        // Fix #3: tree_energy del backend (ya viene limitado)
        setOptimistic({
          tree_growth_points: res.data.tree_growth_points,
          water_tokens: res.data.water_tokens,
          tree_energy: res.data.tree_energy ?? Math.min(100, res.data.tree_growth_points + growthStreak * 2),
        });
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

  // Fix #5: Skeleton en lugar de null para evitar flash en mount
  if (stage === null) return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-44 h-44 rounded-full bg-gray-100 animate-pulse" />
      <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
      <div className="w-full h-2.5 bg-gray-100 rounded-full animate-pulse" />
    </div>
  );

  // Intensidad visual basada en energy
  const glowIntensity = treeEnergy > 60
    ? 'drop-shadow-[0_0_28px_rgba(74,222,128,0.7)]'
    : 'drop-shadow-[0_0_16px_rgba(74,222,128,0.45)]';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Árbol SVG */}
      <div
        className={cn(
          "relative w-44 h-44 transition-all duration-500",
          isGlowing && glowIntensity
        )}
        style={{ transform: `scale(${treeScale})`, transition: 'transform 0.5s cubic-bezier(.34,1.56,.64,1)' }}
      >
        <TreeSVG
          stage={stage}
          isGlowing={isGlowing}
          isWatering={isWatering}
          treeEnergy={treeEnergy}
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
            "w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200",
            water > 0 && !watering
              ? "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md hover:shadow-lg active:scale-95"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          {watering ? (
            <><span className="animate-bounce">💧</span> Regando...</>
          ) : water > 0 ? (
            <>💧 Regar árbol</>
          ) : (
            <>Sin agua — completa actividades para conseguir más</>
          )}
        </button>
      )}

      {/* Indicadores de etapa (12 niveles) */}
      <div className="flex gap-1 justify-center flex-wrap max-w-[180px]">
        {TREE_STAGES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-500",
              i < stage ? "bg-green-500" : i === stage ? "bg-green-400 ring-2 ring-green-200 scale-125" : "bg-gray-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}