import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format, differenceInSeconds } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle, User, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuditAttemptDetail({ attempt, onBack, onReview, userRole }) {
  const [reviewScore, setReviewScore] = useState(attempt.score ?? 0);
  const [reviewPassed, setReviewPassed] = useState(attempt.passed ?? false);
  const [reviewFeedback, setReviewFeedback] = useState(attempt.feedback || '');
  const [submitting, setSubmitting] = useState(false);

  const duration = attempt.started_at && attempt.submitted_at
    ? differenceInSeconds(new Date(attempt.submitted_at), new Date(attempt.started_at))
    : null;

  const canReview = (userRole === 'admin' || userRole === 'teacher') &&
    (attempt.requires_manual_review || attempt.passed === null);

  async function handleSubmitReview() {
    setSubmitting(true);
    await onReview({
      attempt_id: attempt.id,
      score: Number(reviewScore),
      passed: reviewPassed,
      feedback: reviewFeedback,
    });
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Volver al listado
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Alumno</p>
              <p className="font-medium text-gray-800 break-all">{attempt.user_email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Tipo</p>
              <Badge variant="outline">{attempt.type}</Badge>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Intento</p>
              <p className="font-bold text-gray-800">#{attempt.attempt_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Score</p>
              <p className={cn("text-2xl font-bold", attempt.passed ? 'text-green-600' : 'text-red-500')}>
                {attempt.score ?? '—'}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Enviado</p>
              <p className="text-gray-700">
                {attempt.submitted_at
                  ? format(new Date(attempt.submitted_at), "dd MMM yyyy HH:mm", { locale: es })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Duración</p>
              <p className="text-gray-700">
                {duration !== null ? `${Math.floor(duration / 60)}m ${duration % 60}s` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Estado</p>
              {attempt.requires_manual_review
                ? <Badge className="bg-yellow-100 text-yellow-700 gap-1"><Clock className="w-3 h-3" /> Revisión pendiente</Badge>
                : attempt.passed
                  ? <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle2 className="w-3 h-3" /> Aprobado</Badge>
                  : <Badge className="bg-red-100 text-red-700 gap-1"><XCircle className="w-3 h-3" /> No aprobado</Badge>
              }
            </div>
            {attempt.reviewed_by && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Revisado por</p>
                <p className="text-gray-700 text-xs">{attempt.reviewed_by}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Answers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Respuestas del alumno</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(attempt.answers || []).length === 0 && (
            <p className="text-sm text-gray-400">No hay respuestas registradas.</p>
          )}
          {(attempt.answers || []).map((ans, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg p-3 border text-sm",
                ans.correct === true && "bg-green-50 border-green-200",
                ans.correct === false && "bg-red-50 border-red-200",
                ans.correct === null && "bg-yellow-50 border-yellow-200",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Pregunta ID: <code className="text-gray-600">{ans.question_id}</code></p>
                  <p className="font-medium text-gray-800">
                    Respuesta: <span className="text-gray-600">{ans.user_answer || <em>Sin respuesta</em>}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ans.correct === true && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {ans.correct === false && <XCircle className="w-4 h-4 text-red-500" />}
                  {ans.correct === null && <Clock className="w-4 h-4 text-yellow-500" />}
                  <span className="text-xs text-gray-500">{ans.points_obtained ?? 0} pts</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Revisión manual */}
      {canReview && (
        <Card className="border-indigo-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-600" />
              Revisión docente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Score final (0-100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={reviewScore}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setReviewScore(v);
                    setReviewPassed(v >= 80);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">¿Aprobado?</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant={reviewPassed ? 'default' : 'outline'}
                    onClick={() => setReviewPassed(true)}
                    className="flex-1"
                  >Sí</Button>
                  <Button
                    size="sm"
                    variant={!reviewPassed ? 'destructive' : 'outline'}
                    onClick={() => setReviewPassed(false)}
                    className="flex-1"
                  >No</Button>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comentarios (opcional)</Label>
              <Textarea
                placeholder="Retroalimentación para el alumno..."
                value={reviewFeedback}
                onChange={e => setReviewFeedback(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleSubmitReview}
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? 'Guardando...' : 'Guardar revisión'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Feedback ya guardado */}
      {attempt.feedback && !canReview && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Retroalimentación del docente</p>
            <p className="text-sm text-gray-700">{attempt.feedback}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}