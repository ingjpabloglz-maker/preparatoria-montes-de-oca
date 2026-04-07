import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ArrowRight, PlayCircle } from "lucide-react";
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
  "default": "📖"
};

function getIcon(name) {
  for (const [key, icon] of Object.entries(subjectIcons)) {
    if (name?.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return subjectIcons.default;
}

function getProgressState(progress, isCompleted) {
  if (isCompleted) return 'completed';
  if (progress >= 1) return 'in_progress';
  return 'pending';
}

const stateConfig = {
  completed: {
    border: 'border-green-300 bg-green-50/60',
    iconBg: 'bg-green-100',
    progressColor: '#22c55e',
    label: '🟢 Materia completada',
    labelClass: 'text-green-700',
    ctaText: 'Ver detalle',
    ctaClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  in_progress: {
    border: 'border-yellow-300 bg-yellow-50/40',
    iconBg: 'bg-yellow-100',
    progressColor: '#f59e0b',
    label: '🟡 Continúa donde te quedaste',
    labelClass: 'text-yellow-700',
    ctaText: 'Continuar',
    ctaClass: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  pending: {
    border: 'border-gray-200 bg-white',
    iconBg: 'bg-gray-100 group-hover:bg-blue-100',
    progressColor: '#ef4444',
    label: '🔴 Empieza esta materia',
    labelClass: 'text-gray-500',
    ctaText: 'Empezar',
    ctaClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

// Paleta de colores por índice (fondo claro + borde oscuro del mismo tono)
const COLOR_PALETTE = [
  { bg: 'bg-blue-50',    border: 'border-blue-400',   iconBg: 'bg-blue-100',   progressColor: '#3b82f6' },
  { bg: 'bg-purple-50',  border: 'border-purple-400', iconBg: 'bg-purple-100', progressColor: '#a855f7' },
  { bg: 'bg-rose-50',    border: 'border-rose-400',   iconBg: 'bg-rose-100',   progressColor: '#f43f5e' },
  { bg: 'bg-amber-50',   border: 'border-amber-400',  iconBg: 'bg-amber-100',  progressColor: '#f59e0b' },
  { bg: 'bg-teal-50',    border: 'border-teal-400',   iconBg: 'bg-teal-100',   progressColor: '#14b8a6' },
  { bg: 'bg-orange-50',  border: 'border-orange-400', iconBg: 'bg-orange-100', progressColor: '#f97316' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-400', iconBg: 'bg-indigo-100', progressColor: '#6366f1' },
  { bg: 'bg-cyan-50',    border: 'border-cyan-400',   iconBg: 'bg-cyan-100',   progressColor: '#06b6d4' },
];

export default function SubjectCard({ subject, progress, isCompleted, testStatus, onClick, index = 0 }) {
  const state = getProgressState(progress, isCompleted);
  const cfg = stateConfig[state];
  const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

  const progressMsg = () => {
    if (isCompleted) return 'Materia completada ✓';
    const rounded = Math.round(progress || 0);
    if (rounded === 0) return 'Vas comenzando';
    if (rounded < 30) return `Vas comenzando · ${rounded}%`;
    if (rounded < 70) return `Buen ritmo · ${rounded}%`;
    if (rounded < 100) return `¡Casi completas esta materia! · ${rounded}%`;
    return `${rounded}%`;
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-2",
        color.bg, color.border
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-colors", color.iconBg)}>
            {getIcon(subject.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 truncate text-base">{subject.name}</h4>
            <p className={cn("text-xs font-medium mt-0.5", cfg.labelClass)}>{cfg.label}</p>
          </div>
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          ) : (
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress
            value={progress || 0}
            className="h-3 rounded-full"
            indicatorStyle={{ backgroundColor: cfg.progressColor }}
          />
          <p className="text-xs text-gray-500">{progressMsg()}</p>
        </div>

        {/* Test badge */}
        {testStatus === 'aprobado' && (
          <p className="text-xs text-green-700 bg-green-100 rounded-lg px-3 py-1 inline-block font-medium">
            ✓ Prueba aprobada
          </p>
        )}
        {testStatus === 'no_aprobado' && (
          <p className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-1 inline-block font-medium">
            ✗ Prueba no aprobada — Intenta de nuevo
          </p>
        )}

        {/* CTA */}
        <Button
          size="sm"
          className={cn("w-full font-semibold gap-1.5", cfg.ctaClass)}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <PlayCircle className="w-4 h-4" />
          {cfg.ctaText}
        </Button>
      </CardContent>
    </Card>
  );
}