import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, XCircle, BookOpen, Layers, ClipboardList, Zap, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CurriculumGeneratorPanel({ subject, onComplete }) {
  const [status, setStatus] = useState('idle'); // idle | checking | generating | completed | failed
  const [genId, setGenId] = useState(null);
  const [genRecord, setGenRecord] = useState(null);
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
    setGenRecord(null);
    setHasExisting(false);
    setOverwrite(false);

    base44.entities.CourseUnit.filter({ subject_id: subject.id }).then(units => {
      setHasExisting(units.length > 0);
    }).catch(() => {});
  }, [subject?.id]);

  // Polling del progreso
  useEffect(() => {
    if (!genId || status === 'completed' || status === 'failed') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const records = await base44.entities.CurriculumGeneration.filter({ generation_id: genId });
        const rec = records[0];
        if (!rec) return;
        setGenRecord(rec);

        if (rec.status === 'completed') {
          setStatus('completed');
          clearInterval(pollRef.current);
          toast.success(`✅ Currículo generado: ${rec.units_created} unidades, ${rec.modules_created} módulos, ${rec.lessons_created} lecciones`);
          if (onComplete) onComplete();
        } else if (rec.status === 'failed') {
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
  }, [genId, status]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [genRecord?.logs, showLogs]);

  const handleStop = async () => {
    if (!genRecord?.id) return;
    await base44.entities.CurriculumGeneration.update(genRecord.id, {
      status: 'failed',
      error_message: 'Generación detenida manualmente por el administrador.'
    });
    setStatus('failed');
    clearInterval(pollRef.current);
    toast.warning('Generación detenida manualmente.');
  };

  const handleGenerate = async () => {
    if (!subject) return;
    setStatus('generating');
    setGenRecord(null);

    const res = await base44.functions.invoke('generateSubjectCurriculum', {
      subject_id: subject.id,
      overwrite,
    });

    const data = res.data;
    if (data?.success && data?.generation_id) {
      setGenId(data.generation_id);
      toast.info('Generación iniciada. Esto puede tardar varios minutos...');
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

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <CardTitle className="text-base text-emerald-800">Generar currículo completo con IA</CardTitle>
          {status === 'completed' && <Badge className="bg-green-100 text-green-700 ml-auto">Completado</Badge>}
          {status === 'failed' && <Badge className="bg-red-100 text-red-700 ml-auto">Falló</Badge>}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Genera automáticamente toda la estructura: unidades → módulos → lecciones → actividades
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info de qué se generará */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-500" /> 3–5 unidades</span>
          <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-violet-500" /> 2–4 módulos por unidad</span>
          <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-amber-500" /> 3–5 lecciones + mini-eval por módulo</span>
          <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-orange-500" /> 7–11 actividades por lección</span>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-medium">{progress}% completado</span>
              <span>
                {genRecord?.completed_steps ?? 0} / {genRecord?.total_steps ?? '?'} lecciones
              </span>
            </div>
            <Progress value={progress} className="h-3" />

            {/* Estado actual */}
            {isRunning && (
              <div className="space-y-1">
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

            {/* Stats */}
            {genRecord && (
              <div className="flex gap-4 text-xs text-gray-500 pt-1">
                <span>🏗️ {genRecord.units_created ?? 0} unidades</span>
                <span>📁 {genRecord.modules_created ?? 0} módulos</span>
                <span>📝 {genRecord.lessons_created ?? 0} lecciones</span>
                <span>⚡ {genRecord.activities_created ?? 0} actividades</span>
              </div>
            )}
          </div>
        )}

        {/* Resultado final */}
        {status === 'completed' && genRecord && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-semibold">¡Currículo generado exitosamente!</p>
              <p className="text-xs mt-0.5">
                {genRecord.units_created} unidades · {genRecord.modules_created} módulos · {genRecord.lessons_created} lecciones · {genRecord.activities_created} actividades
              </p>
            </div>
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
              {showLogs ? 'Ocultar' : 'Ver'} log de generación ({logs.length} eventos)
            </button>
            {showLogs && (
              <div className="mt-2 max-h-48 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-0.5">
                {logs.map((l, i) => (
                  <p key={i} className={cn(
                    "leading-relaxed",
                    l.includes('✅') || l.includes('🎉') ? 'text-green-400' :
                    l.includes('❌') || l.includes('💥') ? 'text-red-400' :
                    l.includes('⚠️') ? 'text-amber-400' :
                    l.includes('📐') || l.includes('🚀') ? 'text-cyan-400' :
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
            Generar currículo completo de "{subject.name}"
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
            <Button
              onClick={handleStop}
              variant="destructive"
              className="w-full gap-2"
              size="sm"
            >
              <XCircle className="w-4 h-4" />
              Detener generación
            </Button>
            <p className="text-xs text-center text-gray-400">
              Este proceso puede tomar 5–15 minutos. Puedes cerrar esta página, el proceso continuará en el servidor.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}