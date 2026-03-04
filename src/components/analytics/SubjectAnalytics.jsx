import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SubjectAnalytics({ progressData }) {
  if (!progressData) return null;

  const timeSpent = progressData.time_spent_minutes || 0;
  const sessions = progressData.sessions || [];
  const errorsNoted = progressData.errors_noted || [];
  const difficultyRating = progressData.difficulty_rating || 0;

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const lastSession = sessions[sessions.length - 1];

  const difficultyLabel = ['', 'Muy fácil', 'Fácil', 'Moderado', 'Difícil', 'Muy difícil'][difficultyRating] || '—';
  const difficultyColor = [
    '', 'text-green-600', 'text-green-500', 'text-yellow-500', 'text-orange-500', 'text-red-600'
  ][difficultyRating] || 'text-gray-400';

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Analíticas de Estudio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-700">{formatTime(timeSpent)}</p>
            <p className="text-xs text-blue-500 mt-1">Tiempo invertido</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <Calendar className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-purple-700">{sessions.length}</p>
            <p className="text-xs text-purple-500 mt-1">Sesiones de estudio</p>
          </div>
        </div>

        {/* Difficulty */}
        {difficultyRating > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Dificultad percibida</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <div
                    key={i}
                    className={`w-6 h-2 rounded-full ${i <= difficultyRating ? 'bg-orange-400' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
              <span className={`text-sm font-medium ${difficultyColor}`}>{difficultyLabel}</span>
            </div>
          </div>
        )}

        {/* Last activity */}
        {progressData.last_activity && (
          <p className="text-xs text-gray-400">
            Última actividad: {formatDistanceToNow(new Date(progressData.last_activity), { addSuffix: true, locale: es })}
          </p>
        )}

        {/* Common errors / struggles */}
        {errorsNoted.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-700">Temas con dificultad</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {errorsNoted.map((error, i) => (
                <Badge key={i} variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                  {error}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}