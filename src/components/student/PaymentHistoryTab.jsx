import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from
"@/components/ui/table";
import { CreditCard, Search, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const FOLIO_TYPE_MAP = {
  level_advance: { label: 'Inscripción / Avance Nivel', cls: 'bg-blue-100 text-blue-800' },
  time_unlock: { label: 'Colegiatura', cls: 'bg-green-100 text-green-800' },
  extraordinary_test: { label: 'Examen Extraordinario', cls: 'bg-amber-100 text-amber-800' }
};

const STATUS_MAP = {
  used: { label: 'Usado', cls: 'bg-green-100 text-green-800' },
  available: { label: 'Disponible', cls: 'bg-gray-100 text-gray-600' },
  expired: { label: 'Expirado', cls: 'bg-red-100 text-red-700' }
};

const FILTER_OPTIONS = [
{ key: 'all', label: 'Todos' },
{ key: 'time_unlock', label: 'Colegiaturas' },
{ key: 'extraordinary_test', label: 'Extraordinarios' },
{ key: 'level_advance', label: 'Avance Nivel' }];


function fmtDate(d) {
  if (!d) return '—';
  try {return format(new Date(d), "d MMM yyyy", { locale: es });} catch {return '—';}
}

function exportCSV(rows, subjects) {
  const headers = ['Folio', 'Tipo', 'Nivel', 'Materia', 'Monto', 'Estado', 'Fecha'];
  const lines = rows.map((p) => {
    const tipo = FOLIO_TYPE_MAP[p.folio_type]?.label || p.folio_type || '—';
    const materia = p.folio_type === 'extraordinary_test' ?
    subjects.find((s) => s.id === p.subject_id)?.name || '—' :
    '—';
    const monto = p.amount != null ? `$${p.amount.toFixed(2)}` : '—';
    const estado = STATUS_MAP[p.status]?.label || p.status || '—';
    return [p.folio, tipo, `Nivel ${p.level}`, materia, monto, estado, fmtDate(p.used_date)].join(',');
  });
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pagos_alumno.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PaymentHistoryTab({ studentEmail }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // AUDIT: queries per-student con gcTime corto — se liberan al cerrar el tab.
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['studentPayments', studentEmail],
    queryFn: () => base44.entities.Payment.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
    staleTime: 0,
    gcTime: 3 * 60 * 1000,
    refetchOnMount: true,
    refetchOnReconnect: true
  });

  // Reutiliza cache global de subjects.
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
    staleTime: 30 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: paymentPlans = [] } = useQuery({
    queryKey: ['studentPaymentPlans', studentEmail],
    queryFn: () => base44.entities.LevelPaymentPlan.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
    staleTime: 0,
    gcTime: 3 * 60 * 1000,
    refetchOnMount: true
  });

  const filtered = payments.filter((p) => {
    const matchFilter = filter === 'all' || p.folio_type === filter;
    const matchSearch = !search || p.folio?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.used_date || 0) - new Date(a.used_date || 0));

  // Enriquecer con número de colegiatura si es time_unlock
  const enriched = sorted.map((p) => {
    if (p.folio_type === 'time_unlock') {
      const plan = paymentPlans.find((pp) => pp.folio_used === p.folio);
      return { ...p, _installment_number: plan?.installment_number };
    }
    return p;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>);

  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Historial de Pagos
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(sorted, subjects)}
            disabled={sorted.length === 0}>
            
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mt-3">
          {FILTER_OPTIONS.map((opt) =>
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            filter === opt.key ?
            'bg-blue-600 text-white border-blue-600' :
            'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`
            }>
            
              {opt.label}
            </button>
          )}
        </div>

        {/* Búsqueda */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm" />
          
        </div>
      </CardHeader>

      <CardContent>
        {enriched.length === 0 ?
        <div className="text-center py-10 text-gray-400">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin pagos registrados</p>
          </div> :

        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Detalle</TableHead>
                
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enriched.map((p) => {
              const tipoInfo = FOLIO_TYPE_MAP[p.folio_type] || { label: p.folio_type || '—', cls: 'bg-gray-100 text-gray-600' };
              const statusInfo = STATUS_MAP[p.status] || STATUS_MAP.available;
              const subject = p.folio_type === 'extraordinary_test' ?
              subjects.find((s) => s.id === p.subject_id) :
              null;
              return (
                <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-gray-700">{p.folio}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${tipoInfo.cls}`}>{tipoInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">Niv. {p.level}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-[140px]">
                      {p.folio_type === 'extraordinary_test' && subject ?
                    subject.name :
                    p.folio_type === 'time_unlock' && p._installment_number ?
                    `Mensualidad ${p._installment_number}` :
                    '—'}
                    </TableCell>
                    

                  
                    <TableCell>
                      <Badge className={`text-xs border-0 ${statusInfo.cls}`}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{fmtDate(p.used_date)}</TableCell>
                  </TableRow>);

            })}
            </TableBody>
          </Table>
        }
      </CardContent>
    </Card>);

}