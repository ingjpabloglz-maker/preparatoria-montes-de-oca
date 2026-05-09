import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Loader2, CheckCircle2, XCircle, BookOpen, Layers,
  ClipboardList, Zap, ChevronDown, ChevronUp, AlertTriangle,
  Clock, SkipForward, RefreshCw, Pause
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CurriculumGeneratorPanel({ subject, onComplete }) {
  const [status, setStatus] = useState('idle'); // idle | generating | completed | failed
  const [genId, setGenId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [genRecord, setGenRecord] = useState(null); // CurriculumGeneration (legacy)
  const [jobRecord, setJobRecord] = useState(null); // CurriculumGenerationJob (nuevo)
  const [hasExisting, setHasExisting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const pollRef = useRef(null);
  const logsEndRef = useRef(null);

  // Verificar si ya hay contenido
  useEffect(() => {
    if (!subject) return;
    setStatus('idle');
    setGenId(null);
    setJobId(null);
    setGenRecord(null);
    setJobRecord(null);
    setHasExisting(false);
    setOverwrite(false);

    base44.entities.CourseUnit.filter({ subject_id: subject.id })
      .then(units => setHasExisting(units.length > 0))
      .catch(() => {});
  }, [subject?.id]);

  // Polling del progreso
  useEffect(() => {
    if (!genId || status === 'completed' || status === 'failed') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        // Polling del CurriculumGeneration (legacy) para compatibilidad
        const records = await base44.entities.CurriculumGeneration.filter({ generation_id: genId });
        const rec = records[0];
        if (rec) setGenRecord(rec);

        // Polling del nuevo Job si tenemos el ID
        if (jobId) {
          const jobRec = await base44.entities.CurriculumGenerationJob.filter({ id: jobId });
          if (jobRec[0]) setJobRecord(jobRec[0]);
        }

        const currentStatus = rec?.status;
        if (currentStatus === 'completed') {
          setStatus('completed');
          clearInterval(pollRef.current);
          toast.success(`✅ Currículo generado: ${rec.units_created} unidades, ${rec.lessons_created} lecciones`);
          if (onComplete) onComplete();
        } else if (currentStatus === 'failed') {
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
  }, [genRecord?.logs, showLogs]);

  const handleStop = async () => {
    if (genRecord?.id) {
      await base44.entities.CurriculumGeneration.update(genRecord.id, {
        status: 'failed',
        error_message: 'Generación detenida manualmente.'
      });
    }
    if (jobRecord?.id) {
      await base44.entities.CurriculumGenerationJob.update(jobRecord.id, {
        status: 'failed',
        error_message: 'Detenida manualmente.'
      });
    }
    setStatus('failed');
    clearInterval(pollRef.current);
    toast.warning('Generación detenida manualmente.');
  };

  const handleGenerate = async () => {
    if (!subject) return;
    setStatus('generating');
    setGenRecord(null);
    setJobRecord(null);

    const res = await base44.functions.invoke('generateSubjectCurriculum', {
      subject_id: subject.id,
      overwrite,
    });

    const data = res.data;
    if (data?.success && data?.generation_id) {
      setGenId(data.generation_id);
      if (data.job_id) setJobId(data.job_id);
      toast.info('Generación iniciada. Proceso secuencial — sin saturar el LLM...');
    } else if (data?.has_content) {
      setHasExisting(true);
      setStatus('idle');
      toast.warning('Ya existe contenido. Activa "Sobreescribir" para reemplazarlo.');
    } else if (data?.no_syllabus) {
      setStatus('idle');
      toast.error('Define el temario de la materia antes de generar el currículo.');
    } else {
      setStatus('failed');
      toast.error(`Error: ${data?.error || 'Desconocido'}`);
    }
  };

  if (!subject) return null;

  const isRunning = status === 'generating' && genRecord?.status === 'in_progress';
  const progress = genRecord?.progress_percent ?? 0;
  const logs = genRecord?.logs ?? [];

  // Métricas del job nuevo
  const completedLessons = jobRecord?.completed_lessons ?? genRecord?.completed_steps ?? 0;
  const totalLessons = jobRecord?.total_lessons ?? genRecord?.total_steps ?? 0;
  const failedLessons = jobRecord?.failed_lessons ?? 0;
  const skippedLessons = jobRecord?.skipped_lessons ?? 0;
  const avgSecs = jobRecord?.avg_lesson_seconds ?? 0;
  const remaining = totalLessons - completedLessons - failedLessons - skippedLessons;
  const etaMin = avgSecs > 0 && remaining > 0 ? Math.ceil((avgSecs * remaining) / 60) : null;

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <CardTitle className="text-base text-emerald-800">Generar currículo completo con IA</CardTitle>
          {status === 'completed' && <Badge className="bg-green-100 text-green-700 ml-auto">Completado</Badge>}
          {status === 'failed' && <Badge className="bg-red-100 text-red-700 ml-auto">Falló</Badge>}
          {isRunning && <Badge className="bg-blue-100 text-blue-700 ml-auto animate-pulse">Generando...</Badge>}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Generación secuencial — 1 LLM call a la vez, con backoff automático anti rate-limit
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info de qué se generará */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-500" /> 3–5 unidades</span>
          <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-violet-500" /> 2–4 módulos</span>
          <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-amber-500" /> 3–5 lecciones + mini-eval</span>
          <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-orange-500" /> 7–14 actividades/lección</span>
        </div>

        {/* Alerta contenido existente */}
        {hasExisting && status === 'idle' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Esta materia ya tiene contenido.</p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={e => setOverwrite(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs">Sobreescribir todo el contenido existente</span>
              </label>
            </div>
          </div>
        )}

        {/* Barra de progreso */}
        {(status === 'generating' || status === 'completed') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-medium text-sm">{progress}% completado</span>
              <span>{completedLessons} / {totalLessons || '?'} lecciones</span>
            </div>
            <Progress value={progress} className="h-3" />

            {/* Estado actual */}
            {isRunning && (
              <div className="space-y-1.5">
                {genRecord?.current_module && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                    <span className="font-medium">Módulo:</span>
                    <span className="truncate">{genRecord.current_module}</span>
                  </div>
                )}
                {genRecord?.current_lesson && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 pl-5">
                    <span className="font-medium">Lección:</span>
                    <span className="truncate italic">{genRecord.current_lesson}</span>
                  </div>
                )}
              </div>
            )}

            {/* Stats detallados */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-green-700">{completedLessons}</div>
                <div className="text-xs text-green-600">Completadas</div>
              </div>
              {failedLessons > 0 && (
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-700">{failedLessons}</div>
                  <div className="text-xs text-red-600">Fallidas</div>
                </div>
              )}
              {skippedLessons > 0 && (
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-600">{skippedLessons}</div>
                  <div className="text-xs text-gray-500">Saltadas</div>
                </div>
              )}
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-700">{genRecord?.activities_created ?? 0}</div>
                <div className="text-xs text-blue-600">Actividades</div>
              </div>
            </div>

            {/* ETA */}
            {isRunning && etaMin !== null && etaMin > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Tiempo estimado restante: ~{etaMin} min</span>
                {avgSecs > 0 && <span className="text-gray-400">({avgSecs}s/lección promedio)</span>}
              </div>
            )}
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
            {(failedLessons > 0 || skippedLessons > 0) && (
              <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-700">
                {failedLessons > 0 && <span className="mr-3">⚠️ {failedLessons} lecciones fallaron (contenido básico aplicado)</span>}
                {skippedLessons > 0 && <span>⏭️ {skippedLessons} lecciones ya existían (omitidas)</span>}
              </div>
            )}
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">Error en la generación</p>
              <p className="text-xs mt-0.5">{genRecord?.error_message || 'Error desconocido'}</p>
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
              {showLogs ? 'Ocultar' : 'Ver'} log de generación ({logs.length} entradas)
            </button>
            {showLogs && (
              <div className="mt-2 max-h-64 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-0.5">
                {logs.map((l, i) => (
                  <p key={i} className={cn(
                    "leading-relaxed",
                    l.includes('✅') || l.includes('🎉') ? 'text-green-400' :
                    l.includes('❌') || l.includes('💥') ? 'text-red-400' :
                    l.includes('⚠️') || l.includes('Rate limit') ? 'text-amber-400' :
                    l.includes('Retry') || l.includes('backoff') ? 'text-yellow-300' :
                    l.includes('⏭️') || l.includes('SKIP') ? 'text-gray-400' :
                    l.includes('🚀') || l.includes('📐') || l.includes('🎯') ? 'text-cyan-400' :
                    l.includes('⏳') || l.includes('ETA') ? 'text-blue-300' :
                    'text-gray-300'
                  )}>{l}</p>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Botón principal */}
        {(status === 'idle' || status === 'failed') && (
          <Button
            onClick={handleGenerate}
            disabled={hasExisting && !overwrite}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {status === 'failed' ? 'Reintentar generación' : `Generar currículo de "${subject.name}"`}
          </Button>
        )}

        {status === 'generating' && !genRecord && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Iniciando generación...
          </div>
        )}

        {isRunning && (
          <div className="space-y-2">
            <Button onClick={handleStop} variant="destructive" className="w-full gap-2" size="sm">
              <XCircle className="w-4 h-4" />
              Detener generación
            </Button>
            <p className="text-xs text-center text-gray-400">
              Proceso secuencial con backoff anti rate-limit. Puedes cerrar esta página — el proceso continuará.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}