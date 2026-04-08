import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookOpen, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';

export default function RecordSummaryCards({ summary }) {
  const cards = [
    {
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-50',
      label: 'Progreso general',
      value: `${summary.total_progress ?? 0}%`,
    },
    {
      icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      bg: 'bg-green-50',
      label: 'Materias completadas',
      value: `${summary.subjects_completed} / ${summary.total_subjects}`,
    },
    {
      icon: <BookOpen className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50',
      label: 'Promedio general',
      value: summary.average_grade !== null ? `${summary.average_grade}%` : '—',
    },
    {
      icon: <Calendar className="w-5 h-5 text-orange-500" />,
      bg: 'bg-orange-50',
      label: 'Última actividad',
      value: summary.last_activity
        ? format(new Date(summary.last_activity), 'dd MMM yyyy', { locale: es })
        : '—',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
              {c.icon}
            </div>
            <div>
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className="text-lg font-bold text-gray-800">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}