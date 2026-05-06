import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CreditCard, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

const statusConfig = {
  paid:    { label: 'Pagada',   color: 'bg-green-100 text-green-800' },
  pending: { label: 'Pendiente', color: 'bg-blue-100 text-blue-800' },
  overdue: { label: 'Vencida',  color: 'bg-red-100 text-red-800' },
};

export default function InstallmentsAdminPanel() {
  const [filterEmail, setFilterEmail] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [migratingEmail, setMigratingEmail] = useState('');
  const [migratingLevel, setMigratingLevel] = useState(null);
  const queryClient = useQueryClient();

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['allInstallments'],
    queryFn: () => base44.entities.LevelPaymentPlan.list('-created_date'),
    staleTime: 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const getUserName = (email) => {
    const u = allUsers.find(u => u.email === email);
    if (!u) return email;
    const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : u.full_name || email;
  };

  const filtered = installments.filter(inst => {
    const emailMatch = !filterEmail || inst.user_email?.toLowerCase().includes(filterEmail.toLowerCase()) || getUserName(inst.user_email).toLowerCase().includes(filterEmail.toLowerCase());
    const levelMatch = filterLevel === 'all' || inst.level === parseInt(filterLevel);
    const statusMatch = filterStatus === 'all' || inst.status === filterStatus;
    return emailMatch && levelMatch && statusMatch;
  });

  const handleRegenerateMigration = async (user_email, level, level_start_date) => {
    setMigratingEmail(user_email);
    setMigratingLevel(level);
    try {
      const res = await base44.functions.invoke('generateInstallments', {
        user_email,
        level,
        level_start_date,
        mark_first_as_paid: true,
      });
      if (res.data?.success) {
        toast.success(`Colegiaturas regeneradas para ${getUserName(user_email)}`);
        queryClient.invalidateQueries(['allInstallments']);
      } else {
        toast.error(res.data?.error || 'Error al regenerar');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMigratingEmail('');
      setMigratingLevel(null);
    }
  };

  const totalPaid = installments.filter(i => i.status === 'paid').length;
  const totalOverdue = installments.filter(i => i.status === 'overdue').length;
  const totalPending = installments.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalPaid}</p>
            <p className="text-xs text-gray-500">Colegiaturas pagadas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalPending}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{totalOverdue}</p>
            <p className="text-xs text-gray-500">Vencidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Colegiaturas por Alumno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar alumno..."
                value={filterEmail}
                onChange={e => setFilterEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger><SelectValue placeholder="Nivel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                {[1,2,3,4,5,6].map(l => <SelectItem key={l} value={l.toString()}>Nivel {l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagadas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Colegiatura</TableHead>
                  <TableHead>Fecha Límite</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Folio Usado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                      No hay colegiaturas con los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(inst => (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{getUserName(inst.user_email)}</p>
                        <p className="text-xs text-gray-400">{inst.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">Nivel {inst.level}</Badge></TableCell>
                    <TableCell className="font-medium text-center">{inst.installment_number} / 4</TableCell>
                    <TableCell className="text-sm">
                      {new Date(inst.due_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {inst.paid_at
                        ? new Date(inst.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[inst.status]?.color || ''}>
                        {statusConfig[inst.status]?.label || inst.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inst.folio_used
                        ? <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">{inst.folio_used}</code>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}