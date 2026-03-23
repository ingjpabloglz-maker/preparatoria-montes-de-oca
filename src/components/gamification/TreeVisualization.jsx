import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const TREE_STAGES = [
  { name: 'Semilla',        description: '¡Todo empieza con una semilla!' },
  { name: 'Brote',          description: 'Tu árbol empieza a crecer.' },
  { name: 'Planta joven',   description: 'Pequeño pero lleno de vida.' },
  { name: 'Árbol pequeño',  description: 'Raíces profundas, hojas frescas.' },
  { name: 'Árbol mediano',  description: 'Tu conocimiento florece.' },
  { name: 'Árbol frondoso', description: '¡Un árbol majestuoso del conocimiento!' },
];

const STAGE_THRESHOLDS = [0, 5, 15, 30, 60, 100];

function TreeSVG({ stage, isGlowing, isWatering }) {
  const treeStyle = { animation: 'treeFloat 3s ease-in-out infinite' };
  const css = `
    @keyframes treeFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
    @keyframes dropFall  { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(32px); } }
    @keyframes sparkle   { 0%,100% { opacity:0.3; } 50% { opacity:1; } }
  `;

  const drops = (cx1, cy1, cx2, cy2, cx3, cy3, r = 2.5) => isWatering && (
    <>
      <circle cx={cx1} cy={cy1} r={r} fill="#60a5fa" style={{ animation: 'dropFall 0.9s ease-in infinite 0s' }} />
      <circle cx={cx2} cy={cy2} r={r} fill="#93c5fd" style={{ animation: 'dropFall 0.9s ease-in infinite 0.3s' }} />
      <circle cx={cx3} cy={cy3} r={r} fill="#60a5fa" style={{ animation: 'dropFall 0.9s ease-in infinite 0.6s' }} />
    </>
  );
  const glow = (cx, cy, rx, ry) => isGlowing && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#86efac" opacity="0.3" />;

  if (stage === 0) return (
    <svg viewBox="0 0 120 120" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="100" rx="28" ry="5" fill="#c8a97e" opacity="0.3" />
      {glow(60, 88, 20, 16)}
      <ellipse cx="60" cy="90" rx="10" ry="8" fill="#8B6914" />
      <ellipse cx="60" cy="86" rx="6" ry="5" fill="#A07820" />
      {drops(50, 68, 60, 62, 70, 68, 2)}
    </svg>
  );

  if (stage === 1) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="115" rx="30" ry="6" fill="#c8a97e" opacity="0.3" />
      {glow(60, 74, 24, 24)}
      <rect x="57" y="80" width="6" height="30" rx="3" fill="#8B5E3C" />
      <ellipse cx="60" cy="72" rx="14" ry="16" fill="#4ade80" />
      <ellipse cx="60" cy="68" rx="10" ry="12" fill="#86efac" />
      <ellipse cx="52" cy="78" rx="8" ry="6" fill="#22c55e" opacity="0.7" />
      <ellipse cx="68" cy="76" rx="8" ry="6" fill="#22c55e" opacity="0.7" />
      {drops(48, 50, 60, 44, 72, 50, 2.5)}
    </svg>
  );

  if (stage === 2) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="118" rx="32" ry="7" fill="#c8a97e" opacity="0.3" />
      {glow(60, 62, 32, 30)}
      <rect x="56" y="70" width="8" height="45" rx="4" fill="#92400e" />
      <ellipse cx="60" cy="60" rx="22" ry="24" fill="#22c55e" />
      <ellipse cx="60" cy="54" rx="16" ry="18" fill="#4ade80" />
      <ellipse cx="48" cy="65" rx="12" ry="9" fill="#16a34a" opacity="0.8" />
      <ellipse cx="72" cy="63" rx="12" ry="9" fill="#16a34a" opacity="0.8" />
      <ellipse cx="60" cy="48" rx="10" ry="10" fill="#86efac" opacity="0.7" />
      {drops(45, 34, 60, 28, 75, 34, 2.5)}
    </svg>
  );

  if (stage === 3) return (
    <svg viewBox="0 0 120 130" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="60" cy="120" rx="36" ry="7" fill="#c8a97e" opacity="0.3" />
      {glow(60, 52, 38, 36)}
      <rect x="54" y="65" width="12" height="52" rx="5" fill="#78350f" />
      <rect x="40" y="82" width="20" height="6" rx="3" fill="#78350f" transform="rotate(-20 40 82)" />
      <rect x="60" y="80" width="20" height="6" rx="3" fill="#78350f" transform="rotate(20 60 80)" />
      <ellipse cx="60" cy="52" rx="28" ry="28" fill="#16a34a" />
      <ellipse cx="60" cy="46" rx="22" ry="22" fill="#22c55e" />
      <ellipse cx="44" cy="58" rx="14" ry="10" fill="#15803d" opacity="0.7" />
      <ellipse cx="76" cy="56" rx="14" ry="10" fill="#15803d" opacity="0.7" />
      <ellipse cx="60" cy="38" rx="14" ry="13" fill="#4ade80" opacity="0.8" />
      {drops(42, 16, 60, 10, 78, 16, 3)}
    </svg>
  );

  if (stage === 4) return (
    <svg viewBox="0 0 140 140" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="70" cy="130" rx="44" ry="8" fill="#c8a97e" opacity="0.3" />
      {isGlowing && <ellipse cx="70" cy="50" rx="48" ry="44" fill="#86efac" opacity="0.2" />}
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
      {drops(48, 8, 70, 2, 92, 8, 3)}
    </svg>
  );

  // Stage 5
  return (
    <svg viewBox="0 0 160 150" className="w-full h-full" style={treeStyle}>
      <style>{css}</style>
      <ellipse cx="80" cy="140" rx="55" ry="9" fill="#c8a97e" opacity="0.35" />
      {isGlowing && <ellipse cx="80" cy="50" rx="62" ry="54" fill="#86efac" opacity="0.15" />}
      <rect x="73" y="70" width="14" height="68" rx="6" fill="#78350f" />
      <rect x="36" y="96" width="36" height="8" rx="4" fill="#78350f" transform="rotate(-28 36 96)" />
      <rect x="88" y="92" width="36" height="8" rx="4" fill="#78350f" transform="rotate(28 88 92)" />
      <ellipse cx="80" cy="52" rx="52" ry="46" fill="#14532d" />
      <ellipse cx="80" cy="44" rx="42" ry="38" fill="#166534" />
      <ellipse cx="58" cy="60" rx="22" ry="16" fill="#15803d" opacity="0.85" />
      <ellipse cx="102" cy="58" rx="22" ry="16" fill="#15803d" opacity="0.85" />
      <ellipse cx="80" cy="34" rx="30" ry="26" fill="#22c55e" />
      <ellipse cx="64" cy="44" rx="14" ry="11" fill="#4ade80" opacity="0.85" />
      <ellipse cx="96" cy="42" rx="14" ry="11" fill="#4ade80" opacity="0.85" />
      <ellipse cx="80" cy="24" rx="20" ry="18" fill="#86efac" opacity="0.9" />
      <circle cx="68" cy="30" r="3" fill="#bbf7d0" opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 0s' }} />
      <circle cx="92" cy="28" r="2.5" fill="#bbf7d0" opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 0.5s' }} />
      <circle cx="80" cy="18" r="3" fill="#bbf7d0" opacity="0.8" style={{ animation: 'sparkle 2s ease-in-out infinite 1s' }} />
      {drops(54, 0, 80, -6, 106, 0, 3.5)}
    </svg>
  );
}

export default function TreeVisualization({ profile, userEmail }) {
  const queryClient = useQueryClient();

  // Estado optimista local
  const [optimistic, setOptimistic] = useState(null);
  const [isWatering, setIsWatering] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const [treeScale, setTreeScale] = useState(1);
  const [watering, setWatering] = useState(false);
  const prevStage = useRef(profile?.tree_stage ?? 0);

  const stage = optimistic?.tree_stage ?? profile?.tree_stage ?? 0;
  const growthPoints = optimistic?.tree_growth_points ?? profile?.tree_growth_points ?? 0;
  const water = optimistic?.water_tokens ?? profile?.water_tokens ?? 0;

  // Reacción a cambio de etapa (desde perfil real)
  useEffect(() => {
    const currentStage = profile?.tree_stage ?? 0;
    if (prevStage.current !== currentStage) {
      prevStage.current = currentStage;
    }
  }, [profile?.tree_stage]);

  const currentStageInfo = TREE_STAGES[stage] || TREE_STAGES[0];
  const nextThreshold = stage < 5 ? STAGE_THRESHOLDS[stage + 1] : STAGE_THRESHOLDS[5];
  const prevThreshold = STAGE_THRESHOLDS[stage];
  const progressToNext = stage < 5
    ? Math.min(100, Math.round(((growthPoints - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100;

  const handleWater = async () => {
    if (watering || water <= 0) return;

    // Optimistic UI
    const prevOptimistic = optimistic;
    const newGrowth = growthPoints + 1;
    const newStage = (() => {
      let s = 0;
      for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (newGrowth >= STAGE_THRESHOLDS[i]) { s = i; break; }
      }
      return s;
    })();
    const levelUp = newStage > stage;

    setOptimistic({ tree_stage: newStage, tree_growth_points: newGrowth, water_tokens: water - 1 });
    setWatering(true);
    setIsWatering(true);

    // Micro animación de scale
    setTreeScale(1.06);
    setTimeout(() => setTreeScale(1), 400);

    if (levelUp) {
      setIsGlowing(true);
      setTimeout(() => setIsGlowing(false), 2000);
      confetti({
        particleCount: 80,
        spread: 60,
        colors: ['#4ade80', '#86efac', '#22c55e', '#bbf7d0'],
        origin: { y: 0.55 },
      });
    }

    try {
      const res = await base44.functions.invoke('waterTree', {});
      if (!res.data?.success) {
        setOptimistic(prevOptimistic); // revertir
      } else {
        setOptimistic({
          tree_stage: res.data.tree_stage,
          tree_growth_points: res.data.tree_growth_points,
          water_tokens: res.data.water_tokens,
        });
      }
      queryClient.invalidateQueries(['gamificationProfile', userEmail]);
    } catch {
      setOptimistic(prevOptimistic); // revertir si falla
    } finally {
      setWatering(false);
      setTimeout(() => setIsWatering(false), 1200);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Árbol SVG */}
      <div
        className={cn(
          "relative w-44 h-44 transition-all duration-500",
          isGlowing && "drop-shadow-[0_0_20px_rgba(74,222,128,0.6)]"
        )}
        style={{ transform: `scale(${treeScale})`, transition: 'transform 0.4s cubic-bezier(.34,1.56,.64,1)' }}
      >
        <TreeSVG stage={stage} isGlowing={isGlowing} isWatering={isWatering} />
      </div>

      {/* Info */}
      <div className="text-center">
        <p className="font-bold text-gray-800 text-base">{currentStageInfo.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{currentStageInfo.description}</p>
      </div>

      {/* Progreso */}
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-600 font-medium">💧 {water} agua disponible</span>
          {stage < 5 && (
            <span className="text-xs text-gray-400">{growthPoints} / {nextThreshold} puntos</span>
          )}
        </div>
        {stage < 5 ? (
          <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-400 to-green-400 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        ) : (
          <p className="text-center text-xs text-green-600 font-semibold">🌳 ¡Árbol del conocimiento completo!</p>
        )}
      </div>

      {/* Botón regar */}
      {stage < 5 && (
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
            <>
              <span className="animate-bounce">💧</span> Regando...
            </>
          ) : water > 0 ? (
            <>💧 Regar árbol</>
          ) : (
            <>Sin agua — completa actividades para conseguir más</>
          )}
        </button>
      )}

      {/* Indicadores de etapa */}
      <div className="flex gap-1.5 justify-center">
        {TREE_STAGES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-500",
              i < stage ? "bg-green-500" : i === stage ? "bg-green-400 ring-2 ring-green-200" : "bg-gray-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}