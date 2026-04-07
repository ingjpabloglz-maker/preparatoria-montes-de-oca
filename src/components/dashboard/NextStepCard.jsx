import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

const subjectIcons = {
  "Álgebra": "📐", "Trigonometría": "📏", "Geometría": "📊",
  "Precálculo": "🔢", "Cálculo": "∫", "Inglés": "🌐",
  "Química": "🧪", "Física": "⚡", "Biología": "🧬",
  "Historia": "📜", "Informática": "💻", "Ética": "⚖️",
  "Literatura": "📚", "Taller": "📖", "Métodos": "📖",
  "default": "📖"
};

function getIcon(name) {
  for (const [key, icon] of Object.entries(subjectIcons)) {
    if (name?.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return subjectIcons.default;
}

export default function NextStepCard({ nextSubject, onGo }) {
  if (!nextSubject) return null;

  const isInProgress = nextSubject.progress > 0 && nextSubject.progress < 100;
  const pct = Math.round(nextSubject.progress || 0);

  return (
    <Card className="border border-gray-200 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-lg">✅</span>
            <span className="font-bold text-gray-800 text-base">Siguiente paso</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>

        {/* Content row */}
        <div className="flex items-center gap-4 px-5 pb-4">
          {/* Icon */}
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-purple-100 shrink-0">
            {getIcon(nextSubject.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight">{nextSubject.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {isInProgress ? `Lección en progreso` : 'Lección pendiente'}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <Badge className={isInProgress ? "bg-blue-100 text-blue-700 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                {isInProgress ? 'En progreso' : 'Pendiente'}
              </Badge>
              <span className="text-xs text-gray-500">Avance: {pct}%</span>
              {isInProgress && (
                <span className="text-xs text-gray-400">
                  💡 Estás a poco de completar esta materia
                </span>
              )}
            </div>
          </div>

          {/* CTA */}
          <Button
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-5"
            onClick={onGo}
          >
            {isInProgress ? 'Continuar lección' : 'Empezar lección'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}