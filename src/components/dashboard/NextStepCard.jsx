import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, PlayCircle } from "lucide-react";

const subjectIcons = {
  "Álgebra": "📐", "Trigonometría": "📏", "Geometría": "📊",
  "Precálculo": "🔢", "Cálculo": "∫", "Inglés": "🌐",
  "Química": "🧪", "Física": "⚡", "Biología": "🧬",
  "Historia": "📜", "Informática": "💻", "Ética": "⚖️",
  "Literatura": "📚", "default": "📖"
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

  return (
    <Card className="border-0 shadow-md border-l-4 border-l-blue-500 bg-blue-50/50">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
          {getIcon(nextSubject.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Siguiente paso</p>
            <Badge className={isInProgress ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}>
              {isInProgress ? '🟡 En progreso' : '🔴 Pendiente'}
            </Badge>
          </div>
          <p className="font-bold text-gray-900 text-lg leading-tight mt-0.5">{nextSubject.name}</p>
          <p className="text-sm text-gray-500">
            {isInProgress
              ? `Continúa donde te quedaste · ${nextSubject.progress}% completado`
              : 'Empieza esta materia'}
          </p>
        </div>
        <Button
          className="shrink-0 bg-blue-600 hover:bg-blue-700 gap-2"
          onClick={onGo}
        >
          <PlayCircle className="w-4 h-4" />
          {isInProgress ? 'Continuar' : 'Empezar'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}