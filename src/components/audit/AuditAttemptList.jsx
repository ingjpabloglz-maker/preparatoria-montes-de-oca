import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react';

const TYPE_LABELS = {
  lesson: 'Lección',
  mini_eval: 'Mini Eval',
  final_exam: 'Examen Final',
  surprise_exam: 'Sorpresa',
};

function PassedBadge({ passed, requires_manual_review }) {
  if (requires_manual_review) return (
    <Badge className="bg-yellow-100 text-yellow-700 gap-1">
      <Clock className="w-3 h-3" /> Pendiente revisión
    </Badge>
  );
  if (passed === true) return (
    <Badge className="bg-green-100 text-green-700 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Aprobado
    </Badge>
  );
  if (passed === false) return (
    <Badge className="bg-red-100 text-red-700 gap-1">
      <XCircle className="w-3 h-3" /> No aprobado
    </Badge>
  );
  return <Badge variant="outline">Sin calificar</Badge>;
}

export default function AuditAttemptList({ attempts, loading, onSelect }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mr-2" />
        Cargando intentos...
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No se encontraron intentos con los filtros aplicados.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-3">{attempts.length} intento(s) encontrado(s)</p>
      {attempts.map(attempt => (
        <Card
          key={attempt.id}
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
          style={{ borderLeftColor: attempt.requires_manual_review ? '#f59e0b' : attempt.passed ? '#22c55e' : '#ef4444' }}
          onClick={() => onSelect(attempt)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 truncate">{attempt.user_email}</span>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[attempt.type] || attempt.type}</Badge>
                  <Badge variant="outline" className="text-xs">Intento #{attempt.attempt_number}</Badge>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {attempt.submitted_at
                    ? format(new Date(attempt.submitted_at), "dd MMM yyyy HH:mm", { locale: es })
                    : '—'}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">{attempt.score ?? '—'}%</div>
                  <div className="text-xs text-gray-400">{(attempt.answers || []).length} preguntas</div>
                </div>
                <PassedBadge passed={attempt.passed} requires_manual_review={attempt.requires_manual_review} />
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}