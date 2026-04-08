import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format, differenceInSeconds } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, CheckCircle2, XCircle, Clock, User, ClipboardCheck, Download, AlertTriangle, BookOpen, History, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { hasPermission } from '@/lib/permissions';

const MIN_REVIEW_SECONDS = 45;

const TYPE_LABELS = {
  lesson: 'Lección',
  mini_eval: 'Mini Evaluación',
  final_exam: 'Examen Final',
  surprise_exam: 'Examen Sorpresa',
};

export default function AuditAttemptDetail({ attempt, onBack, onReview, userRole }) {
  const [reviewScore, setReviewScore] = useState(attempt.score ?? 0);
  const [reviewPassed, setReviewPassed] = useState(attempt.passed ?? false);
  const [reviewFeedback, setReviewFeedback] = useState(attempt.feedback || '');
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState({});
  const [exporting, setExporting] = useState(false);
  const [reviewStartedAt, setReviewStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lockError, setLockError] = useState(null);
  const timerRef = useRef(null);

  const duration = attempt.started_at && attempt.submitted_at
    ? differenceInSeconds(new Date(attempt.submitted_at), new Date(attempt.started_at))
    : null;

  const canReview = hasPermission({ role: userRole }, 'exam.review') &&
    (attempt.requires_manual_review || attempt.passed === null || attempt.passed === undefined);

  const reviewReady = elapsedSeconds >= MIN_REVIEW_SECONDS;
  const remainingSeconds = Math.max(0, MIN_REVIEW_SECONDS - elapsedSeconds);

  const studentName = attempt.full_name || attempt.user_email;

  // Academic breadcrumb: Materia › Unidad › Módulo › Lección
  const academicPath = [
    attempt.subject_title,
    attempt.unit_title,
    attempt.module_title,
    attempt.lesson_title,
  ].filter(Boolean);

  // Load question text for each answer
  useEffect(() => {
    const ids = [...new Set((attempt.answers || []).map(a => a.question_id).filter(Boolean))];
    if (ids.length === 0) return;
    Promise.all(ids.map(id =>
      base44.entities.CourseActivity.filter({ id }).then(r => r[0]).catch(() => null)
    )).then(results => {
      const map = {};
      results.forEach(q => { if (q) map[q.id] = q; });
      setQuestions(map);
    });
  }, [attempt.id]);

  // Iniciar lock y timer cuando el panel de revisión se monta
  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    base44.functions.invoke('lockReviewAttempt', { attempt_id: attempt.id })
      .then(res => {
        if (cancelled) return;
        const startedAt = res.data?.review_started_at || new Date().toISOString();
        setReviewStartedAt(startedAt);
        timerRef.current = setInterval(() => {
          setElapsedSeconds(Math.round((Date.now() - new Date(startedAt)) / 1000));
        }, 1000);
      })
      .catch(err => {
        if (cancelled) return;
        setLockError(err?.response?.data?.message || 'Este intento ya está siendo revisado por otro docente.');
      });
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attempt.id, canReview]);

  async function handleSubmitReview() {
    setSubmitting(true);
    await onReview({
      attempt_id: attempt.id,
      score: Number(reviewScore),
      passed: reviewPassed,
      feedback: reviewFeedback,
      review_started_at: reviewStartedAt,
    });
    setSubmitting(false);
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(16);
      doc.text('Evidencia de Evaluación — Auditoría SEP', 14, y); y += 10;

      doc.setFontSize(10);
      doc.text(`Alumno: ${studentName}`, 14, y); y += 6;
      if (academicPath.length > 0) {
        doc.text(`Materia: ${attempt.subject_title || '—'}`, 14, y); y += 6;
        if (attempt.unit_title) { doc.text(`Unidad: ${attempt.unit_title}`, 14, y); y += 6; }
        if (attempt.module_title) { doc.text(`Módulo: ${attempt.module_title}`, 14, y); y += 6; }
        if (attempt.lesson_title) { doc.text(`Lección: ${attempt.lesson_title}`, 14, y); y += 6; }
      }
      doc.text(`Tipo: ${TYPE_LABELS[attempt.type] || attempt.type}`, 14, y); y += 6;
      doc.text(`Intento #: ${attempt.attempt_number}`, 14, y); y += 6;
      doc.text(`Score: ${attempt.score ?? '—'}%`, 14, y); y += 6;
      doc.text(`Aprobado: ${attempt.passed ? 'Sí' : 'No'}`, 14, y); y += 6;
      doc.text(`Inicio: ${attempt.started_at ? format(new Date(attempt.started_at), "dd MMM yyyy HH:mm", { locale: es }) : '—'}`, 14, y); y += 6;
      doc.text(`Envío: ${attempt.submitted_at ? format(new Date(attempt.submitted_at), "dd MMM yyyy HH:mm", { locale: es }) : '—'}`, 14, y); y += 6;
      if (duration !== null) { doc.text(`Duración: ${Math.floor(duration / 60)}m ${duration % 60}s`, 14, y); y += 6; }
      if (attempt.reviewed_by) { doc.text(`Revisado por: ${attempt.reviewed_by}`, 14, y); y += 6; }
      if (attempt.feedback) { doc.text(`Retroalimentación: ${attempt.feedback}`, 14, y); y += 8; }

      y += 4;
      doc.setFontSize(12);
      doc.text('Respuestas del alumno', 14, y); y += 8;
      doc.setFontSize(9);

      (attempt.answers || []).forEach((ans, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const q = questions[ans.question_id];
        const qText = q ? `P${idx + 1}: ${q.question}` : `P${idx + 1}`;
        const lines = doc.splitTextToSize(qText, 180);
        doc.text(lines, 14, y); y += lines.length * 5;
        doc.text(`  Respuesta: ${ans.user_answer || '—'}  |  Correcta: ${q?.correct_answer || '—'}  |  ${ans.correct ? '✓' : '✗'} ${ans.points_obtained ?? 0} pts`, 14, y); y += 7;
      });

      const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`auditoria_${safeName}_${attempt.id?.slice(0, 8)}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver al listado
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-2">
          <Download className="w-4 h-4" />
          {exporting ? 'Exportando...' : 'Exportar PDF'}
        </Button>
      </div>

      {/* Sección 1: Información general */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" /> Información general
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alumno */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Alumno</p>
            <p className="font-semibold text-gray-900 text-base">{studentName}</p>
            <p className="text-xs text-gray-400">{attempt.user_email}</p>
          </div>

          {/* Contexto académico */}
          {academicPath.length > 0 && (
            <div className="bg-indigo-50 rounded-lg p-3 space-y-1.5 border border-indigo-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-2">
                <BookOpen className="w-3.5 h-3.5" /> Contexto académico
              </div>
              {attempt.subject_title && (
                <div className="flex gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0 text-xs">Materia</span>
                  <span className="font-medium text-gray-800">{attempt.subject_title}</span>
                </div>
              )}
              {attempt.unit_title && (
                <div className="flex gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0 text-xs">Unidad</span>
                  <span className="text-gray-700">{attempt.unit_title}</span>
                </div>
              )}
              {attempt.module_title && (
                <div className="flex gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0 text-xs">Módulo</span>
                  <span className="text-gray-700">{attempt.module_title}</span>
                </div>
              )}
              {attempt.lesson_title && (
                <div className="flex gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0 text-xs">Lección</span>
                  <span className="text-gray-700">{attempt.lesson_title}</span>
                </div>
              )}
            </div>
          )}

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Tipo</p>
              <Badge variant="outline">{TYPE_LABELS[attempt.type] || attempt.type}</Badge>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Intento #</p>
              <p className="font-bold text-gray-800">#{attempt.attempt_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Score</p>
              <p className={cn("text-2xl font-bold", attempt.passed ? 'text-green-600' : 'text-red-500')}>
                {attempt.score ?? '—'}%
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
            {attempt.requires_reinforcement && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Riesgo</p>
                <Badge className="bg-orange-100 text-orange-700 gap-1"><AlertTriangle className="w-3 h-3" /> Refuerzo requerido</Badge>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-1">Inicio</p>
              <p className="text-gray-700 text-xs">{attempt.started_at ? format(new Date(attempt.started_at), "dd MMM yyyy HH:mm", { locale: es }) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Envío</p>
              <p className="text-gray-700 text-xs">{attempt.submitted_at ? format(new Date(attempt.submitted_at), "dd MMM yyyy HH:mm", { locale: es }) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Duración</p>
              <p className="text-gray-700">{duration !== null ? `${Math.floor(duration / 60)}m ${duration % 60}s` : '—'}</p>
            </div>
            {attempt.reviewed_by && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1">Revisión docente</p>
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">Docente:</span>
                    <span className="text-sm font-medium text-gray-800">{attempt.reviewer_name || attempt.reviewed_by}</span>
                  </div>
                  {attempt.review_decision && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">Decisión:</span>
                      {attempt.review_decision === 'approved'
                        ? <Badge className="bg-green-100 text-green-700 gap-1 text-xs"><CheckCircle2 className="w-3 h-3" /> Aprobado</Badge>
                        : <Badge className="bg-red-100 text-red-700 gap-1 text-xs"><XCircle className="w-3 h-3" /> Rechazado</Badge>
                      }
                    </div>
                  )}
                  {attempt.reviewed_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">Fecha:</span>
                      <span className="text-xs text-gray-700">{format(new Date(attempt.reviewed_at), "dd MMM yyyy HH:mm", { locale: es })}</span>
                    </div>
                  )}
                  {attempt.feedback && (
                    <div className="flex items-start gap-2 mt-1">
                      <span className="text-xs text-gray-500 w-20 shrink-0">Comentario:</span>
                      <span className="text-xs text-gray-700 italic">"{attempt.feedback}"</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sección 1.5: Auditoría presencial (solo final_exam) */}
      {attempt.type === 'final_exam' && attempt.presential_token_id && (
       <Card className="border-purple-200 bg-purple-50">
         <CardHeader className="pb-2">
           <CardTitle className="text-base flex items-center gap-2">
             <KeyRound className="w-4 h-4 text-purple-600" /> Validación presencial
           </CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
           {/* Fila 1: Token y Docente */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
             <div>
               <p className="text-xs text-gray-400 mb-1">Código del token</p>
               <p className="font-mono font-bold text-gray-800 text-lg">{attempt.token_code}</p>
             </div>
             <div>
               <p className="text-xs text-gray-400 mb-1">Docente (generador)</p>
               <p className="font-medium text-gray-800">{attempt.validated_by_name || attempt.validated_by || '—'}</p>
             </div>
             <div>
               <p className="text-xs text-gray-400 mb-1">Método</p>
               <Badge className="bg-purple-100 text-purple-700 gap-1 text-xs">
                 <KeyRound className="w-3 h-3" /> {attempt.validation_method || 'token'}
               </Badge>
             </div>
             <div>
               <p className="text-xs text-gray-400 mb-1">Token validado</p>
               <p className="text-xs text-gray-700">
                 {attempt.token_validated_at ? format(new Date(attempt.token_validated_at), "HH:mm:ss", { locale: es }) : '—'}
               </p>
             </div>
           </div>

           {/* Fila 2: Inicio real y Duración */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-purple-200 pt-3">
             <div>
               <p className="text-xs text-gray-400 mb-1">Inicio real</p>
               <p className="text-xs text-gray-700">
                 {attempt.exam_started_at ? format(new Date(attempt.exam_started_at), "HH:mm:ss", { locale: es }) : '—'}
               </p>
             </div>
             <div>
               <p className="text-xs text-gray-400 mb-1">Envío</p>
               <p className="text-xs text-gray-700">
                 {attempt.submitted_at ? format(new Date(attempt.submitted_at), "HH:mm:ss", { locale: es }) : '—'}
               </p>
             </div>
             <div>
               <p className="text-xs text-gray-400 mb-1">Duración examen</p>
               <p className="font-medium text-gray-800">
                 {attempt.duration_seconds !== null && attempt.duration_seconds !== undefined
                   ? `${Math.floor(attempt.duration_seconds / 60)}m ${attempt.duration_seconds % 60}s`
                   : '—'}
               </p>
             </div>
             <div>
               <p className="text-xs text-gray-400 mb-1">Espacio de tiempo</p>
               <p className="text-xs text-gray-700">
                 {attempt.token_validated_at && attempt.exam_started_at
                   ? (() => {
                       const gap = Math.round((new Date(attempt.exam_started_at).getTime() - new Date(attempt.token_validated_at).getTime()) / 1000);
                       return gap >= 0 ? `+${gap}s` : 'Sincrónico';
                     })()
                   : '—'}
               </p>
             </div>
           </div>

           {/* Fila 3: Auditoría soft (IP + Device) */}
           {(attempt.ip_address || attempt.device_info) && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t border-purple-200 pt-3">
               {attempt.ip_address && (
                 <div>
                   <p className="text-xs text-gray-400 mb-1">Dirección IP</p>
                   <p className="font-mono text-xs text-gray-700">{attempt.ip_address}</p>
                 </div>
               )}
               {attempt.device_info && (
                 <div>
                   <p className="text-xs text-gray-400 mb-1">Dispositivo</p>
                   <p className="text-xs text-gray-700 truncate" title={attempt.device_info}>
                     {attempt.device_info.substring(0, 50)}...
                   </p>
                 </div>
               )}
             </div>
           )}
         </CardContent>
       </Card>
      )}

      {/* Sección 2: Respuestas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Respuestas del alumno</CardTitle>
        </CardHeader>
        <CardContent>
          {(attempt.answers || []).length === 0 ? (
            <p className="text-sm text-gray-400">No hay respuestas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">#</th>
                    <th className="text-left py-2 pr-3 font-medium">Pregunta</th>
                    <th className="text-left py-2 pr-3 font-medium">Respuesta alumno</th>
                    <th className="text-left py-2 pr-3 font-medium">Resp. correcta</th>
                    <th className="text-center py-2 pr-3 font-medium">✓</th>
                    <th className="text-right py-2 font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {(attempt.answers || []).map((ans, idx) => {
                    const q = questions[ans.question_id];
                    return (
                      <tr key={idx} className={cn(
                        "border-b text-xs",
                        ans.correct === true && "bg-green-50",
                        ans.correct === false && "bg-red-50",
                        ans.correct === null && "bg-yellow-50",
                      )}>
                        <td className="py-2 pr-3 text-gray-400">{idx + 1}</td>
                        <td className="py-2 pr-3 text-gray-700 max-w-[200px]">
                          {q ? q.question : <span className="text-gray-400 italic">Pregunta {idx + 1}</span>}
                        </td>
                        <td className="py-2 pr-3 font-medium text-gray-800">{ans.user_answer || <em className="text-gray-400">—</em>}</td>
                        <td className="py-2 pr-3 text-gray-500">{q ? q.correct_answer : '—'}</td>
                        <td className="py-2 pr-3 text-center">
                          {ans.correct === true && <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                          {ans.correct === false && <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                          {ans.correct === null && <Clock className="w-4 h-4 text-yellow-500 mx-auto" />}
                        </td>
                        <td className="py-2 text-right font-medium">{ans.points_obtained ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel docente — revisión con timer */}
      {canReview && (
        <Card className="border-indigo-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-600" /> Revisión docente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lock error */}
            {lockError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {lockError}
              </div>
            )}

            {/* Timer de revisión mínima */}
            {!lockError && (
              <div className={cn(
                "rounded-lg p-3 flex items-center gap-3 border",
                reviewReady
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-yellow-50 border-yellow-200 text-yellow-700"
              )}>
                <Clock className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                  {reviewReady ? (
                    <p className="text-sm font-medium">✅ Tiempo de revisión cumplido — puedes calificar</p>
                  ) : (
                    <p className="text-sm font-medium">
                      Debes revisar al menos {MIN_REVIEW_SECONDS}s antes de calificar —
                      <span className="font-bold ml-1">{remainingSeconds}s restantes</span>
                    </p>
                  )}
                  <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", reviewReady ? "bg-green-500" : "bg-yellow-400")}
                      style={{ width: `${Math.min(100, (elapsedSeconds / MIN_REVIEW_SECONDS) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {!lockError && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Score final (0-100)</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={reviewScore}
                      disabled={!reviewReady}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setReviewScore(v);
                        setReviewPassed(v >= 70);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">¿Aprobado?</Label>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" variant={reviewPassed ? 'default' : 'outline'} onClick={() => setReviewPassed(true)} className="flex-1" disabled={!reviewReady}>Sí</Button>
                      <Button size="sm" variant={!reviewPassed ? 'destructive' : 'outline'} onClick={() => setReviewPassed(false)} className="flex-1" disabled={!reviewReady}>No</Button>
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
                    disabled={!reviewReady}
                  />
                </div>
                <Button
                  onClick={handleSubmitReview}
                  disabled={submitting || !reviewReady}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : !reviewReady ? `Espera ${remainingSeconds}s...` : 'Guardar revisión'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historial de revisiones — visible para todos (admin y docente) */}
      {Array.isArray(attempt.review_history) && attempt.review_history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-gray-600" /> Historial de revisiones
              <Badge variant="outline" className="ml-auto text-xs">{attempt.review_history.length} revisión{attempt.review_history.length > 1 ? 'es' : ''}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...attempt.review_history].reverse().map((rev, idx) => {
              const isValid = (rev.review_duration_seconds || 0) >= 60;
              return (
                <div key={idx} className={cn(
                  "rounded-lg p-3 border space-y-2",
                  rev.decision === 'approved' ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                )}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {rev.decision === 'approved'
                        ? <Badge className="bg-green-100 text-green-700 gap-1 text-xs"><CheckCircle2 className="w-3 h-3" /> Aprobado</Badge>
                        : <Badge className="bg-red-100 text-red-700 gap-1 text-xs"><XCircle className="w-3 h-3" /> Rechazado</Badge>
                      }
                      {isValid
                        ? <span className="text-xs text-green-600 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Revisión válida</span>
                        : <span className="text-xs text-orange-600 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Revisión rápida</span>
                      }
                    </div>
                    <span className="text-xs text-gray-400">
                      {rev.reviewed_at ? format(new Date(rev.reviewed_at), "dd MMM yyyy HH:mm", { locale: es }) : '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Docente: </span>
                      <span className="font-medium text-gray-700">{rev.reviewer_name || rev.reviewer_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Rol: </span>
                      <span className="text-gray-700 capitalize">{rev.reviewer_role || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Duración: </span>
                      <span className={cn("font-medium", isValid ? "text-green-600" : "text-orange-600")}>
                        {rev.review_duration_seconds != null
                          ? `${Math.floor(rev.review_duration_seconds / 60)}m ${rev.review_duration_seconds % 60}s`
                          : '—'
                        }
                      </span>
                    </div>
                  </div>
                  {rev.feedback && (
                    <p className="text-xs text-gray-600 italic border-t border-gray-200 pt-2">"{rev.feedback}"</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {attempt.feedback && !canReview && !attempt.review_history?.length && (
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