import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, AlertCircle, AlertTriangle, ChevronRight, BookOpen, ChevronLeft, FileText } from 'lucide-react';

const TYPE_LABELS = {
  lesson: 'Lección',
  mini_eval: 'Mini Eval',
  final_exam: 'Examen Final',
  surprise_exam: 'Sorpresa',
};

function borderColor(attempt) {
  if (attempt.requires_manual_review) return '#f59e0b';
  if (attempt.requires_reinforcement) return '#f97316';
  if (attempt.passed === true) return '#22c55e';
  if (attempt.passed === false) return '#ef4444';
  return '#d1d5db';
}

export default function AuditAttemptList({ attempts, loading, onSelect, currentPage, totalPages, totalCount, onPageChange }) {
  const from = totalCount === 0 ? 0 : (currentPage - 1) * 20 + 1;
  const to = Math.min(currentPage * 20, totalCount);
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
      {/* Contador y paginación superior */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          {totalCount === 0
            ? 'Sin resultados'
            : `Mostrando ${from}–${to} de ${totalCount} intento(s)`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline"
              disabled={currentPage <= 1 || loading}
              onClick={() => onPageChange(currentPage - 1)}
              className="gap-1 h-7 text-xs"
            >
              <ChevronLeft className="w-3 h-3" /> Anterior
            </Button>
            <span className="text-xs text-gray-600 px-1">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              size="sm" variant="outline"
              disabled={currentPage >= totalPages || loading}
              onClick={() => onPageChange(currentPage + 1)}
              className="gap-1 h-7 text-xs"
            >
              Siguiente <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {attempts.map(attempt => (
        <Card
          key={attempt.id}
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
          style={{ borderLeftColor: borderColor(attempt) }}
          onClick={() => onSelect(attempt)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                {/* Nombre del alumno */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm text-gray-800 truncate">
                    {attempt.full_name || attempt.user_email}
                  </span>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[attempt.type] || attempt.type}</Badge>
                  <Badge variant="outline" className="text-xs">Intento #{attempt.attempt_number}</Badge>
                </div>

                {/* Contexto académico */}
                <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-1.5">
                  <BookOpen className="w-3 h-3 mt-0.5 shrink-0 text-indigo-400" />
                  <span className="truncate">
                    {[attempt.subject_title, attempt.unit_title, attempt.module_title, attempt.lesson_title]
                      .filter(Boolean)
                      .join(' › ')}
                  </span>
                </div>

                {/* Badges de estado */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {attempt.requires_manual_review && (
                    <Badge className="bg-yellow-100 text-yellow-700 gap-1 text-xs">
                      <Clock className="w-3 h-3" /> Revisión pendiente
                    </Badge>
                  )}
                  {attempt.requires_reinforcement && (
                    <Badge className="bg-orange-100 text-orange-700 gap-1 text-xs">
                      <AlertTriangle className="w-3 h-3" /> Refuerzo requerido
                    </Badge>
                  )}
                  {attempt.passed === true && !attempt.requires_manual_review && (
                    <Badge className="bg-green-100 text-green-700 gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3" /> Aprobado
                    </Badge>
                  )}
                  {attempt.passed === false && !attempt.requires_manual_review && (
                    <Badge className="bg-red-100 text-red-700 gap-1 text-xs">
                      <XCircle className="w-3 h-3" /> No aprobado
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-1">
                  {attempt.submitted_at
                    ? format(new Date(attempt.submitted_at), "dd MMM yyyy HH:mm", { locale: es })
                    : '—'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">{attempt.score ?? '—'}%</div>
                  <div className="text-xs text-gray-400">{(attempt.answers || []).length} pregs.</div>
                </div>
                <Link
                  to={`/StudentRecord/${encodeURIComponent(attempt.user_email)}`}
                  onClick={e => e.stopPropagation()}
                  className="p-1.5 rounded hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors"
                  title="Ver expediente completo"
                >
                  <FileText className="w-4 h-4" />
                </Link>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Paginación inferior */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t">
          <Button
            size="sm" variant="outline"
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
            className="gap-1 h-7 text-xs"
          >
            <ChevronLeft className="w-3 h-3" /> Anterior
          </Button>
          <span className="text-xs text-gray-600 px-2">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            size="sm" variant="outline"
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
            className="gap-1 h-7 text-xs"
          >
            Siguiente <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}