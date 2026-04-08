import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Clock, Users, TrendingUp, AlertTriangle } from 'lucide-react';

export default function AuditKPIs({ attempts }) {
  const total = attempts.length;
  const passed = attempts.filter(a => a.passed === true).length;
  const failed = attempts.filter(a => a.passed === false).length;
  const pending = attempts.filter(a => a.requires_manual_review).length;
  const atRisk = attempts.filter(a => a.requires_reinforcement).length;
  const uniqueStudents = new Set(attempts.map(a => a.user_email)).size;
  const approvalRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const scores = attempts.filter(a => a.score !== null && a.score !== undefined).map(a => a.score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const kpis = [
    { label: 'Total intentos', value: total, icon: <Users className="w-5 h-5 text-indigo-500" />, bg: 'bg-indigo-50' },
    { label: 'Promedio general', value: `${avgScore}%`, icon: <TrendingUp className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
    { label: '% Aprobación', value: `${approvalRate}%`, icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, bg: 'bg-green-50' },
    { label: 'Reprobados', value: failed, icon: <XCircle className="w-5 h-5 text-red-500" />, bg: 'bg-red-50' },
    { label: 'Revisión pendiente', value: pending, icon: <Clock className="w-5 h-5 text-yellow-500" />, bg: 'bg-yellow-50' },
    { label: 'Alumnos en riesgo', value: atRisk, icon: <AlertTriangle className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50' },
    { label: 'Alumnos únicos', value: uniqueStudents, icon: <Users className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {kpis.map(k => (
        <Card key={k.label}>
          <CardContent className={`p-3 flex flex-col items-center text-center gap-1 ${k.bg} rounded-xl`}>
            {k.icon}
            <p className="text-xl font-bold text-gray-800">{k.value}</p>
            <p className="text-xs text-gray-500 leading-tight">{k.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}