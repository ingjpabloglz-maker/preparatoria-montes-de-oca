import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, CheckCircle2, Clock, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LevelCard({ 
  level, 
  isUnlocked, 
  isCompleted, 
  isCurrent, 
  progress, 
  subjects,
  daysRemaining,
  onClick 
}) {
  const levelColors = {
    1: "from-blue-500 to-blue-600",
    2: "from-emerald-500 to-emerald-600",
    3: "from-purple-500 to-purple-600",
    4: "from-orange-500 to-orange-600",
    5: "from-pink-500 to-pink-600",
    6: "from-indigo-500 to-indigo-600"
  };

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300 cursor-pointer group",
        isUnlocked ? "hover:shadow-xl hover:-translate-y-1" : "opacity-60 cursor-not-allowed",
        isCurrent && "ring-2 ring-offset-2 ring-blue-500"
      )}
      onClick={() => isUnlocked && onClick?.()}
    >
      {/* Gradient Header */}
      <div className={cn(
        "h-24 bg-gradient-to-r flex items-center justify-center relative",
        levelColors[level.level_number] || levelColors[1]
      )}>
        <span className="text-white text-5xl font-bold opacity-20 absolute">
          {level.level_number}
        </span>
        <div className="text-center z-10">
          <h3 className="text-white font-bold text-xl">Nivel {level.level_number}</h3>
          {level.name && <p className="text-white/80 text-sm">{level.name}</p>}
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          {isCompleted ? (
            <Badge className="bg-green-500 text-white">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Completado
            </Badge>
          ) : !isUnlocked ? (
            <Badge variant="secondary" className="bg-white/20 text-white">
              <Lock className="w-3 h-3 mr-1" />
              Bloqueado
            </Badge>
          ) : isCurrent ? (
            <Badge className="bg-white text-gray-800">
              En curso
            </Badge>
          ) : null}
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Subjects Count */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <BookOpen className="w-4 h-4" />
            <span>{subjects?.length || 0} materias</span>
          </div>
          {isCurrent && daysRemaining !== undefined && (
            <div className="flex items-center gap-1 text-amber-600">
              <Clock className="w-4 h-4" />
              <span>{daysRemaining} días restantes</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isUnlocked && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Progreso</span>
              <span className="font-medium">{Math.round(progress || 0)}%</span>
            </div>
            <Progress value={progress || 0} className="h-2" />
          </div>
        )}

        {/* Subject Pills */}
        <div className="flex flex-wrap gap-1">
          {subjects?.slice(0, 4).map((subject, idx) => (
            <Badge 
              key={idx} 
              variant="outline" 
              className="text-xs font-normal"
            >
              {subject.name}
            </Badge>
          ))}
          {subjects?.length > 4 && (
            <Badge variant="outline" className="text-xs font-normal">
              +{subjects.length - 4} más
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}