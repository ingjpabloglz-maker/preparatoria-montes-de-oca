import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Loader2, CheckCircle2, XCircle, BookOpen, Layers,
  ClipboardList, Zap, ChevronDown, ChevronUp, AlertTriangle,
  Clock, Play, Pause, Download, RefreshCw, Shield, Eye,
  BarChart2, Copy, Trash2, StopCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MODE_OPTIONS = [
  {
    value: 'lightweight',
    label: '⚡ Ligero',
    desc: '4 act/lección · solo explicación básica · 1 tipo avanzado · mínimo tokens',
    color: 'border-green-400 bg-green-50',
    badge: 'bg-green-100 text-green-700',
  },
  {
    value: 'standard',
    label: '📘 Estándar',
    desc: '4–6 act/lección · explicación básica · 1 tipo avanzado · balance calidad/costo',
    color: 'border-blue-400 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'rich',
    label: '🎓 Completo',
    desc: '7–10 act/lección · todos los tipos · mayor calidad y cobertura',
    color: 'border-violet-400 bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
  },
];

// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ preview, onConfirm, onCancel, safeMode, setSafeMode, overwrite, setOverwrite, generationMode, setGenerationMode }) {
  if (!preview) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">Preview antes de generar</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">{preview.subject_name}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Estimaciones */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{preview.units}</div>
              <div className="text-xs text-blue-600">Unidades</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-violet-700">{preview.modules}</div>
              <div className="text-xs text-violet-600">Módulos</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-700">{preview.total_lessons}</div>
              <div className="text-xs text-amber-600">Lecciones</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-700">~{preview.estimated_minutes} min</div>
              <div className="text-xs text-orange-600">Tiempo estimado</div>
            </div>
          </div>

          {/* Tokens */}
          <div className={cn(
            "rounded-lg p-3 text-sm flex items-center justify-between",
            generationMode === 'lightweight' ? 'bg-green-50 text-green-800' :
            generationMode === 'rich' ? 'bg-violet-50 text-violet-800' : 'bg-gray-50 text-gray-700'
          )}>
            <span>Tokens estimados ({generationMode})</span>
            <span className="font-mono font-semibold">~{Math.round(preview.estimated_tokens / 1000)}k tokens</span>
          </div>

          {/* Modo de generación */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Modo de generación</p>
            <div className="space-y-2">
              {MODE_OPTIONS.map(m => (
                <label key={m.value} className={cn(
                  "flex items-start gap-3 cursor-pointer rounded-lg p-3 border-2 transition-all",
                  generationMode === m.value ? m.color + ' border-opacity-100' : 'border-gray-200 bg-white hover:bg-gray-50'
                )}>
                  <input
                    type="radio"
                    name="generation_mode"
                    value={m.value}
                    checked={generationMode === m.value}
                    onChange={() => setGenerationMode(m.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-sm text-gray-800">{m.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Estructura */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Estructura del temario</p>
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

          {/* Opciones */}
          <div className="space-y-2 border-t pt-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={safeMode} onChange={e => setSafeMode(e.target.checked)} className="rounded" />
              <div>
                <span className="font-medium text-gray-700">Modo Seguro (safe_mode)</span>
                <p className="text-xs text-gray-500">Genera 1 módulo, espera confirmación manual</p>
              </div>
            </label>
            {overwrite !== undefined && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="rounded" />
                <span className="font-medium text-red-600">Sobreescribir contenido existente</span>
              </label>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onConfirm}>
            <Sparkles className="w-4 h-4 mr-2" />
            Confirmar y generar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Métricas del job ─────────────────────────────────────────────────────────
function JobMetrics({ jobRecord }) {
  if (!jobRecord) return null;
  const successRate = jobRecord.total_lessons > 0
    ? Math.round((jobRecord.completed_lessons / jobRecord.total_lessons) * 100) : 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <BarChart2 className="w-3.5 h-3.5" /> Métricas de generación
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {jobRecord.total_llm_calls > 0 && (
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-slate-700">{jobRecord.total_llm_calls}</div>
            <div className="text-xs text-slate-500">Llamadas LLM</div>
          </div>
        )}
        {jobRecord.total_tokens_estimated > 0 && (
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-slate-700">~{Math.round(jobRecord.total_tokens_estimated/1000)}k</div>
            <div className="text-xs text-slate-500">Tokens est.</div>
          </div>
        )}
        {jobRecord.avg_lesson_seconds > 0 && (
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-slate-700">{jobRecord.avg_lesson_seconds}s</div>
            <div className="text-xs text-slate-500">Prom/lección</div>
          </div>
        )}
        {jobRecord.rate_limit_hits > 0 && (
          <div className="bg-amber-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-amber-700">{jobRecord.rate_limit_hits}</div>
            <div className="text-xs text-amber-600">Rate limits</div>
          </div>
        )}
        {jobRecord.total_lessons > 0 && (
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-emerald-700">{successRate}%</div>
            <div className="text-xs text-emerald-600">Éxito</div>
          </div>
        )}
        {jobRecord.activities_created > 0 && (
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-blue-700">{jobRecord.activities_created}</div>
            <div className="text-xs text-blue-600">Actividades</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────
export default function CurriculumGeneratorPanel({ subject, onComplete }) {
  const [status, setStatus] = useState('idle');
  const [genId, setGenId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [genRecord, setGenRecord] = useState(null);
  const [jobRecord, setJobRecord] = useState(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [safeMode, setSafeMode] = useState(false);
  const [generationMode, setGenerationMode] = useState('standard');
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const pollRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!subject) return;
    setStatus('idle');
    setGenId(null);
    setJobId(null);
    setGenRecord(null);
    setJobRecord(null);
    setHasExisting(false);
    setOverwrite(false);
    setPreview(null);
    setShowPreview(false);

    base44.entities.CourseUnit.filter({ subject_id: subject.id })
      .then(units => setHasExisting(units.length > 0))
      .catch(() => {});
  }, [subject?.id]);

  // Polling
  useEffect(() => {
    if (!genId || status === 'completed' || status === 'failed' || status === 'paused') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const records = await base44.entities.CurriculumGeneration.filter({ generation_id: genId });
        const rec = records[0];
        if (rec) setGenRecord(rec);

        if (jobId) {
          const jobRecs = await base44.entities.CurriculumGenerationJob.filter({ id: jobId });
          if (jobRecs[0]) {
            setJobRecord(jobRecs[0]);
            // Sync status from job record (más confiable)
            if (jobRecs[0].status === 'paused') {
              setStatus('paused');
              clearInterval(pollRef.current);
              toast.warning('⏸️ Job pausado — Circuit breaker o safe mode activado.');
              return;
            }
          }
        }

        if (rec?.status === 'completed') {
          setStatus('completed');
          clearInterval(pollRef.current);
          toast.success(`✅ Currículo generado: ${rec.units_created} unidades, ${rec.lessons_created} lecciones`);
          if (onComplete) onComplete();
        } else if (rec?.status === 'failed') {
          setStatus('failed');
          clearInterval(pollRef.current);
          toast.error(`Error: ${rec.error_message}`);
        }
      } catch (e) {
        console.warn('Poll error:', e.message);
      }
    };

    pollRef.current = setInterval(poll, 3000);
    poll();
    return () => clearInterval(pollRef.current);
  }, [genId, jobId, status]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobRecord?.logs, genRecord?.logs, showLogs]);

  // #12 PREVIEW — cargar antes de generar
  const handlePreview = async () => {
    if (!subject) return;
    setLoadingPreview(true);
    try {
      const res = await base44.functions.invoke('generateSubjectCurriculum', {
        subject_id: subject.id,
        preview_only: true,
        generation_mode: generationMode,
      });
      if (res.data?.preview) {
        setPreview(res.data);
        setShowPreview(true);
      } else {
        toast.error(res.data?.error || 'No se pudo cargar el preview');
      }
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleGenerate = async () => {
    if (!subject) return;
    setShowPreview(false);
    setStatus('generating');
    setGenRecord(null);
    setJobRecord(null);

    try {
      const res = await base44.functions.invoke('generateSubjectCurriculum', {
        subject_id: subject.id,
        overwrite,
        safe_mode: safeMode,
        generation_mode: generationMode,
      });

      const data = res.data;
      if (data?.success && data?.generation_id) {
        setGenId(data.generation_id);
        if (data.job_id) setJobId(data.job_id);
        toast.info(`Generación iniciada — ${data.total_lessons} lecciones planificadas`);
      } else if (data?.locked) {
        setStatus('idle');
        toast.error(`🔒 ${data.error}`);
      } else if (data?.has_content) {
        setHasExisting(true);
        setStatus('idle');
        toast.warning('Ya existe contenido. Activa "Sobreescribir" en el preview.');
      } else if (data?.no_syllabus) {
        setStatus('idle');
        toast.error('Define el temario antes de generar.');
      } else {
        setStatus('failed');
        toast.error(`Error: ${data?.error || 'Desconocido'}`);
      }
    } catch (e) {
      const data = e?.response?.data;
      if (data?.locked) {
        setStatus('idle');
        toast.error(`🔒 ${data.error}`);
      } else if (data?.has_content) {
        setHasExisting(true);
        setStatus('idle');
        toast.warning('Ya existe contenido. Activa "Sobreescribir" en el preview.');
      } else if (data?.no_syllabus) {
        setStatus('idle');
        toast.error('Define el temario antes de generar.');
      } else {
        setStatus('idle');
        toast.error(`Error: ${data?.error || e.message}`);
      }
    }
  };

  // #11 Controles adicionales
  const handleCancel = async () => {
    setLoadingAction('cancel');
    try {
      if (jobRecord?.id) {
        await base44.entities.CurriculumGenerationJob.update(jobRecord.id, {
          status: 'failed', error_message: 'Cancelado manualmente.'
        });
      }
      if (genRecord?.id) {
        await base44.entities.CurriculumGeneration.update(genRecord.id, {
          status: 'failed', error_message: 'Cancelado manualmente.'
        });
      }
      setStatus('failed');
      clearInterval(pollRef.current);
      toast.warning('Generación cancelada.');
    } finally { setLoadingAction(null); }
  };

  const handleResume = async () => {
    if (!jobRecord?.id) return;
    setLoadingAction('resume');
    try {
      await base44.entities.CurriculumGenerationJob.update(jobRecord.id, {
        status: 'processing',
        error_message: '',
        last_activity_at: new Date().toISOString(),
      });
      // Re-iniciar generación desde donde quedó
      const res = await base44.functions.invoke('generateSubjectCurriculum', {
        subject_id: subject.id,
        overwrite: false,
        safe_mode: safeMode,
      });
      if (res.data?.success) {
        setGenId(res.data.generation_id);
        setJobId(res.data.job_id);
        setStatus('generating');
        toast.info('Generación reanudada — continuando desde checkpoint.');
      } else {
        toast.error(res.data?.error || 'Error al reanudar');
      }
    } finally { setLoadingAction(null); }
  };

  const handleExportLogs = () => {
    const logs = jobRecord?.logs || genRecord?.logs || [];
    if (!logs.length) { toast.info('No hay logs'); return; }
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `curriculum-logs-${subject?.name?.replace(/\s+/g, '-')}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exportados');
  };

  if (!subject) return null;

  const isRunning = status === 'generating';
  const isPaused = status === 'paused';
  const progress = jobRecord?.progress_percent ?? genRecord?.progress_percent ?? 0;
  const logs = jobRecord?.logs ?? genRecord?.logs ?? [];

  const completedLessons = jobRecord?.completed_lessons ?? genRecord?.completed_steps ?? 0;
  const totalLessons = jobRecord?.total_lessons ?? genRecord?.total_steps ?? 0;
  const failedLessons = jobRecord?.failed_lessons ?? 0;
  const skippedLessons = jobRecord?.skipped_lessons ?? 0;
  const avgSecs = jobRecord?.avg_lesson_seconds ?? 0;
  const remaining = totalLessons - completedLessons - failedLessons - skippedLessons;
  const etaMin = avgSecs > 0 && remaining > 0 ? Math.ceil((avgSecs * remaining) / 60) : null;

  return (
    <>
      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          preview={preview}
          onConfirm={handleGenerate}
          onCancel={() => setShowPreview(false)}
          safeMode={safeMode}
          setSafeMode={setSafeMode}
          overwrite={hasExisting ? overwrite : undefined}
          setOverwrite={setOverwrite}
          generationMode={generationMode}
          setGenerationMode={setGenerationMode}
        />
      )}

      <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <CardTitle className="text-base text-emerald-800">Generar currículo con IA</CardTitle>
            {status === 'completed' && <Badge className="bg-green-100 text-green-700 ml-auto">Completado</Badge>}
            {status === 'failed' && <Badge className="bg-red-100 text-red-700 ml-auto">Falló</Badge>}
            {isPaused && <Badge className="bg-amber-100 text-amber-700 ml-auto">⏸️ Pausado</Badge>}
            {isRunning && <Badge className="bg-blue-100 text-blue-700 ml-auto animate-pulse">Generando...</Badge>}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Secuencial · Watchdog · Circuit Breaker · Transacciones · Validación post-gen
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Info */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-500" /> Unidades del temario</span>
            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-violet-500" /> Módulos</span>
            <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-amber-500" /> Lecciones + mini-eval</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-orange-500" /> 4–10 act/lección según modo</span>
          </div>

          {/* Barra de progreso */}
          {(isRunning || isPaused || status === 'completed') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium text-sm">{progress}% completado</span>
                <span>{completedLessons} / {totalLessons || '?'} lecciones</span>
              </div>
              <Progress value={progress} className="h-3" />

              {/* Estado actual */}
              {isRunning && (jobRecord?.current_module || genRecord?.current_module) && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                    <span className="font-medium">Módulo:</span>
                    <span className="truncate">{jobRecord?.current_module || genRecord?.current_module}</span>
                  </div>
                  {(jobRecord?.current_lesson || genRecord?.current_lesson) && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 pl-5">
                      <span className="font-medium">Lección:</span>
                      <span className="truncate italic">{jobRecord?.current_lesson || genRecord?.current_lesson}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{completedLessons}</div>
                  <div className="text-xs text-green-600">Completadas</div>
                </div>
                <div className={cn("rounded-lg p-2 text-center", failedLessons > 0 ? "bg-red-50" : "bg-gray-50")}>
                  <div className={cn("text-lg font-bold", failedLessons > 0 ? "text-red-700" : "text-gray-400")}>{failedLessons}</div>
                  <div className={cn("text-xs", failedLessons > 0 ? "text-red-600" : "text-gray-400")}>Fallidas</div>
                </div>
                <div className={cn("rounded-lg p-2 text-center", skippedLessons > 0 ? "bg-gray-100" : "bg-gray-50")}>
                  <div className="text-lg font-bold text-gray-600">{skippedLessons}</div>
                  <div className="text-xs text-gray-500">Saltadas</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{jobRecord?.activities_created ?? genRecord?.activities_created ?? 0}</div>
                  <div className="text-xs text-blue-600">Actividades</div>
                </div>
              </div>

              {/* ETA */}
              {isRunning && etaMin !== null && etaMin > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>ETA: ~{etaMin} min restantes</span>
                  {avgSecs > 0 && <span className="text-gray-400">({avgSecs}s/lección promedio)</span>}
                </div>
              )}
            </div>
          )}

          {/* Métricas reales */}
          {(isRunning || isPaused || status === 'completed') && jobRecord && (
            <JobMetrics jobRecord={jobRecord} />
          )}

          {/* Safe mode badge */}
          {isPaused && jobRecord?.status === 'paused' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <Pause className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Job pausado</p>
                <p className="text-xs mt-0.5">{jobRecord?.error_message || 'Pausado — revisa los logs y reanuda manualmente.'}</p>
              </div>
            </div>
          )}

          {/* Resultado final */}
          {status === 'completed' && genRecord && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold">¡Currículo generado exitosamente!</p>
                  <p className="text-xs mt-0.5">
                    {genRecord.units_created} unidades · {genRecord.modules_created} módulos · {genRecord.lessons_created} lecciones · {genRecord.activities_created} actividades
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Error en la generación</p>
                <p className="text-xs mt-0.5">{jobRecord?.error_message || genRecord?.error_message || 'Error desconocido'}</p>
              </div>
            </div>
          )}

          {/* Logs expandibles */}
          {logs.length > 0 && (
            <div>
              <button
                onClick={() => setShowLogs(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showLogs ? 'Ocultar' : 'Ver'} logs ({logs.length} entradas)
              </button>
              {showLogs && (
                <div className="mt-2 max-h-64 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-0.5">
                  {logs.map((l, i) => (
                    <p key={i} className={cn(
                      "leading-relaxed",
                      l.includes('✅') || l.includes('🎉') || l.includes('COMMIT') ? 'text-green-400' :
                      l.includes('❌') || l.includes('💥') || l.includes('ROLLBACK') ? 'text-red-400' :
                      l.includes('🚨') || l.includes('Auditoría') ? 'text-red-300' :
                      l.includes('⚠️') || l.includes('Rate limit') || l.includes('Basura') ? 'text-amber-400' :
                      l.includes('🔴') || l.includes('Circuit breaker') ? 'text-red-300' :
                      l.includes('Retry') || l.includes('backoff') ? 'text-yellow-300' :
                      l.includes('⏭️') || l.includes('SKIP') ? 'text-gray-400' :
                      l.includes('🚀') || l.includes('📐') || l.includes('🎯') ? 'text-cyan-400' :
                      l.includes('⏳') || l.includes('ETA') ? 'text-blue-300' :
                      l.includes('🛡️') || l.includes('Watchdog') ? 'text-violet-300' :
                      l.includes('🧹') || l.includes('🗑️') ? 'text-orange-300' :
                      'text-gray-300'
                    )}>{l}</p>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}

          {/* ── Botones de acción ─────────────────────────────────────────────── */}

          {/* Idle o failed: mostrar preview */}
          {(status === 'idle' || status === 'failed') && (
            <div className="space-y-2">
              <Button
                onClick={handlePreview}
                disabled={loadingPreview}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {loadingPreview ? 'Calculando...' : `Preview y generar "${subject.name}"`}
              </Button>
              {status === 'failed' && (
                <p className="text-xs text-center text-gray-400">Revisa los logs antes de reintentar</p>
              )}
            </div>
          )}

          {/* Iniciando */}
          {isRunning && !jobRecord && !genRecord && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Iniciando generación...
            </div>
          )}

          {/* Controles mientras corre */}
          {isRunning && (jobRecord || genRecord) && (
            <div className="space-y-2">
              <Button
                onClick={handleCancel}
                disabled={loadingAction === 'cancel'}
                variant="destructive"
                className="w-full gap-2"
                size="sm"
              >
                {loadingAction === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                Cancelar generación
              </Button>
              <Button onClick={handleExportLogs} variant="outline" size="sm" className="w-full gap-2">
                <Download className="w-4 h-4" />
                Exportar logs
              </Button>
              <p className="text-xs text-center text-gray-400">
                Proceso secuencial con watchdog, circuit breaker y validación post-gen.
              </p>
            </div>
          )}

          {/* Controles cuando está pausado */}
          {isPaused && (
            <div className="space-y-2">
              <Button
                onClick={handleResume}
                disabled={loadingAction === 'resume'}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {loadingAction === 'resume' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Reanudar generación
              </Button>
              <Button onClick={handleCancel} variant="outline" className="w-full gap-2" size="sm">
                <XCircle className="w-4 h-4" />
                Cancelar
              </Button>
              <Button onClick={handleExportLogs} variant="ghost" size="sm" className="w-full gap-2">
                <Download className="w-4 h-4" />
                Exportar logs
              </Button>
            </div>
          )}

          {/* Controles post-completado */}
          {status === 'completed' && (
            <div className="flex gap-2">
              <Button onClick={handleExportLogs} variant="outline" size="sm" className="flex-1 gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Exportar logs
              </Button>
              <Button
                onClick={handlePreview}
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                disabled={loadingPreview}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}