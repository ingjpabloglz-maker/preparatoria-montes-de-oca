import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart2, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

export default function LevelInsights({ subjects, subjectProgress }) {
  if (!subjects.length) return null;

  // Calculate per-subject stats
  const subjectStats = subjects.map(subject => {
    const sp = subjectProgress.find(p => p.subject_id === subject.id);
    return {
      name: subject.name,
      progress: sp?.progress_percent || 0,
      completed: sp?.completed || false,
      timeSpent: sp?.time_spent_minutes || 0,
      difficulty: sp?.difficulty_rating || 0,
      errors: sp?.errors_noted || [],
    };
  });

  // Sort by progress ascending (struggling subjects first)
  const struggling = [...subjectStats]
    .filter(s => !s.completed && s.progress < 70)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 3);

  // Collect all reported errors/difficulties across all subjects
  const allErrors = subjectStats.flatMap(s => s.errors);
  const errorFrequency = allErrors.reduce((acc, err) => {
    acc[err] = (acc[err] || 0) + 1;
    return acc;
  }, {});
  const topErrors = Object.entries(errorFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Avg completion
  const avgProgress = subjectStats.reduce((sum, s) => sum + s.progress, 0) / (subjectStats.length || 1);

  // Most difficult subjects (by self-rating)
  const hardSubjects = [...subjectStats]
    .filter(s => s.difficulty >= 4)
    .sort((a, b) => b.difficulty - a.difficulty);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart2 className="w-5 h-5 text-blue-500" />
          Análisis del Nivel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Average */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Avance promedio del nivel</span>
            <span className="font-semibold">{Math.round(avgProgress)}%</span>
          </div>
          <Progress value={avgProgress} className="h-2" />
        </div>

        {/* Subjects where student struggles */}
        {struggling.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-sm font-medium text-gray-700">Materias con menor avance</p>
            </div>
            <div className="space-y-2">
              {struggling.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-32 truncate">{s.name}</span>
                  <Progress value={s.progress} className="flex-1 h-2 [&>div]:bg-red-400" />
                  <span className="text-xs font-medium text-red-500 w-10 text-right">
                    {Math.round(s.progress)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* High difficulty subjects */}
        {hardSubjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-700">Materias reportadas como difíciles</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hardSubjects.map((s, i) => (
                <Badge key={i} variant="outline" className="bg-amber-50 border-amber-300 text-amber-700 text-xs">
                  {s.name} ({['','','','','Difícil','Muy difícil'][s.difficulty]})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Common errors across all subjects */}
        {topErrors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <p className="text-sm font-medium text-gray-700">Temas con dificultad más frecuentes</p>
            </div>
            <div className="space-y-2">
              {topErrors.map(([error, count], i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{error}</span>
                  <Badge variant="secondary" className="text-xs">{count}x</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {struggling.length === 0 && hardSubjects.length === 0 && topErrors.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-2">
            Aún no hay suficientes datos para mostrar análisis. Sigue estudiando para ver insights.
          </p>
        )}
      </CardContent>
    </Card>
  );
}