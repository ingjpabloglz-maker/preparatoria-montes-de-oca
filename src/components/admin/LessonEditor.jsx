import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ClipboardList, ChevronDown, ChevronUp, Pencil, Save, X, Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Editor de actividades de una lección ─────────────────────────────────────
function ActivityEditor({ lessonId, onClose }) {
  const queryClient = useQueryClient();
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', lessonId],
    queryFn: () => base44.entities.CourseActivity.filter({ lesson_id: lessonId }, 'order'),
  });

  const [editing, setEditing] = useState({}); // { [actId]: {...fields} }
  const [saving, setSaving] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const startEdit = (act) => setEditing(prev => ({ ...prev, [act.id]: { ...act } }));
  const cancelEdit = (id) => setEditing(prev => { const next = { ...prev }; delete next[id]; return next; });

  const handleSave = async (id) => {
    setSaving(id);
    await base44.entities.CourseActivity.update(id, editing[id]);
    cancelEdit(id);
    queryClient.invalidateQueries(['activities', lessonId]);
    toast.success('Actividad guardada');
    setSaving(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    setDeleting(id);
    await base44.entities.CourseActivity.delete(id);
    queryClient.invalidateQueries(['activities', lessonId]);
    toast.success('Actividad eliminada');
    setDeleting(null);
  };

  const handleFieldChange = (id, field, value) => {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleOptionsChange = (id, value) => {
    // Opciones separadas por salto de línea
    const opts = value.split('\n').map(o => o.trim()).filter(Boolean);
    handleFieldChange(id, 'options', opts);
  };

  if (isLoading) return <div className="flex items-center gap-2 py-4 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Cargando actividades...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{activities.length} actividades</p>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {activities.map((act) => {
        const isEditing = !!editing[act.id];
        const data = editing[act.id] || act;
        return (
          <div key={act.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs capitalize">{act.type?.replace('_', ' ')}</Badge>
              <div className="flex gap-1">
                {!isEditing && (
                  <Button size="sm" variant="ghost" onClick={() => startEdit(act)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleDelete(act.id)} disabled={deleting === act.id} className="text-red-500 hover:text-red-700">
                  {deleting === act.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Pregunta</label>
                  <Textarea rows={2} value={data.question} onChange={e => handleFieldChange(act.id, 'question', e.target.value)} className="text-sm" />
                </div>
                {act.type === 'multiple_choice' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Opciones (una por línea)</label>
                    <Textarea rows={4} value={(data.options || []).join('\n')} onChange={e => handleOptionsChange(act.id, e.target.value)} className="text-sm font-mono" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Respuesta correcta</label>
                  <Input value={data.correct_answer} onChange={e => handleFieldChange(act.id, 'correct_answer', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Explicación</label>
                  <Textarea rows={2} value={data.explanation || ''} onChange={e => handleFieldChange(act.id, 'explanation', e.target.value)} className="text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSave(act.id)} disabled={saving === act.id} className="gap-1.5">
                    {saving === act.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelEdit(act.id)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-800">{act.question}</p>
                {act.options?.length > 0 && (
                  <ul className="text-xs text-gray-500 pl-3 space-y-0.5">
                    {act.options.map((o, i) => (
                      <li key={i} className={o === act.correct_answer ? 'text-green-700 font-medium' : ''}>{o}</li>
                    ))}
                  </ul>
                )}
                {act.type !== 'multiple_choice' && (
                  <p className="text-xs text-green-700 font-medium">✓ {act.correct_answer}</p>
                )}
                {act.explanation && <p className="text-xs text-gray-400 italic">{act.explanation}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Editor de una lección (título + explicación + actividades) ────────────────
function LessonEditPanel({ lesson, subjectName, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('content'); // 'content' | 'activities'
  const [title, setTitle] = useState(lesson.title || '');
  const [explanation, setExplanation] = useState(() => {
    const ex = lesson.explanation;
    if (!ex) return { intro: '', key_points: [], examples: [], summary: '' };
    if (typeof ex === 'string') return { intro: ex, key_points: [], examples: [], summary: '' };
    return {
      intro: ex.intro || '',
      key_points: ex.key_points || [],
      examples: ex.examples || [],
      summary: ex.summary || '',
    };
  });
  const [saving, setSaving] = useState(false);

  const handleSaveLesson = async () => {
    setSaving(true);
    await base44.entities.CourseLesson.update(lesson.id, { title, explanation });
    queryClient.invalidateQueries(['lessonsForSubject', lesson.subject_id]);
    toast.success('Lección guardada');
    setSaving(false);
    if (onSaved) onSaved();
  };

  const updateKP = (i, field, value) => {
    const kps = [...explanation.key_points];
    kps[i] = { ...kps[i], [field]: value };
    setExplanation(prev => ({ ...prev, key_points: kps }));
  };

  const addKP = () => setExplanation(prev => ({ ...prev, key_points: [...prev.key_points, { title: '', content: '', example: '' }] }));
  const removeKP = (i) => setExplanation(prev => ({ ...prev, key_points: prev.key_points.filter((_, idx) => idx !== i) }));

  const updateEx = (i, field, value) => {
    const exs = [...explanation.examples];
    exs[i] = { ...exs[i], [field]: value };
    setExplanation(prev => ({ ...prev, examples: exs }));
  };
  const addEx = () => setExplanation(prev => ({ ...prev, examples: [...prev.examples, { question: '', solution: '' }] }));
  const removeEx = (i) => setExplanation(prev => ({ ...prev, examples: prev.examples.filter((_, idx) => idx !== i) }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {lesson.is_mini_eval
              ? <ClipboardList className="w-4 h-4 text-amber-600" />
              : <BookOpen className="w-4 h-4 text-blue-600" />}
            <span className="font-semibold text-gray-800 truncate max-w-xs">{lesson.title}</span>
            <Badge variant="outline" className="text-xs">{lesson.is_mini_eval ? 'Mini eval' : 'Lección'}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0">
          {['content', 'activities'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'content' ? 'Contenido' : 'Actividades'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'content' && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Título</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Introducción</label>
                <Textarea rows={3} value={explanation.intro} onChange={e => setExplanation(p => ({ ...p, intro: e.target.value }))} className="text-sm" />
              </div>

              {/* Key points */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Puntos clave</label>
                  <Button size="sm" variant="ghost" onClick={addKP} className="gap-1 text-xs h-7"><Plus className="w-3 h-3" />Añadir</Button>
                </div>
                <div className="space-y-3">
                  {explanation.key_points.map((kp, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Punto {i + 1}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeKP(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <Input placeholder="Título" value={kp.title} onChange={e => updateKP(i, 'title', e.target.value)} className="text-xs" />
                      <Textarea rows={2} placeholder="Contenido" value={kp.content} onChange={e => updateKP(i, 'content', e.target.value)} className="text-xs" />
                      <Input placeholder="Ejemplo" value={kp.example || ''} onChange={e => updateKP(i, 'example', e.target.value)} className="text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Examples */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Ejemplos</label>
                  <Button size="sm" variant="ghost" onClick={addEx} className="gap-1 text-xs h-7"><Plus className="w-3 h-3" />Añadir</Button>
                </div>
                <div className="space-y-3">
                  {explanation.examples.map((ex, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Ejemplo {i + 1}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeEx(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <Textarea rows={2} placeholder="Pregunta / situación" value={ex.question} onChange={e => updateEx(i, 'question', e.target.value)} className="text-xs" />
                      <Textarea rows={2} placeholder="Solución" value={ex.solution} onChange={e => updateEx(i, 'solution', e.target.value)} className="text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Resumen</label>
                <Textarea rows={2} value={explanation.summary} onChange={e => setExplanation(p => ({ ...p, summary: e.target.value }))} className="text-sm" />
              </div>
            </>
          )}

          {tab === 'activities' && (
            <ActivityEditor lessonId={lesson.id} onClose={() => setTab('content')} />
          )}
        </div>

        {/* Footer */}
        {tab === 'content' && (
          <div className="p-4 border-t flex gap-2 flex-shrink-0">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-2" onClick={handleSaveLesson} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar lección
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel principal: lista lecciones con botón editar ─────────────────────────
export default function LessonEditor({ subject, lessons, activitiesCounts }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [deletingLesson, setDeletingLesson] = useState(null);

  const handleDeleteLesson = async (lesson) => {
    if (!confirm(`¿Eliminar la lección "${lesson.title}" y todas sus actividades?`)) return;
    setDeletingLesson(lesson.id);
    await base44.functions.invoke('deleteLesson', { lesson_id: lesson.id });
    queryClient.invalidateQueries(['lessonsForSubject', lesson.subject_id]);
    queryClient.invalidateQueries(['activitiesCount', lesson.subject_id]);
    toast.success(`Lección "${lesson.title}" eliminada`);
    setDeletingLesson(null);
  };

  if (!subject) return null;

  return (
    <>
      {editingLesson && (
        <LessonEditPanel
          lesson={editingLesson}
          subjectName={subject.name}
          onClose={() => setEditingLesson(null)}
          onSaved={() => setEditingLesson(null)}
        />
      )}

      <Card className="border-0 shadow-sm border-l-4 border-l-blue-400">
        <CardHeader>
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setOpen(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base text-blue-800">Editar lecciones generadas</CardTitle>
              <Badge variant="outline" className="text-xs">{lessons.length}</Badge>
            </div>
            {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
        </CardHeader>

        {open && (
          <CardContent>
            {lessons.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No hay lecciones generadas aún.</p>
            ) : (
              <div className="space-y-2">
                {lessons.map(lesson => {
                  const actCount = activitiesCounts[lesson.id] ?? null;
                  return (
                    <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${lesson.is_mini_eval ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        {lesson.is_mini_eval
                          ? <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
                          : <BookOpen className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{lesson.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">{lesson.is_mini_eval ? 'Mini eval' : 'Lección'}</Badge>
                          {actCount !== null && (
                            <span className={`text-xs ${actCount < 4 ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                              {actCount} actividades {actCount < 4 && '⚠️'}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditingLesson(lesson)} className="gap-1.5 flex-shrink-0">
                        <Pencil className="w-3.5 h-3.5" />Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteLesson(lesson)} disabled={deletingLesson === lesson.id} className="text-red-500 hover:text-red-700 flex-shrink-0">
                        {deletingLesson === lesson.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
}