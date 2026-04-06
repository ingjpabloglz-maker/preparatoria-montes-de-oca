import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Target, Zap, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const GOAL_OPTIONS = [
  { value: 3, label: '3 lecciones', desc: 'Ritmo tranquilo', emoji: '🌱' },
  { value: 5, label: '5 lecciones', desc: 'Progreso constante', emoji: '🔥' },
  { value: 7, label: '7 lecciones', desc: 'Ritmo intenso', emoji: '⚡' },
  { value: 10, label: '10 lecciones', desc: 'Máximo esfuerzo', emoji: '🏆' },
];

export default function WeeklyGoalSetupModal({ onComplete }) {
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const finalGoal = custom ? parseInt(custom) : selected;

  const handleSave = async () => {
    if (!finalGoal || finalGoal < 1 || finalGoal > 50) return;
    setSaving(true);
    await base44.functions.invoke('setWeeklyGoal', { goal: finalGoal });
    setSaving(false);
    onComplete(finalGoal);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Target className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">¿Cuál es tu meta semanal?</h2>
          <p className="text-sm text-gray-500">
            Elige cuántas lecciones quieres completar cada semana. Puedes cambiarla cuando quieras.
          </p>
        </div>

        {/* Opciones rápidas */}
        <div className="grid grid-cols-2 gap-3">
          {GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSelected(opt.value); setCustom(''); }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                selected === opt.value && !custom
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
          <label className="text-xs font-medium text-gray-500 block mb-1">O escribe un número personalizado (1–50)</label>
          <input
            type="number"
            min={1}
            max={50}
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
            placeholder="Ej: 8"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Recompensa info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <Star className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Al completar tu meta semanal recibirás <strong>50 XP bonus</strong> y <strong>3 estrellas</strong> de recompensa.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!finalGoal || finalGoal < 1 || finalGoal > 50 || saving}
          className="w-full"
        >
          {saving ? 'Guardando...' : `Comenzar con ${finalGoal ? `${finalGoal} lecciones` : '...'}`}
        </Button>
      </div>
    </div>
  );
}