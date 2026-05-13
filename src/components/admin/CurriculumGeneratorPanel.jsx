import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertTriangle, Download, RefreshCw, Eye, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({ preview, onConfirm, onCancel, overwrite, setOverwrite, hasExisting }) {
  if (!preview) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">Preview — {preview.subject_name}</h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Unidades', value: preview.units, color: 'blue' },
              { label: 'Módulos', value: preview.modules, color: 'violet' },
              { label: 'Lecciones', value: preview.total_lessons, color: 'amber' },
              { label: 'Tiempo est.', value: '~' + preview.estimated_minutes + ' min', color: 'orange' },
            ].map(({ label, value, color }) => (
              <div key={label} className={'bg-' + color + '-50 rounded-lg p-3 text-center'}>
                <div className={'text-2xl font-bold text-' + color + '-700'}>{value}</div>
                <div className={'text-xs text-' + color + '-600'}>{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm flex items-center justify-between">
            <span className="text-gray-700">Tokens estimados</span>
            <span className="font-mono font-semibold text-gray-800">~{Math.round(preview.estimated_tokens / 1000)}k tokens</span>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Estructura</p>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {preview.structure_summary?.map((u, i) => (
                <div key={i} className="border rounded-lg p-2.5">
                  <p className="text-xs font-semibold text-gray-700">{u.title}</p>
                  <div className="mt-1 space-y-0.5">
                    {u.modules?.map((m, j) => (
                      <p key={j} className="text-xs text-gray-500 pl-3">• {m.title} ({m.lessons_count} lecciones)</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {hasExisting && (
            <label className="flex items-center gap-2 cursor-pointer text-sm border-t pt-3">
              <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="rounded" />
              <span className="font-medium text-red-600">Sobreescribir contenido existente</span>
            </label>
          )}
        </div>
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onConfirm}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────
export default function CurriculumGeneratorPanel({ subject, onComplete }) {
  const [status, setStatus] = useState('idle'); // idle | generating | completed | failed
  const [jobId, setJobId] = useState(null);
  const [jobRecord, setJobRecord] = useState(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [lockedJobId, setLockedJobId] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const pollRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!subject) return;
    setStatus('idle'); setJobId(null); setJobRecord(null);
    setHasExisting(false); setOverwrite(false);
    setPreview(null); setShowPreview(false); setLockedJobId(null);
    base44.entities.CourseUnit.filter({ subject_id: subject.id })
      .then(units => setHasExisting(units.length > 0)).catch(() => {});
  }, [subject?.id]);

  // Polling del job
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const poll = async () => {
      try {
        const recs = await base44.entities.CurriculumGenerationJob.filter({ id: jobId });
        const rec = recs[0];
        if (!rec) return;
        setJobRecord(rec);
        if (rec.status === 'completed') {
          setStatus('completed');
          clearInterval(pollRef.current);
          toast.success('✅ Currículo generado: ' + rec.completed_lessons + ' lecciones, ' + (rec.activities_created || 0) + ' actividades');
          if (onComplete) onComplete();
        } else if (rec.status === 'failed') {
          setStatus('failed');
          clearInterval(pollRef.current);
          toast.error('Error: ' + (rec.error_message || 'Desconocido'));
        }
      } catch (e) { console.warn('Poll error:', e.message); }
    };
    pollRef.current = setInterval(poll, 3000);
    poll();
    return () => clearInterval(pollRef.current);
  }, [jobId, status]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [jobRecord?.logs, showLogs]);

  const handlePreview = async () => {
    if (!subject) return;
    setLoadingPreview(true);
    try {
      const res = await base44.functions.invoke('generateSubjectCurriculum', { subject_id: subject.id, preview_only: true });
      if (res.data?.preview) { setPreview(res.data); setShowPreview(true); }
      else toast.error(res.data?.error || 'Error al cargar preview');
    } catch (e) { toast.error(e.message); }
    finally { setLoadingPreview(false); }
  };

  const handleGenerate = async () => {
    setShowPreview(false);
    setStatus('generating');
    setJobRecord(null);
    try {
      const res = await base44.functions.invoke('generateSubjectCurriculum', { subject_id: subject.id, overwrite });
      const data = res.data;
      if (data?.success && data?.job_id) {
        setJobId(data.job_id);
        toast.info('Generación iniciada — ' + data.total_lessons + ' lecciones');
      } else if (data?.locked) {
        setStatus('idle'); setLockedJobId(data.active_job_id);
        toast.error('🔒 ' + data.error);
      } else if (data?.has_content) {
        setHasExisting(true); setStatus('idle');
        toast.warning('Ya existe contenido. Activa "Sobreescribir".');
      } else if (data?.no_syllabus) {
        setStatus('idle'); toast.error('Define el temario antes de generar.');
      } else {
        setStatus('failed'); toast.error(data?.error || 'Error desconocido');
      }
    } catch (e) {
      setStatus('failed'); toast.error(e.message);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    setCancelling(true);
    try {
      await base44.entities.CurriculumGenerationJob.update(jobId, { status: 'failed', error_message: 'Cancelado manualmente.' });
      setStatus('failed');
      clearInterval(pollRef.current);
      toast.warning('Generación cancelada.');
    } finally { setCancelling(false); }
  };

  const handleForceUnlock = async () => {
    try {
      const res = await base44.functions.invoke('generateSubjectCurriculum', { subject_id: subject.id, force_unlock: true });
      if (res.data?.success) { setLockedJobId(null); toast.success('Job desbloqueado.'); }
      else toast.error(res.data?.error || 'No se pudo desbloquear');
    } catch (e) { toast.error(e.message); }
  };

  const handleExportLogs = () => {
    const logs = jobRecord?.logs || [];
    if (!logs.length) { toast.info('No hay logs'); return; }
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'logs-' + (subject?.name || 'curriculum') + '-' + Date.now() + '.txt';
    a.click(); URL.revokeObjectURL(url);
  };

  if (!subject) return null;

  const isRunning = status === 'generating';
  const progress = jobRecord?.progress_percent ?? 0;
  const logs = jobRecord?.logs ?? [];
  const completedLessons = jobRecord?.completed_lessons ?? 0;
  const totalLessons = jobRecord?.total_lessons ?? 0;
  const failedLessons = jobRecord?.failed_lessons ?? 0;

  return (
    <>
      {showPreview && (
        <PreviewModal
          preview={preview} onConfirm={handleGenerate} onCancel={() => setShowPreview(false)}
          overwrite={overwrite} setOverwrite={setOverwrite} hasExisting={hasExisting}
        />
      )}

      <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-emerald-800">Generar currículo con IA</span>
            {status === 'completed' && <Badge className="bg-green-100 text-green-700 ml-auto">Completado</Badge>}
            {status === 'failed' && <Badge className="bg-red-100 text-red-700 ml-auto">Falló</Badge>}
            {isRunning && <Badge className="bg-blue-100 text-blue-700 ml-auto animate-pulse">Generando...</Badge>}
          </div>
          <p className="text-xs text-gray-500 mt-1">1 llamada LLM por lección · Solo multiple_choice, true_false, fill_blank</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progreso */}
          {(isRunning || status === 'completed') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium">{progress}%</span>
                <span>{completedLessons}/{totalLessons || '?'} lecciones</span>
              </div>
              <Progress value={progress} className="h-2" />
              {isRunning && jobRecord?.current_lesson && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                  {jobRecord.current_lesson}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-base font-bold text-green-700">{completedLessons}</div>
                  <div className="text-xs text-green-600">Completadas</div>
                </div>
                <div className={cn("rounded-lg p-2 text-center", failedLessons > 0 ? "bg-red-50" : "bg-gray-50")}>
                  <div className={cn("text-base font-bold", failedLessons > 0 ? "text-red-700" : "text-gray-400")}>{failedLessons}</div>
                  <div className="text-xs text-gray-500">Fallidas</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-base font-bold text-blue-700">{jobRecord?.activities_created ?? 0}</div>
                  <div className="text-xs text-blue-600">Actividades</div>
                </div>
              </div>
            </div>
          )}

          {/* Resultado completado */}
          {status === 'completed' && jobRecord && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-semibold">¡Currículo generado!</p>
                <p className="text-xs mt-0.5">{jobRecord.completed_lessons} lecciones · {jobRecord.activities_created || 0} actividades</p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Error en la generación</p>
                <p className="text-xs mt-0.5">{jobRecord?.error_message || 'Error desconocido'}</p>
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div>
              <button onClick={() => setShowLogs(v => !v)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showLogs ? 'Ocultar' : 'Ver'} logs ({logs.length})
              </button>
              {showLogs && (
                <div className="mt-2 max-h-48 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-0.5">
                  {logs.map((l, i) => (
                    <p key={i} className={cn('leading-relaxed',
                      l.includes('✅') || l.includes('🎉') ? 'text-green-400' :
                      l.includes('❌') || l.includes('💥') ? 'text-red-400' :
                      l.includes('⚠️') ? 'text-amber-400' :
                      l.includes('⏭️') ? 'text-gray-400' :
                      l.includes('🚀') || l.includes('📝') ? 'text-cyan-400' :
                      'text-gray-300'
                    )}>{l}</p>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Job bloqueado */}
          {lockedJobId && (status === 'idle' || status === 'failed') && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 font-medium">Hay un job activo bloqueando la generación.</p>
              </div>
              <Button onClick={handleForceUnlock} variant="outline" size="sm" className="w-full border-amber-400 text-amber-700 hover:bg-amber-100">
                Forzar desbloqueo
              </Button>
            </div>
          )}

          {/* Botones de acción */}
          {(status === 'idle' || status === 'failed') && (
            <Button onClick={handlePreview} disabled={loadingPreview} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {loadingPreview ? 'Calculando...' : 'Preview y generar — ' + subject.name}
            </Button>
          )}

          {isRunning && !jobRecord && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Iniciando...
            </div>
          )}

          {isRunning && jobRecord && (
            <div className="space-y-2">
              <Button onClick={handleCancel} disabled={cancelling} variant="destructive" className="w-full gap-2" size="sm">
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                Cancelar
              </Button>
              <Button onClick={handleExportLogs} variant="outline" size="sm" className="w-full gap-2">
                <Download className="w-4 h-4" /> Exportar logs
              </Button>
            </div>
          )}

          {status === 'completed' && (
            <div className="flex gap-2">
              <Button onClick={handleExportLogs} variant="outline" size="sm" className="flex-1 gap-1.5">
                <Download className="w-3.5 h-3.5" /> Logs
              </Button>
              <Button onClick={handlePreview} variant="outline" size="sm" className="flex-1 gap-1.5" disabled={loadingPreview}>
                <RefreshCw className="w-3.5 h-3.5" /> Regenerar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}