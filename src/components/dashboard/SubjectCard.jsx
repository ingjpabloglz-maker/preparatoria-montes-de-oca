import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, BookOpen, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const subjectIcons = {
  "Álgebra": "📐",
  "Trigonometría": "📏",
  "Geometría Analítica": "📊",
  "Precálculo": "🔢",
  "Cálculo Diferencial": "∫",
  "Cálculo Integral": "∑",
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

export default function SubjectCard({ subject, progress, isCompleted, testStatus, onClick }) {
  const getIcon = (name) => {
    for (const [key, icon] of Object.entries(subjectIcons)) {
      if (name?.toLowerCase().includes(key.toLowerCase())) {
        return icon;
      }
    }
    return subjectIcons.default;
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
        isCompleted && "bg-green-50/50 border-green-200"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
            isCompleted ? "bg-green-100" : "bg-gray-100 group-hover:bg-blue-100"
          )}>
            {getIcon(subject.name)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-gray-900 truncate">{subject.name}</h4>
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
              )}
            </div>
            
            {subject.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{subject.description}</p>
            )}

            {/* Test Status Badge */}
            {testStatus && (
              <div className="mt-2">
                {testStatus === 'aprobado' && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">✓ Prueba aprobada</Badge>
                )}
                {testStatus === 'no_aprobado' && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">✗ Prueba no aprobada</Badge>
                )}
                {testStatus === 'pendiente' && (
                  <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">· Prueba pendiente</Badge>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Avance</span>
                <span className={cn(
                  "font-medium",
                  isCompleted ? "text-green-600" : "text-gray-700"
                )}>
                  {Math.round(progress || 0)}%
                </span>
              </div>
              <Progress 
                value={progress || 0} 
                className={cn("h-1.5", isCompleted && "[&>div]:bg-green-500")}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}