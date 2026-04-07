import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const subjectIcons = {
  "Álgebra": "📐",
  "Trigonometría": "📏",
  "Geometría Analítica": "📊",
  "Geometría": "📊",
  "Precálculo": "🔢",
  "Cálculo Diferencial": "∫",
  "Cálculo Integral": "∑",
  "Cálculo": "∫",
  "Inglés": "🌐",
  "Química": "🧪",
  "Física": "⚡",
  "Biología": "🧬",
  "Historia": "📜",
  "Informática": "💻",
  "Ética": "⚖️",
  "Literatura": "📚",
  "Taller": "📖",
  "Métodos": "📖",
  "default": "📖"
};

function getIcon(name) {
  for (const [key, icon] of Object.entries(subjectIcons)) {
    if (name?.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return subjectIcons.default;
}

function getState(progress, isCompleted) {
  if (isCompleted) return 'completed';
  if (progress >= 1) return 'in_progress';
  return 'pending';
}

const stateConfig = {
  completed: {
    cardBg: 'bg-green-50 border-green-200',
    iconBg: 'bg-green-100',
    badgeClass: 'bg-green-100 text-green-700',
    badgeLabel: 'Completada',
    progressColor: 'bg-green-500',
    ctaText: 'Repasar',
    ctaClass: 'bg-green-600 hover:bg-green-700 text-white',
    bottomMsg: (name) => '¡Felicitaciones! 🎉',
    bottomSub: 'Materia completada',
    pctColor: 'text-green-700',
  },
  in_progress: {
    cardBg: 'bg-yellow-50 border-yellow-200',
    iconBg: 'bg-yellow-100',
    badgeClass: 'bg-orange-100 text-orange-700',
    badgeLabel: 'En progreso',
    progressColor: 'bg-orange-400',
    ctaText: 'Continuar',
    ctaClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    bottomMsg: (name) => 'Continúa donde te quedaste',
    bottomSub: null,
    pctColor: 'text-gray-700',
  },
  pending: {
    cardBg: 'bg-red-50 border-red-200',
    iconBg: 'bg-red-100',
    badgeClass: 'bg-red-100 text-red-700',
    badgeLabel: 'Pendiente',
    progressColor: 'bg-gray-300',
    ctaText: 'Comenzar',
    ctaClass: 'bg-red-500 hover:bg-red-600 text-white',
    bottomMsg: () => 'Empieza esta materia',
    bottomSub: null,
    pctColor: 'text-gray-500',
  },
};

export default function SubjectCard({ subject, progress, isCompleted, testStatus, onClick }) {
  const state = getState(progress, isCompleted);
  const cfg = stateConfig[state];
  const pct = Math.round(progress || 0);

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border rounded-2xl overflow-hidden",
        cfg.cardBg
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: icon + name + badge + completed check + pct */}
        <div className="flex items-start gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0", cfg.iconBg)}>
            {getIcon(subject.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 text-base leading-tight">{subject.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", cfg.badgeClass)}>
                {cfg.badgeLabel}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isCompleted && (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            <span className={cn("text-sm font-bold", cfg.pctColor)}>{pct}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/70 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", cfg.progressColor)}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Bottom info row */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-700">{cfg.bottomMsg(subject.name)}</p>
            {cfg.bottomSub && <p className="text-xs text-gray-500 mt-0.5">{cfg.bottomSub}</p>}
            {state === 'completed' && (
              <p className="text-xs text-gray-500 mt-0.5">Materia dominada</p>
            )}
            {testStatus === 'no_aprobado' && (
              <p className="text-xs text-red-600 font-medium mt-0.5">✗ Prueba no aprobada</p>
            )}
          </div>
          <Button
            size="sm"
            className={cn("font-semibold rounded-xl px-4 shrink-0", cfg.ctaClass)}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            {cfg.ctaText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}