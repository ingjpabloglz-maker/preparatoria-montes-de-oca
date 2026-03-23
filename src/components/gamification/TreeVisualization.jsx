import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const TREE_STAGES = [
  { name: 'Semilla',       tokens: 0,   description: '¡Todo empieza con una semilla!' },
  { name: 'Brote',         tokens: 5,   description: 'Tu árbol empieza a crecer.' },
  { name: 'Planta joven',  tokens: 15,  description: 'Pequeño pero lleno de vida.' },
  { name: 'Árbol pequeño', tokens: 30,  description: 'Raíces profundas, hojas frescas.' },
  { name: 'Árbol mediano', tokens: 60,  description: 'Tu conocimiento florece.' },
  { name: 'Árbol frondoso',tokens: 100, description: '¡Un árbol majestuoso del conocimiento!' },
];

const STAGE_TOKENS = [0, 5, 15, 30, 60, 100];

// SVG para cada etapa del árbol
function TreeSVG({ stage, isGlowing, isWatering }) {
  const treeStyle = {
    animation: 'treeFloat 3s ease-in-out infinite',
  };

  // Stage 0: Semilla
  if (stage === 0) return (
    <svg viewBox="0 0 120 120" className="w-full h-full" style={treeStyle}>
      <style>{`
        @keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        @keyframes dropFall { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(30px); } }
      `}</style>
      <ellipse cx="60" cy="100" rx="28" ry="5" fill="#c8a97e" opacity="0.3" />
      <ellipse cx="60" cy="90" rx="10" ry="8" fill="#8B6914" />
      <ellipse cx="60" cy="86" rx="6" ry="5" fill="#A07820" />
      {isGlowing && <ellipse cx="60" cy="88" rx="18" ry="14" fill="#86efac" opacity="0.3" />}
      {isWatering && <>
        <circle cx="50" cy="70" r="2" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0s' }} />
        <circle cx="60" cy="65" r="2" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.3s' }} />
        <circle cx="70" cy="70" r="2" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.6s' }} />
      </>}
    </svg>
  );

  // Stage 1: Brote
  if (stage === 1) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{`@keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } } @keyframes dropFall { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(30px); } }`}</style>
      <ellipse cx="60" cy="115" rx="30" ry="6" fill="#c8a97e" opacity="0.3" />
      <rect x="57" y="80" width="6" height="30" rx="3" fill="#8B5E3C" />
      <ellipse cx="60" cy="72" rx="14" ry="16" fill="#4ade80" />
      <ellipse cx="60" cy="68" rx="10" ry="12" fill="#86efac" />
      <ellipse cx="52" cy="78" rx="8" ry="6" fill="#22c55e" opacity="0.7" />
      <ellipse cx="68" cy="76" rx="8" ry="6" fill="#22c55e" opacity="0.7" />
      {isGlowing && <ellipse cx="60" cy="74" rx="22" ry="22" fill="#86efac" opacity="0.3" />}
      {isWatering && <>
        <circle cx="48" cy="55" r="2.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0s' }} />
        <circle cx="60" cy="50" r="2.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.3s' }} />
        <circle cx="72" cy="55" r="2.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.6s' }} />
      </>}
    </svg>
  );

  // Stage 2: Planta joven
  if (stage === 2) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{`@keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } } @keyframes dropFall { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(30px); } }`}</style>
      <ellipse cx="60" cy="118" rx="32" ry="7" fill="#c8a97e" opacity="0.3" />
      <rect x="56" y="70" width="8" height="45" rx="4" fill="#92400e" />
      <ellipse cx="60" cy="60" rx="22" ry="24" fill="#22c55e" />
      <ellipse cx="60" cy="54" rx="16" ry="18" fill="#4ade80" />
      <ellipse cx="48" cy="65" rx="12" ry="9" fill="#16a34a" opacity="0.8" />
      <ellipse cx="72" cy="63" rx="12" ry="9" fill="#16a34a" opacity="0.8" />
      <ellipse cx="60" cy="48" rx="10" ry="10" fill="#86efac" opacity="0.7" />
      {isGlowing && <ellipse cx="60" cy="62" rx="30" ry="28" fill="#86efac" opacity="0.25" />}
      {isWatering && <>
        <circle cx="45" cy="38" r="2.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0s' }} />
        <circle cx="60" cy="32" r="2.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.3s' }} />
        <circle cx="75" cy="38" r="2.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.6s' }} />
      </>}
    </svg>
  );

  // Stage 3: Árbol pequeño
  if (stage === 3) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{`@keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } } @keyframes dropFall { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(30px); } }`}</style>
      <ellipse cx="60" cy="120" rx="36" ry="7" fill="#c8a97e" opacity="0.3" />
      <rect x="54" y="65" width="12" height="52" rx="5" fill="#78350f" />
      <rect x="40" y="82" width="20" height="6" rx="3" fill="#78350f" transform="rotate(-20 40 82)" />
      <rect x="60" y="80" width="20" height="6" rx="3" fill="#78350f" transform="rotate(20 60 80)" />
      <ellipse cx="60" cy="52" rx="28" ry="28" fill="#16a34a" />
      <ellipse cx="60" cy="46" rx="22" ry="22" fill="#22c55e" />
      <ellipse cx="44" cy="58" rx="14" ry="10" fill="#15803d" opacity="0.7" />
      <ellipse cx="76" cy="56" rx="14" ry="10" fill="#15803d" opacity="0.7" />
      <ellipse cx="60" cy="38" rx="14" ry="13" fill="#4ade80" opacity="0.8" />
      {isGlowing && <ellipse cx="60" cy="52" rx="36" ry="34" fill="#86efac" opacity="0.2" />}
      {isWatering && <>
        <circle cx="42" cy="20" r="3" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0s' }} />
        <circle cx="60" cy="14" r="3" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.3s' }} />
        <circle cx="78" cy="20" r="3" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.6s' }} />
      </>}
    </svg>
  );

  // Stage 4: Árbol mediano
  if (stage === 4) return (
    <svg viewBox="0 0 140 140" className="w-full h-full" style={treeStyle}>
      <style>{`@keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } } @keyframes dropFall { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(30px); } }`}</style>
      <ellipse cx="70" cy="130" rx="44" ry="8" fill="#c8a97e" opacity="0.3" />
      <rect x="63" y="65" width="14" height="62" rx="6" fill="#78350f" />
      <rect x="35" y="88" width="28" height="7" rx="3" fill="#78350f" transform="rotate(-25 35 88)" />
      <rect x="77" y="85" width="28" height="7" rx="3" fill="#78350f" transform="rotate(25 77 85)" />
      <ellipse cx="70" cy="50" rx="38" ry="36" fill="#15803d" />
      <ellipse cx="70" cy="42" rx="30" ry="30" fill="#22c55e" />
      <ellipse cx="50" cy="56" rx="18" ry="13" fill="#166534" opacity="0.7" />
      <ellipse cx="90" cy="54" rx="18" ry="13" fill="#166534" opacity="0.7" />
      <ellipse cx="70" cy="30" rx="20" ry="18" fill="#4ade80" opacity="0.9" />
      <ellipse cx="56" cy="40" rx="10" ry="8" fill="#86efac" opacity="0.7" />
      <ellipse cx="84" cy="38" rx="10" ry="8" fill="#86efac" opacity="0.7" />
      {isGlowing && <ellipse cx="70" cy="50" rx="46" ry="42" fill="#86efac" opacity="0.18" />}
      {isWatering && <>
        <circle cx="48" cy="10" r="3" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0s' }} />
        <circle cx="70" cy="4" r="3" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.3s' }} />
        <circle cx="92" cy="10" r="3" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.6s' }} />
      </>}
    </svg>
  );

  // Stage 5: Árbol frondoso
  return (
    <svg viewBox="0 0 160 150" className="w-full h-full" style={treeStyle}>
      <style>{`@keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } } @keyframes dropFall { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(30px); } } @keyframes sparkle { 0%,100% { opacity:0.3; } 50% { opacity:1; } }`}</style>
      <ellipse cx="80" cy="140" rx="55" ry="9" fill="#c8a97e" opacity="0.35" />
      <rect x="73" y="70" width="14" height="68" rx="6" fill="#78350f" />
      <rect x="36" y="96" width="36" height="8" rx="4" fill="#78350f" transform="rotate(-28 36 96)" />
      <rect x="88" y="92" width="36" height="8" rx="4" fill="#78350f" transform="rotate(28 88 92)" />
      {/* Capa exterior */}
      <ellipse cx="80" cy="52" rx="52" ry="46" fill="#14532d" />
      {/* Capas medias */}
      <ellipse cx="80" cy="44" rx="42" ry="38" fill="#166534" />
      <ellipse cx="58" cy="60" rx="22" ry="16" fill="#15803d" opacity="0.85" />
      <ellipse cx="102" cy="58" rx="22" ry="16" fill="#15803d" opacity="0.85" />
      {/* Copa */}
      <ellipse cx="80" cy="34" rx="30" ry="26" fill="#22c55e" />
      <ellipse cx="64" cy="44" rx="14" ry="11" fill="#4ade80" opacity="0.85" />
      <ellipse cx="96" cy="42" rx="14" ry="11" fill="#4ade80" opacity="0.85" />
      <ellipse cx="80" cy="24" rx="20" ry="18" fill="#86efac" opacity="0.9" />
      {/* Detalles brillantes */}
      <circle cx="68" cy="30" r="3" fill="#bbf7d0" opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 0s' }} />
      <circle cx="92" cy="28" r="2.5" fill="#bbf7d0" opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 0.5s' }} />
      <circle cx="80" cy="18" r="3" fill="#bbf7d0" opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 1s' }} />
      {isGlowing && <ellipse cx="80" cy="50" rx="60" ry="52" fill="#86efac" opacity="0.15" />}
      {isWatering && <>
        <circle cx="54" cy="2" r="3.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0s' }} />
        <circle cx="80" cy="-4" r="3.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.3s' }} />
        <circle cx="106" cy="2" r="3.5" fill="#60a5fa" style={{ animation: 'dropFall 1s ease-in infinite 0.6s' }} />
      </>}
    </svg>
  );
}

export default function TreeVisualization({ profile, isWatering = false }) {
  const stage = profile?.tree_stage ?? 0;
  const water = profile?.water_tokens ?? 0;
  const [isGlowing, setIsGlowing] = useState(false);
  const prevStage = useRef(stage);

  useEffect(() => {
    if (prevStage.current !== stage) {
      setIsGlowing(true);
      const t = setTimeout(() => setIsGlowing(false), 2000);
      prevStage.current = stage;
      return () => clearTimeout(t);
    }
  }, [stage]);

  const currentStageInfo = TREE_STAGES[stage] || TREE_STAGES[0];
  const nextStageTokens = stage < 5 ? STAGE_TOKENS[stage + 1] : STAGE_TOKENS[5];
  const progressToNext = stage < 5
    ? Math.min(100, Math.round(((water - STAGE_TOKENS[stage]) / (nextStageTokens - STAGE_TOKENS[stage])) * 100))
    : 100;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Árbol SVG */}
      <div
        className={cn(
          "relative w-40 h-40 transition-all duration-700",
          isGlowing && "drop-shadow-[0_0_16px_rgba(134,239,172,0.7)]"
        )}
      >
        <TreeSVG stage={stage} isGlowing={isGlowing} isWatering={isWatering} />
      </div>

      {/* Info del árbol */}
      <div className="text-center">
        <p className="font-bold text-gray-800 text-base">{currentStageInfo.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{currentStageInfo.description}</p>
      </div>

      {/* Tokens y progreso */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-blue-600 font-medium">
            💧 {water} tokens
          </span>
          {stage < 5 && (
            <span className="text-xs text-gray-400">
              Siguiente: {nextStageTokens} 💧
            </span>
          )}
        </div>
        {stage < 5 && (
          <div className="w-full bg-blue-100 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-blue-400 to-green-400 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        )}
        {stage === 5 && (
          <div className="text-center text-xs text-green-600 font-medium">
            🌳 ¡Árbol del conocimiento completo!
          </div>
        )}
      </div>

      {/* Etapas */}
      <div className="flex gap-1 justify-center">
        {TREE_STAGES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-500",
              i < stage ? "bg-green-500" : i === stage ? "bg-green-400 ring-2 ring-green-300" : "bg-gray-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}