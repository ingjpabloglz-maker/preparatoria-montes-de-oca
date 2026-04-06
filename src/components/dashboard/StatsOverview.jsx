import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  GraduationCap, 
  BookOpen, 
  Target, 
  TrendingUp,
  Clock
} from "lucide-react";

export default function StatsOverview({ 
  currentLevel, 
  totalProgress, 
  completedSubjects, 
  totalSubjects,
  daysInLevel,
  timeLimitDays
}) {
  const remaining = totalSubjects - completedSubjects;
  const subjectMsg = remaining === 0
    ? '¡Todo completado!'
    : remaining === 1
    ? 'Te falta 1 materia'
    : `Te faltan ${remaining} materias`;

  const levelMsg = currentLevel === 1 ? 'Estás comenzando tu camino' : `Nivel ${currentLevel} en curso`;

  const progressMsg = totalProgress === 0 ? 'Vas comenzando' : totalProgress < 50 ? 'Buen inicio' : totalProgress < 90 ? '¡Vas muy bien!' : '¡Casi terminas!';

  const timeMsg = timeLimitDays - daysInLevel <= 7 ? '⚠️ Poco tiempo' : `${timeLimitDays - daysInLevel} días restantes`;

  const stats = [
    {
      label: levelMsg,
      value: `Nivel ${currentLevel}`,
      icon: GraduationCap,
      color: "bg-blue-500",
      bgColor: "bg-blue-50"
    },
    {
      label: subjectMsg,
      value: `${completedSubjects}/${totalSubjects}`,
      icon: BookOpen,
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50"
    },
    {
      label: progressMsg,
      value: `${Math.round(totalProgress)}%`,
      icon: TrendingUp,
      color: "bg-purple-500",
      bgColor: "bg-purple-50"
    },
    {
      label: timeMsg,
      value: `${daysInLevel} días`,
      icon: Clock,
      color: "bg-amber-500",
      bgColor: "bg-amber-50"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color.replace('bg-', 'text-')}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}