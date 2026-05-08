import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  FileText, Wand2, Upload, ChevronDown, ChevronUp, Plus, Trash2,
  Loader2, CheckCircle2, BookOpen, Layers, ClipboardList, Save, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

// ─── Vista árbol del temario ──────────────────────────────────────────────────
function SyllabusTree({ units, onChange }) {
  const updateUnit = (uIdx, patch) => {
    const next = [...units];
    next[uIdx] = { ...next[uIdx], ...patch };
    onChange(next);
  };
  const updateModule = (uIdx, mIdx, patch) => {
    const next = [...units];
    next[uIdx].modules = [...(next[uIdx].modules || [])];
    next[uIdx].modules[mIdx] = { ...next[uIdx].modules[mIdx], ...patch };
    onChange(next);
  };
  const updateLesson = (uIdx, mIdx, lIdx, patch) => {
    const next = [...units];
    next[uIdx].modules[mIdx].lessons = [...(next[uIdx].modules[mIdx].lessons || [])];
    next[uIdx].modules[mIdx].lessons[lIdx] = { ...next[uIdx].modules[mIdx].lessons[lIdx], ...patch };
    onChange(next);
  };
  const removeUnit = (uIdx) => onChange(units.filter((_, i) => i !== uIdx).map((u, i) => ({ ...u, order: i + 1 })));
  const removeModule = (uIdx, mIdx) => {
    const next = [...units];
    next[uIdx].modules = next[uIdx].modules.filter((_, i) => i !== mIdx).map((m, i) => ({ ...m, order: i + 1 }));
    onChange(next);
  };
  const removeLesson = (uIdx, mIdx, lIdx) => {
    const next = [...units];
    next[uIdx].modules[mIdx].lessons = next[uIdx].modules[mIdx].lessons.filter((_, i) => i !== lIdx).map((l, i) => ({ ...l, order: i + 1 }));
    onChange(next);
  };
  const addUnit = () => onChange([...units, { title: 'Nueva Unidad', order: units.length + 1, modules: [] }]);
  const addModule = (uIdx) => {
    const next = [...units];
    const mods = next[uIdx].modules || [];
    next[uIdx].modules = [...mods, { title: 'Nuevo Módulo', order: mods.length + 1, lessons: [] }];
    onChange(next);
  };
  const addLesson = (uIdx, mIdx) => {
    const next = [...units];
    const lsns = next[uIdx].modules[mIdx].lessons || [];
    next[uIdx].modules[mIdx].lessons = [...lsns, { topic: 'Nuevo tema', order: lsns.length + 1, difficulty: 'medium', keywords: [], is_mini_eval: false }];
    onChange(next);
  };

  const diffColors = { easy: 'bg-green-100 text-green-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-3">
      {units.map((unit, uIdx) => (
        <div key={uIdx} className="border border-blue-200 rounded-xl bg-blue-50/40">
          {/* Unidad */}
          <div className="flex items-center gap-2 p-3">
            <Layers className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <Input
              value={unit.title}
              onChange={e => updateUnit(uIdx, { title: e.target.value })}
              className="flex-1 h-7 text-sm font-semibold bg-transparent border-0 border-b border-blue-200 rounded-none px-1 focus-visible:ring-0"
              placeholder="Título de unidad"
            />
            <Badge className="text-xs bg-blue-100 text-blue-700">Unidad {unit.order}</Badge>
            <button onClick={() => removeUnit(uIdx)} className="text-red-400 hover:text-red-600 ml-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Módulos */}
          <div className="pl-6 pr-3 pb-3 space-y-2">
            {(unit.modules || []).map((mod, mIdx) => (
              <div key={mIdx} className="border border-violet-200 rounded-lg bg-white">
                <div className="flex items-center gap-2 p-2.5">
                  <BookOpen className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                  <Input
                    value={mod.title}
                    onChange={e => updateModule(uIdx, mIdx, { title: e.target.value })}
                    className="flex-1 h-6 text-xs font-medium bg-transparent border-0 border-b border-violet-200 rounded-none px-1 focus-visible:ring-0"
                    placeholder="Título de módulo"
                  />
                  <Badge className="text-xs bg-violet-100 text-violet-700">Módulo {mod.order}</Badge>
                  <button onClick={() => removeModule(uIdx, mIdx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Lecciones */}
                <div className="pl-6 pr-2.5 pb-2.5 space-y-1.5">
                  {(mod.lessons || []).map((lesson, lIdx) => (
                    <div key={lIdx} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${lesson.is_mini_eval ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      {lesson.is_mini_eval
                        ? <ClipboardList className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        : <span className="text-gray-400 w-3 text-center flex-shrink-0">{lesson.order}</span>
                      }
                      <Input
                        value={lesson.topic}
                        onChange={e => updateLesson(uIdx, mIdx, lIdx, { topic: e.target.value })}
                        className="flex-1 h-5 text-xs bg-transparent border-0 border-b border-gray-200 rounded-none px-0.5 focus-visible:ring-0"
                        placeholder="Tema"
                      />
                      {!lesson.is_mini_eval && (
                        <select
                          value={lesson.difficulty || 'medium'}
                          onChange={e => updateLesson(uIdx, mIdx, lIdx, { difficulty: e.target.value })}
                          className={`text-xs px-1.5 py-0.5 rounded border-0 font-medium ${diffColors[lesson.difficulty || 'medium']}`}
                        >
                          <option value="easy">Fácil</option>
                          <option value="medium">Medio</option>
                          <option value="hard">Difícil</option>
                        </select>
                      )}
                      <label className="flex items-center gap-1 cursor-pointer text-xs text-gray-500 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={lesson.is_mini_eval || false}
                          onChange={e => updateLesson(uIdx, mIdx, lIdx, { is_mini_eval: e.target.checked })}
                          className="w-3 h-3"
                        />
                        Eval
                      </label>
                      <button onClick={() => removeLesson(uIdx, mIdx, lIdx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addLesson(uIdx, mIdx)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 mt-1"
                  >
                    <Plus className="w-3 h-3" /> Agregar lección
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => addModule(uIdx)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 mt-1"
            >
              <Plus className="w-3 h-3" /> Agregar módulo
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={addUnit}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl px-4 py-2.5 w-full justify-center transition-colors"
      >
        <Plus className="w-4 h-4" /> Agregar Unidad
      </button>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function SyllabusEditor({ subject, onSyllabusReady }) {
  const [tab, setTab] = useState('text'); // text | manual | json
  const [rawText, setRawText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [units, setUnits] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingSyllabus, setExistingSyllabus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    if (!subject) return;
    setLoading(true);
    setUnits([]);
    setExistingSyllabus(null);
    setRawText('');
    setJsonText('');
    setShowEditor(false);

    base44.entities.SubjectSyllabus.filter({ subject_id: subject.id, is_active: true }).then(results => {
      if (results[0]) {
        setExistingSyllabus(results[0]);
        setUnits(results[0].units || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [subject?.id]);

  const handleParseText = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    const res = await base44.functions.invoke('parseSyllabusText', {
      text: rawText,
      subject_name: subject?.name || '',
    });
    const data = res.data;
    if (data?.success) {
      setUnits(data.structure.units);
      setTab('manual');
      toast.success(`Temario convertido: ${data.structure.units.length} unidades`);
    } else {
      toast.error(`Error al parsear: ${data?.error}`);
    }
    setParsing(false);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const u = parsed.units || parsed;
      if (!Array.isArray(u)) throw new Error('Se esperaba un array de unidades o { units: [...] }');
      setUnits(u);
      setTab('manual');
      toast.success('JSON importado correctamente');
    } catch (e) {
      toast.error(`JSON inválido: ${e.message}`);
    }
  };

  const handleSave = async () => {
    if (!units.length) { toast.error('El temario está vacío'); return; }
    setSaving(true);

    const newVersion = (existingSyllabus?.version || 0) + 1;

    // Desactivar versión anterior
    if (existingSyllabus) {
      await base44.entities.SubjectSyllabus.update(existingSyllabus.id, { is_active: false });
    }

    const saved = await base44.entities.SubjectSyllabus.create({
      subject_id: subject.id,
      version: newVersion,
      is_active: true,
      units,
      raw_text: rawText || null,
      created_by: (await base44.auth.me())?.email,
    });

    setExistingSyllabus(saved);
    setSaving(false);
    setShowEditor(false);
    toast.success(`Temario v${newVersion} guardado`);
    if (onSyllabusReady) onSyllabusReady(saved);
  };

  if (!subject) return null;

  const totalLessons = units.reduce((acc, u) => acc + (u.modules || []).reduce((a, m) => a + (m.lessons || []).length, 0), 0);
  const totalModules = units.reduce((acc, u) => acc + (u.modules || []).length, 0);

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
      <CardHeader>
        <button className="flex items-center justify-between w-full text-left" onClick={() => setShowEditor(v => !v)}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base text-blue-800">Temario de la materia</CardTitle>
            {existingSyllabus && (
              <Badge className="bg-green-100 text-green-700 text-xs">v{existingSyllabus.version} activo</Badge>
            )}
            {!existingSyllabus && !loading && (
              <Badge className="bg-amber-100 text-amber-700 text-xs">Sin temario</Badge>
            )}
          </div>
          {showEditor ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {existingSyllabus && (
          <p className="text-xs text-gray-500 mt-1">
            {units.length} unidades · {totalModules} módulos · {totalLessons} lecciones
          </p>
        )}
        {!existingSyllabus && !loading && (
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Define el temario antes de generar el currículo
          </p>
        )}
      </CardHeader>

      {showEditor && (
        <CardContent className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'text', label: 'Pegar texto', icon: FileText },
              { key: 'manual', label: 'Editor', icon: Layers },
              { key: 'json', label: 'Importar JSON', icon: Upload },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-blue-500 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Tab: Pegar texto */}
          {tab === 'text' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Pega el temario en cualquier formato (texto plano, con viñetas, numerado). La IA lo convertirá a estructura.
              </p>
              <Textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Ejemplo:\nUnidad 1: Números\n  • Números enteros\n    - Números negativos\n    - Valor absoluto\n  • Operaciones básicas\n    - Suma y resta\n    - Multiplicación\n\nUnidad 2: Álgebra\n  • Expresiones algebraicas\n  ...`}
                className="min-h-[200px] font-mono text-xs"
              />
              <Button onClick={handleParseText} disabled={parsing || !rawText.trim()} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                {parsing ? <><Loader2 className="w-4 h-4 animate-spin" />Convirtiendo...</> : <><Wand2 className="w-4 h-4" />Convertir con IA</>}
              </Button>
            </div>
          )}

          {/* Tab: Editor manual */}
          {tab === 'manual' && (
            <div className="space-y-3">
              {units.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  El temario está vacío. Agrega una unidad o usa "Pegar texto" para importar.
                </p>
              ) : (
                <SyllabusTree units={units} onChange={setUnits} />
              )}
              {units.length === 0 && (
                <button
                  onClick={() => setUnits([{ title: 'Unidad 1', order: 1, modules: [] }])}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl px-4 py-3 w-full justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" /> Crear primera unidad
                </button>
              )}
            </div>
          )}

          {/* Tab: Importar JSON */}
          {tab === 'json' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Pega un JSON con formato <code className="bg-gray-100 px-1 rounded">{'{ "units": [...] }'}</code> o directamente un array de unidades.
              </p>
              <Textarea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                placeholder='{ "units": [{ "title": "...", "order": 1, "modules": [...] }] }'
                className="min-h-[160px] font-mono text-xs"
              />
              <Button onClick={handleImportJson} disabled={!jsonText.trim()} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" /> Importar
              </Button>
            </div>
          )}

          {/* Preview stats + Guardar */}
          {units.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-500 flex gap-3">
                <span>📦 {units.length} unidades</span>
                <span>📁 {totalModules} módulos</span>
                <span>📝 {totalLessons} lecciones</span>
              </div>
              <Button onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar temario</>}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}