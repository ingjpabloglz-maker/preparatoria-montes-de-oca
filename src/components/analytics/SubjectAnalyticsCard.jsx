import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Clock, TrendingUp, AlertTriangle, Star, Plus, X
} from "lucide-react";

const formatTime = (minutes) => {
  if (!minutes) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

export default function SubjectAnalyticsCard({ progressData, onUpdate }) {
  const [newTopic, setNewTopic] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);

  const timeSpent = progressData?.time_spent_minutes || 0;
  const sessionsCount = progressData?.sessions_count || 0;
  const difficultyRating = progressData?.difficulty_rating || 0;
  const struggleTopics = progressData?.struggle_topics || [];

  const difficultyLabels = ['', 'Muy fácil', 'Fácil', 'Moderado', 'Difícil', 'Muy difícil'];
  const difficultyColors = ['', 'text-green-600', 'text-green-500', 'text-yellow-500', 'text-orange-500', 'text-red-600'];

  const handleAddTopic = () => {
    if (!newTopic.trim()) return;
    const updated = [...struggleTopics, newTopic.trim()];
    onUpdate({ struggle_topics: updated });
    setNewTopic('');
    setAddingTopic(false);
  };

  const handleRemoveTopic = (index) => {
    const updated = struggleTopics.filter((_, i) => i !== index);
    onUpdate({ struggle_topics: updated });
  };

  const handleDifficulty = (rating) => {
    onUpdate({ difficulty_rating: rating });
  };

  const handleAddTime = (minutes) => {
    const current = timeSpent + minutes;
    const sessions = sessionsCount + 1;
    onUpdate({ time_spent_minutes: current, sessions_count: sessions });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Analíticas de Estudio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-700">{formatTime(timeSpent)}</p>
            <p className="text-xs text-blue-500 mt-1">Tiempo invertido</p>
            <div className="flex justify-center gap-1 mt-2 flex-wrap">
              {[15, 30, 60].map(m => (
                <button
                  key={m}
                  onClick={() => handleAddTime(m)}
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded px-2 py-0.5 transition-colors"
                >
                  +{m}min
                </button>
              ))}
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <Star className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-purple-700">{sessionsCount}</p>
            <p className="text-xs text-purple-500 mt-1">Sesiones de estudio</p>
          </div>
        </div>

        {/* Difficulty Rating */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">¿Qué tan difícil te pareció?</p>
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4,5].map(i => (
              <button
                key={i}
                onClick={() => handleDifficulty(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  difficultyRating === i 
                    ? 'bg-orange-400 text-white border-orange-400' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                }`}
              >
                {difficultyLabels[i]}
              </button>
            ))}
          </div>
          {difficultyRating > 0 && (
            <p className={`text-xs mt-1 ${difficultyColors[difficultyRating]}`}>
              Calificaste esta materia como: {difficultyLabels[difficultyRating]}
            </p>
          )}
        </div>

        {/* Struggle Topics */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-600">Temas con dificultad</p>
            </div>
            <button
              onClick={() => setAddingTopic(!addingTopic)}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar
            </button>
          </div>

          {addingTopic && (
            <div className="flex gap-2 mb-2">
              <Input
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
                placeholder="Ej: Derivadas parciales..."
                className="text-sm h-8"
              />
              <Button size="sm" onClick={handleAddTopic} className="h-8 px-3">OK</Button>
            </div>
          )}

          {struggleTopics.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin temas registrados</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {struggleTopics.map((topic, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-amber-700 border-amber-300 bg-amber-50 text-xs flex items-center gap-1"
                >
                  {topic}
                  <button onClick={() => handleRemoveTopic(i)}>
                    <X className="w-3 h-3 ml-1 hover:text-red-500" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}