import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_LABELS = { lesson: 'Lección', mini_eval: 'Mini Eval', final_exam: 'Examen Final', surprise_exam: 'Sorpresa' };

function AttemptRow({ attempt, onClick }) {
  return (
    <tr
      className="border-b text-xs hover:bg-gray-50 cursor-pointer"
      onClick={() => onClick(attempt)}
    >
      <td className="py-1.5 pr-2 text-gray-500">{TYPE_LABELS[attempt.type] || attempt.type}</td>
      <td className="py-1.5 pr-2 text-gray-500">{attempt.lesson_title || '—'}</td>
      <td className="py-1.5 pr-2 text-center font-medium">
        <span className={attempt.passed ? 'text-green-600' : 'text-red-500'}>{attempt.score ?? '—'}%</span>
      </td>
      <td className="py-1.5 pr-2 text-center">
        {attempt.passed === true && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />}
        {attempt.passed === false && <XCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />}
      </td>
      <td className="py-1.5 text-gray-400">
        {attempt.submitted_at ? format(new Date(attempt.submitted_at), 'dd MMM yy', { locale: es }) : '—'}
      </td>
    </tr>
  );
}

function SubjectRow({ subject, onSelectAttempt }) {
  const [expanded, setExpanded] = useState(false);

  const statusBadge = subject.completed
    ? <Badge className="bg-green-100 text-green-700 text-xs">Completada</Badge>
    : subject.requires_reinforcement
      ? <Badge className="bg-orange-100 text-orange-700 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Refuerzo</Badge>
      : <Badge variant="outline" className="text-xs">En progreso</Badge>;

  return (
    <>
      <tr
        className="border-b cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            <span className="font-medium text-gray-800 text-sm">{subject.subject_title}</span>
          </div>
        </td>
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2 min-w-[100px]">
            <Progress value={subject.progress} className="h-1.5 flex-1" />
            <span className="text-xs text-gray-500 w-8">{subject.progress}%</span>
          </div>
        </td>
        <td className="py-3 pr-3 text-center">
          <span className={cn("font-bold text-sm", subject.final_grade >= 80 ? 'text-green-600' : subject.final_grade !== null ? 'text-red-500' : 'text-gray-400')}>
            {subject.final_grade !== null ? `${subject.final_grade}%` : '—'}
          </span>
        </td>
        <td className="py-3 pr-3">{statusBadge}</td>
        <td className="py-3 text-xs text-gray-400">
          {subject.last_activity ? format(new Date(subject.last_activity), 'dd MMM yyyy', { locale: es }) : '—'}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} className="bg-gray-50 px-6 pb-4 pt-2">
            {subject.modules.length === 0 ? (
              <p className="text-xs text-gray-400">Sin módulos registrados.</p>
            ) : (
              subject.modules.map(mod => (
                <div key={mod.module_id} className="mb-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    {mod.unit_title && <span className="text-gray-400">{mod.unit_title} ›</span>}
                    {mod.module_title}
                  </div>
                  {mod.lessons.map(les => (
                    <div key={les.lesson_id} className="ml-4 mb-3">
                      <p className="text-xs text-gray-600 font-medium mb-1">
                        {les.lesson_title}
                        {les.is_mini_eval && <Badge className="ml-2 text-xs bg-purple-100 text-purple-700">Mini Eval</Badge>}
                      </p>
                      {les.attempts.length > 0 && (
                        <table className="w-full">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b">
                              <th className="text-left py-1 pr-2 font-medium">Tipo</th>
                              <th className="text-left py-1 pr-2 font-medium">Lección</th>
                              <th className="text-center py-1 pr-2 font-medium">Score</th>
                              <th className="text-center py-1 pr-2 font-medium">Estado</th>
                              <th className="text-left py-1 font-medium">Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {les.attempts.map(a => (
                              <AttemptRow key={a.id} attempt={a} onClick={onSelectAttempt} />
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function RecordSubjectTable({ subjects, onSelectAttempt }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" /> Materias cursadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subjects.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin materias registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Materia</th>
                  <th className="text-left py-2 pr-3 font-medium">Avance</th>
                  <th className="text-center py-2 pr-3 font-medium">Calificación</th>
                  <th className="text-left py-2 pr-3 font-medium">Estado</th>
                  <th className="text-left py-2 font-medium">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(s => (
                  <SubjectRow key={s.subject_id} subject={s} onSelectAttempt={onSelectAttempt} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}