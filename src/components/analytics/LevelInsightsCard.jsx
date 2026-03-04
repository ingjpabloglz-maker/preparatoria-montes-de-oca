import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingDown, Clock, BarChart2 } from "lucide-react";

const formatTime = (minutes) => {
  if (!minutes) return '0 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

export default function LevelInsightsCard({ subjects, subjectProgress }) {
  // Build per-subject analytics
  const subjectData = subjects.map(subject => {
    const sp = subjectProgress.find(p => p.subject_id === subject.id);
    return {
      name: subject.name,
      progress: sp?.progress_percent || 0,
      timeSpent: sp?.time_spent_minutes || 0,
      difficulty: sp?.difficulty_rating || 0,
      struggleTopics: sp?.struggle_topics || [],
      completed: sp?.completed || false,
    };
  }).filter(s => s.progress > 0 || s.timeSpent > 0);

  if (subjectData.length === 0) {
    return null;
  }

  // Subjects sorted by difficulty (desc)
  const hardestSubjects = [...subjectData]
    .filter(s => s.difficulty > 0)
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, 3);

  // Subjects sorted by progress (asc) = struggling most
  const lowestProgress = [...subjectData]
    .filter(s => !s.completed && s.progress > 0)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 3);

  // All struggle topics aggregated
  const allTopics = subjectData.flatMap(s => 
    s.struggleTopics.map(t => ({ topic: t, subject: s.name }))
  );

  // Total time
  const totalTime = subjectData.reduce((sum, s) => sum + s.timeSpent, 0);
  const avgProgress = subjectData.length > 0
    ? subjectData.reduce((sum, s) => sum + s.progress, 0) / subjectData.length
    : 0;

  const difficultyLabels = ['', 'Muy fácil', 'Fácil', 'Moderado', 'Difícil', 'Muy difícil'];
  const difficultyColors = ['', 'bg-green-100 text-green-700', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700'];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart2 className="w-5 h-5 text-indigo-500" />
          Analíticas del Nivel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-indigo-700">{formatTime(totalTime)}</p>
            <p className="text-xs text-indigo-500">Tiempo total</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <TrendingDown className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-700">{Math.round(avgProgress)}%</p>
            <p className="text-xs text-blue-500">Avance promedio</p>
          </div>
        </div>

        {/* Lowest progress subjects */}
        {lowestProgress.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <p className="text-sm font-medium text-gray-700">Materias que necesitan atención</p>
            </div>
            <div className="space-y-3">
              {lowestProgress.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{s.name}</span>
                    <span className="text-gray-500">{Math.round(s.progress)}%</span>
                  </div>
                  <Progress value={s.progress} className="h-2 [&>div]:bg-red-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hardest subjects by self-rating */}
        {hardestSubjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-700">Materias más difíciles (según tu valoración)</p>
            </div>
            <div className="space-y-2">
              {hardestSubjects.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <Badge className={`text-xs ${difficultyColors[s.difficulty]}`}>
                    {difficultyLabels[s.difficulty]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common struggle topics */}
        {allTopics.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-medium text-gray-700">Temas con más dificultad</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allTopics.map((t, i) => (
                <div key={i} className="flex flex-col items-start">
                  <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 text-xs">
                    {t.topic}
                  </Badge>
                  <span className="text-xs text-gray-400 mt-0.5 ml-1">{t.subject}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}