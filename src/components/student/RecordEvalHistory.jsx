import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, ClipboardList, BookOpen } from 'lucide-react';

const TYPE_LABELS = { lesson: 'Lección', mini_eval: 'Mini Eval', final_exam: 'Examen Final', surprise_exam: 'Sorpresa' };
const PAGE_SIZE = 20;

export default function RecordEvalHistory({ history, onSelectAttempt }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(history.length / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const slice = history.slice(from, from + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-600" /> Historial de evaluaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-gray-500">
            {history.length === 0 ? 'Sin evaluaciones' : `Mostrando ${from + 1}–${Math.min(from + PAGE_SIZE, history.length)} de ${history.length}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs gap-1">
                <ChevronLeft className="w-3 h-3" /> Anterior
              </Button>
              <span className="text-xs text-gray-500">Pág. {page} de {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 text-xs gap-1">
                Siguiente <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {slice.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin evaluaciones registradas.</p>
        ) : (
          <div className="space-y-1.5">
            {slice.map(a => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onSelectAttempt(a)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[a.type] || a.type}</Badge>
                    <Badge variant="outline" className="text-xs">#{a.attempt_number}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate">
                      {[a.subject_title, a.unit_title, a.module_title, a.lesson_title].filter(Boolean).join(' › ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className={`text-base font-bold ${a.passed ? 'text-green-600' : 'text-red-500'}`}>{a.score ?? '—'}%</div>
                    <div className="text-xs text-gray-400">
                      {a.submitted_at ? format(new Date(a.submitted_at), 'dd MMM yy', { locale: es }) : '—'}
                    </div>
                  </div>
                  {a.passed === true && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {a.passed === false && <XCircle className="w-4 h-4 text-red-500" />}
                  {a.passed === null && <Clock className="w-4 h-4 text-yellow-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}