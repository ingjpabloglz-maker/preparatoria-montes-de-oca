import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

const EMPTY = {
  user_email: '',
  subject_id: '',
  type: '',
  date_from: '',
  date_to: '',
  score_min: '',
  score_max: '',
  only_failed: false,
  requires_manual_review: undefined,
  requires_reinforcement: false,
};

export default function AuditFilters({ subjects, onFilter }) {
  const [f, setF] = useState(EMPTY);

  function set(key, value) {
    setF(prev => ({ ...prev, [key]: value }));
  }

  function apply() {
    const out = {};
    if (f.user_email.trim()) out.user_email = f.user_email.trim();
    if (f.subject_id && f.subject_id !== 'all') out.subject_id = f.subject_id;
    if (f.type && f.type !== 'all') out.type = f.type;
    if (f.date_from) out.date_from = f.date_from;
    if (f.date_to) out.date_to = f.date_to;
    if (f.score_min !== '') out.score_min = Number(f.score_min);
    if (f.score_max !== '') out.score_max = Number(f.score_max);
    if (f.only_failed) out.only_failed = true;
    if (f.requires_manual_review === 'yes') out.requires_manual_review = true;
    if (f.requires_reinforcement) out.requires_reinforcement = true;
    onFilter(out);
  }

  function clear() {
    setF(EMPTY);
    onFilter({});
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="w-4 h-4" /> Filtros
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Alumno (email o nombre)</Label>
          <Input
            placeholder="buscar alumno..."
            value={f.user_email}
            onChange={e => set('user_email', e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Materia</Label>
          <Select value={f.subject_id} onValueChange={v => set('subject_id', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Tipo</Label>
          <Select value={f.type} onValueChange={v => set('type', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="lesson">Lección</SelectItem>
              <SelectItem value="mini_eval">Mini Evaluación</SelectItem>
              <SelectItem value="final_exam">Examen Final</SelectItem>
              <SelectItem value="surprise_exam">Examen Sorpresa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Fecha desde</Label>
          <Input type="date" value={f.date_from} onChange={e => set('date_from', e.target.value)} className="h-8 text-sm" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Fecha hasta</Label>
          <Input type="date" value={f.date_to} onChange={e => set('date_to', e.target.value)} className="h-8 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Score mín.</Label>
            <Input type="number" min={0} max={100} placeholder="0" value={f.score_min} onChange={e => set('score_min', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Score máx.</Label>
            <Input type="number" min={0} max={100} placeholder="100" value={f.score_max} onChange={e => set('score_max', e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Estado especial</Label>
          <Select value={f.requires_manual_review} onValueChange={v => set('requires_manual_review', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Solo revisión pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.only_failed} onChange={e => set('only_failed', e.target.checked)} />
            Solo reprobados
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.requires_reinforcement} onChange={e => set('requires_reinforcement', e.target.checked)} />
            Solo con refuerzo
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={apply} className="flex-1">Aplicar</Button>
          <Button size="sm" variant="outline" onClick={clear}><X className="w-3 h-3" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}