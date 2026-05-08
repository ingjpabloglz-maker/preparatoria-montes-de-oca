import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Zap, RefreshCw, CheckCircle2, AlertTriangle, Loader2, BookOpen, ClipboardList, Sparkles, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import AdminGuard from '../components/auth/AdminGuard';

export default function ManageActivities() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [generatingId, setGeneratingId] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [results, setResults] = useState({});
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateForm, setGenerateForm] = useState({ module_id: '', topic: '', is_mini_eval: false });
  const [generatingNew, setGeneratingNew] = useState(false);
  const queryClient = useQueryClient();

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['modulesForSubject', selectedSubjectId],
    queryFn: () => base44.entities.CourseModule.filter({ subject_id: selectedSubjectId }, 'order'),
    enabled: !!selectedSubjectId,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessonsForSubject', selectedSubjectId],
    queryFn: () => base44.entities.CourseLesson.filter({ subject_id: selectedSubjectId }, 'order'),
    enabled: !!selectedSubjectId,
  });

  const { data: activitiesCounts = {} } = useQuery({
    queryKey: ['activitiesCount', selectedSubjectId],
    queryFn: async () => {
      if (!lessons.length) return {};
      const counts = {};
      for (const lesson of lessons) {
        const acts = await base44.entities.CourseActivity.filter({ lesson_id: lesson.id });
        counts[lesson.id] = acts.length;
      }
      return counts;
    },
    enabled: lessons.length > 0,
  });

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  // Regenerar solo actividades de una lección existente
  const handleGenerate = async (lesson, replaceExisting = true) => {
    setGeneratingId(lesson.id);
    setResults(prev => ({ ...prev, [lesson.id]: { status: 'loading' } }));

    const res = await base44.functions.invoke('generateLessonActivities', {
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      lesson_explanation: lesson.explanation || '',
      subject_name: selectedSubject?.name || '',
      is_mini_eval: lesson.is_mini_eval || false,
      replace_existing: replaceExisting,
    });

    const data = res.data;
    if (data?.status === 'ok') {
      setResults(prev => ({ ...prev, [lesson.id]: { status: 'ok', count: data.activities_created } }));
      toast.success(`✅ ${lesson.title}: ${data.activities_created} actividades generadas`);
      queryClient.invalidateQueries(['activitiesCount', selectedSubjectId]);
    } else {
      setResults(prev => ({ ...prev, [lesson.id]: { status: 'error', msg: data?.error } }));
      toast.error(`Error en "${lesson.title}": ${data?.error}`);
    }
    setGeneratingId(null);
  };

  const handleGenerateAll = async () => {
    if (!lessons.length) return;
    setGeneratingAll(true);
    for (const lesson of lessons) {
      await handleGenerate(lesson, true);
    }
    setGeneratingAll(false);
    toast.success('¡Todas las lecciones procesadas!');
  };

  // Generar lección COMPLETA (lección + actividades)
  const handleGenerateComplete = async () => {
    if (!generateForm.module_id || !generateForm.topic.trim()) {
      toast.error('Selecciona un módulo e ingresa el tema');
      return;
    }
    setGeneratingNew(true);

    const selectedModule = modules.find(m => m.id === generateForm.module_id);
    const lessonsInModule = lessons.filter(l => l.module_id === generateForm.module_id);
    const nextOrder = lessonsInModule.length + 1;

    const res = await base44.functions.invoke('generateLessonWithActivities', {
      module_id: generateForm.module_id,
      subject_id: selectedSubjectId,
      subject_name: selectedSubject?.name || '',
      topic: generateForm.topic.trim(),
      is_mini_eval: generateForm.is_mini_eval,
      lesson_order: nextOrder,
    });

    const data = res.data;
    if (data?.success) {
      toast.success(`✅ Lección "${data.lesson.title}" creada con ${data.activities_count} actividades`);
      setGenerateForm({ module_id: '', topic: '', is_mini_eval: false });
      setShowGenerateForm(false);
      queryClient.invalidateQueries(['lessonsForSubject', selectedSubjectId]);
      queryClient.invalidateQueries(['activitiesCount', selectedSubjectId]);
    } else {
      toast.error(`Error: ${data?.error || 'Error desconocido'}`);
    }
    setGeneratingNew(false);
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.location.href = createPageUrl('AdminDashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Gestor de Lecciones y Actividades IA</h1>
              <p className="text-gray-500 text-sm">Genera lecciones completas con actividades, o regenera actividades de lecciones existentes</p>
            </div>
          </div>

          {/* Info */}
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">Reglas de generación activas:</p>
                  <ul className="list-disc ml-4 space-y-0.5 text-blue-700">
                    <li>Lecciones normales: 7–11 actividades | Mini-eval: 10–15 actividades</li>
                    <li>Distribución: 40% fácil, 40% medio, 20% difícil</li>
                    <li>Tipos obligatorios: multiple_select, drag_drop, step_by_step, multiple_choice, true_false, fill_blank</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selector de materia */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Seleccionar Materia</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedSubjectId} onValueChange={v => { setSelectedSubjectId(v); setShowGenerateForm(false); setGenerateForm({ module_id: '', topic: '', is_mini_eval: false }); }}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Elige una materia..." />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>Nivel {s.level} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Panel: Generar lección completa con IA */}
          {selectedSubjectId && (
            <Card className="border-0 shadow-sm border-l-4 border-l-violet-500">
              <CardHeader>
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setShowGenerateForm(v => !v)}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                    <CardTitle className="text-base text-violet-800">Generar lección completa con IA</CardTitle>
                  </div>
                  {showGenerateForm ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
              </CardHeader>
              {showGenerateForm && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Módulo destino</Label>
                    <Select value={generateForm.module_id} onValueChange={v => setGenerateForm(f => ({ ...f, module_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un módulo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {modules.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Tema de la lección</Label>
                    <Input
                      placeholder="Ej: Fracciones equivalentes, Potencias de base 10..."
                      value={generateForm.topic}
                      onChange={e => setGenerateForm(f => ({ ...f, topic: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium text-gray-700">Tipo:</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGenerateForm(f => ({ ...f, is_mini_eval: false }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${!generateForm.is_mini_eval ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        <BookOpen className="w-3.5 h-3.5 inline mr-1" />Lección normal
                      </button>
                      <button
                        onClick={() => setGenerateForm(f => ({ ...f, is_mini_eval: true }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${generateForm.is_mini_eval ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        <ClipboardList className="w-3.5 h-3.5 inline mr-1" />Mini evaluación
                      </button>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateComplete}
                    disabled={generatingNew || !generateForm.module_id || !generateForm.topic.trim()}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
                  >
                    {generatingNew
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Generando lección y actividades...</>
                      : <><PlusCircle className="w-4 h-4" />Generar lección completa</>
                    }
                  </Button>
                  {generatingNew && (
                    <p className="text-xs text-gray-500 text-center">Esto puede tardar 30–60 segundos. No cierres la página.</p>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Lecciones existentes */}
          {selectedSubjectId && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Lecciones existentes en "{selectedSubject?.name}" ({lessons.length})
                  </CardTitle>
                  {lessons.length > 0 && (
                    <Button size="sm" onClick={handleGenerateAll} disabled={generatingAll} className="gap-2">
                      {generatingAll
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
                        : <><RefreshCw className="w-4 h-4" />Regenerar todas las actividades</>
                      }
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {lessons.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No hay lecciones. Usa el panel de arriba para generar la primera.</p>
                ) : (
                  <div className="space-y-3">
                    {lessons.map(lesson => {
                      const actCount = activitiesCounts[lesson.id] ?? null;
                      const result = results[lesson.id];
                      const isGenerating = generatingId === lesson.id;
                      const needsMore = actCount !== null && (lesson.is_mini_eval ? actCount < 10 : actCount < 7);

                      return (
                        <div key={lesson.id} className={`flex items-center gap-3 p-3 rounded-xl border ${needsMore ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${lesson.is_mini_eval ? 'bg-amber-100' : 'bg-blue-100'}`}>
                            {lesson.is_mini_eval
                              ? <ClipboardList className="w-4 h-4 text-amber-600" />
                              : <BookOpen className="w-4 h-4 text-blue-600" />
                            }
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{lesson.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">
                                {lesson.is_mini_eval ? 'Mini Evaluación' : 'Lección'}
                              </Badge>
                              {actCount !== null && (
                                <span className={`text-xs ${needsMore ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                                  {actCount} actividades {needsMore && '⚠️ insuficientes'}
                                </span>
                              )}
                              {result?.status === 'ok' && (
                                <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />{result.count} generadas
                                </span>
                              )}
                              {result?.status === 'error' && (
                                <span className="text-xs text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />{result.msg}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant={needsMore ? 'default' : 'outline'}
                            onClick={() => handleGenerate(lesson, true)}
                            disabled={isGenerating || generatingAll}
                            className="flex-shrink-0 gap-2"
                          >
                            {isGenerating
                              ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
                              : <><RefreshCw className="w-4 h-4" />Regenerar actividades</>
                            }
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}