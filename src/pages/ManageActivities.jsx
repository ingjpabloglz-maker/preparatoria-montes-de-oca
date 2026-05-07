import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Zap, RefreshCw, CheckCircle2, AlertTriangle, Loader2, BookOpen, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import AdminGuard from '../components/auth/AdminGuard';

export default function ManageActivities() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [generatingId, setGeneratingId] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [results, setResults] = useState({});
  const queryClient = useQueryClient();

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
    staleTime: 5 * 60 * 1000,
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
              <h1 className="text-2xl font-bold text-gray-900">Generador de Actividades IA</h1>
              <p className="text-gray-500 text-sm">Genera 7-11 actividades por lección y 10-15 para mini evaluaciones con mezcla obligatoria de tipos</p>
            </div>
          </div>

          {/* Reglas info */}
          <Card className="border-0 shadow-sm bg-blue-50 border-blue-100">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">Reglas de generación activas:</p>
                  <ul className="list-disc ml-4 space-y-0.5 text-blue-700">
                    <li>Lecciones normales: 7–11 actividades | Mini-eval: 10–15 actividades</li>
                    <li>Distribución: 40% fácil, 40% medio, 20% difícil</li>
                    <li>Tipos obligatorios: multiple_select, drag_drop, step_by_step, multiple_choice, true_false, fill_blank</li>
                    <li>Score mínimo para aprobar: 60%</li>
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
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Elige una materia..." />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      Nivel {s.level} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Lecciones */}
          {selectedSubjectId && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Lecciones de "{selectedSubject?.name}" ({lessons.length})
                  </CardTitle>
                  {lessons.length > 0 && (
                    <Button
                      size="sm"
                      onClick={handleGenerateAll}
                      disabled={generatingAll}
                      className="gap-2"
                    >
                      {generatingAll
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
                        : <><RefreshCw className="w-4 h-4" />Regenerar todas</>
                      }
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {lessons.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No hay lecciones en esta materia.</p>
                ) : (
                  <div className="space-y-3">
                    {lessons.map(lesson => {
                      const actCount = activitiesCounts[lesson.id] ?? null;
                      const result = results[lesson.id];
                      const isGenerating = generatingId === lesson.id;
                      const needsMore = actCount !== null && (lesson.is_mini_eval ? actCount < 10 : actCount < 7);

                      return (
                        <div key={lesson.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                          needsMore ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'
                        }`}>
                          {/* Icono */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            lesson.is_mini_eval ? 'bg-amber-100' : 'bg-blue-100'
                          }`}>
                            {lesson.is_mini_eval
                              ? <ClipboardList className="w-4 h-4 text-amber-600" />
                              : <BookOpen className="w-4 h-4 text-blue-600" />
                            }
                          </div>

                          {/* Info */}
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

                          {/* Botón */}
                          <Button
                            size="sm"
                            variant={needsMore ? 'default' : 'outline'}
                            onClick={() => handleGenerate(lesson, true)}
                            disabled={isGenerating || generatingAll}
                            className="flex-shrink-0 gap-2"
                          >
                            {isGenerating
                              ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
                              : <><Zap className="w-4 h-4" />Regenerar</>
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