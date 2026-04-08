import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

export default function AuditFilters({ subjects, onFilter }) {
  const [email, setEmail] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState('');
  const [pendingReview, setPendingReview] = useState('');

  function apply() {
    const f = {};
    if (email.trim()) f.user_email = email.trim();
    if (subjectId && subjectId !== 'all') f.subject_id = subjectId;
    if (type && type !== 'all') f.type = type;
    if (pendingReview === 'yes') f.requires_manual_review = true;
    onFilter(f);
  }

  function clear() {
    setEmail('');
    setSubjectId('');
    setType('');
    setPendingReview('');
    onFilter({});
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="w-4 h-4" />
          Filtros
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Email alumno</Label>
          <Input
            placeholder="alumno@ejemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Materia</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {subjects.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
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
          <Label className="text-xs text-gray-500">Revisión pendiente</Label>
          <Select value={pendingReview} onValueChange={setPendingReview}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="yes">Solo pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={apply} className="flex-1">Aplicar</Button>
          <Button size="sm" variant="outline" onClick={clear}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}