import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Target, Star, Trophy, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const MIN_TARGET = 5;

const GOAL_OPTIONS = [
  { value: 5,  label: '5 lecciones',  desc: 'Ritmo tranquilo',   emoji: '🌱' },
  { value: 7,  label: '7 lecciones',  desc: 'Progreso constante', emoji: '🔥' },
  { value: 10, label: '10 lecciones', desc: 'Ritmo intenso',      emoji: '⚡' },
  { value: 15, label: '15 lecciones', desc: 'Máximo esfuerzo',    emoji: '🏆' },
];

// Muestra la recompensa esperada según el número de meta en el ciclo
function RewardBadge({ goalNumber }) {
  if (goalNumber === 1) return (
    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      <span>Al completarla recibirás <strong>50 XP</strong> + <strong>3 ⭐</strong></span>
    </div>
  );
  if (goalNumber === 2) return (
    <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
      <Zap className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      <span>Al completarla recibirás <strong>25 XP</strong> + <strong>1 ⭐</strong> <span className="text-gray-400">(2ª meta del ciclo)</span></span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
      <Trophy className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span>Meta adicional — solo progreso visual, sin recompensas extra en este ciclo</span>
    </div>
  );
}

export default function WeeklyGoalSetupModal({ onComplete, onDismiss, goalNumberInCycle = 1 }) {
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsedCustom = custom ? parseInt(custom, 10) : null;
  const finalGoal = parsedCustom ?? selected;
  const isValidGoal = finalGoal && Number.isInteger(finalGoal) && finalGoal >= MIN_TARGET && finalGoal <= 50;

  const handleSave = async () => {
    if (!isValidGoal) return;
    setSaving(true);
    setError('');
    const res = await base44.functions.invoke('setWeeklyGoal', { goal: finalGoal });
    setSaving(false);
    // HTTP 409: ya existe una meta activa (race condition o doble click)
    if (res?.status === 409 || res?.data?.existing_session) {
      onComplete({ status: 'ok', existing: true, ...res.data });
      return;
    }
    if (res?.data?.status === 'ok') {
      onComplete(res.data);
    } else {
      setError(res?.data?.error || 'Ocurrió un error. Intenta de nuevo.');
    }
  };

  const isNewCycle = goalNumberInCycle === 1;
  const title = isNewCycle ? '¿Cuál es tu meta semanal?' : '¿Quieres completar otra meta?';
  const subtitle = isNewCycle
    ? 'Elige cuántas lecciones quieres completar en los próximos 7 días.'
    : 'Tu meta anterior fue completada. Puedes iniciar otra dentro del mismo ciclo.';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Target className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>

        {/* Opciones rápidas */}
        <div className="grid grid-cols-2 gap-3">
          {GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSelected(opt.value); setCustom(''); setError(''); }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                selected === opt.value && !parsedCustom
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{opt.emoji}</span>
              <p className="font-semibold text-gray-800 text-sm mt-1">{opt.label}</p>
              <p className="text-xs text-gray-500">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* Meta personalizada */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">
            O escribe un número personalizado ({MIN_TARGET}–50)
          </label>
          <input
            type="number"
            min={MIN_TARGET}
            max={50}
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(null); setError(''); }}
            placeholder={`Mínimo ${MIN_TARGET}`}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {custom && parsedCustom < MIN_TARGET && (
            <p className="text-xs text-red-500 mt-1">El mínimo es {MIN_TARGET} lecciones.</p>
          )}
        </div>

        {/* Recompensa según número de meta en ciclo */}
        <RewardBadge goalNumber={goalNumberInCycle} />

        {error && <p className="text-xs text-red-600 text-center">{error}</p>}

        <div className="flex gap-3">
          {onDismiss && (
            <Button variant="outline" onClick={onDismiss} className="flex-1" disabled={saving}>
              Ahora no
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!isValidGoal || saving}
            className="flex-1"
          >
            {saving ? 'Guardando...' : `Comenzar: ${finalGoal ? `${finalGoal} lecciones` : '...'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}