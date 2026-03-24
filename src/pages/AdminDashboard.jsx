import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, GraduationCap, CreditCard, Search, TrendingUp,
  AlertTriangle, RefreshCw, Eye, BarChart2, CheckCircle2, BookOpen
} from "lucide-react";
import AdminGuard from '../components/auth/AdminGuard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || 'Sin nombre');
};

const LEVEL_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [recalculating, setRecalculating] = useState(false);
  const PAGE_SIZE = 10;
  const queryClient = useQueryClient();

  // --- FUENTE ÚNICA: PlatformStats ---
  const { data: statsArr = [], isLoading: loadingStats } = useQuery({
    queryKey: ['platformStats'],
    queryFn: () => base44.entities.PlatformStats.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const stats = statsArr[0] || null;

  // Usuarios para tabla (solo lista, no se usa para calcular métricas)
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: allProgress = [] } = useQuery({
    queryKey: ['allProgress'],
    queryFn: () => base44.entities.UserProgress.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    await base44.functions.invoke('recalculatePlatformStats', {});
    await queryClient.invalidateQueries({ queryKey: ['platformStats'] });
    setRecalculating(false);
  };

  // Tabla de alumnos
  const students = allUsers.filter(u => u.role !== 'admin');
  const filtered = students.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getUserProgress = (email) => allProgress.find(p => p.user_email === email);

  // Gráfica distribución por nivel
  const levelChartData = [1, 2, 3, 4, 5, 6].map(lvl => ({
    level: `N${lvl}`,
    alumnos: stats?.students_per_level?.[String(lvl)] || 0,
    progreso: stats?.progress_per_level?.[String(lvl)] || 0,
  })).filter(d => d.alumnos > 0);

  // Insights automáticos
  const insights = [];
  if (stats) {
    const inactive = (stats.total_students || 0) - (stats.active_students || 0);
    if (inactive > 0) insights.push({ color: 'red', text: `${inactive} alumno(s) sin progreso registrado.` });
    if (stats.blocked_students > 0) insights.push({ color: 'amber', text: `${stats.blocked_students} alumno(s) bloqueados por tiempo.` });
    if (stats.available_folios === 0) insights.push({ color: 'red', text: 'No hay folios disponibles. Genera nuevos pronto.' });
    // Nivel con menor progreso
    const progressEntries = Object.entries(stats.progress_per_level || {});
    if (progressEntries.length > 1) {
      const worst = progressEntries.sort((a, b) => a[1] - b[1])[0];
      if (worst[1] < 50) insights.push({ color: 'amber', text: `Nivel ${worst[0]} tiene el progreso más bajo (${worst[1]}% promedio).` });
    }
    if (insights.length === 0) insights.push({ color: 'green', text: 'Todo en orden. La plataforma funciona correctamente.' });
  }

  const lastUpdated = stats?.last_updated
    ? new Date(stats.last_updated).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
              {lastUpdated && (
                <p className="text-xs text-gray-400 mt-1">Métricas actualizadas: {lastUpdated}</p>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
                <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                Recalcular
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.href = createPageUrl('StudentStatistics')}>
                <BarChart2 className="w-4 h-4 mr-2" />
                Estadísticas
              </Button>
              <Button size="sm" onClick={() => window.location.href = createPageUrl('ManageFolios')}>
                <CreditCard className="w-4 h-4 mr-2" />
                Gestionar Folios
              </Button>
            </div>
          </div>

          {/* KPIs */}
          {loadingStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-0 shadow-sm animate-pulse">
                  <CardContent className="p-6 h-24 bg-gray-100 rounded-xl" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats?.total_students ?? '—'}</p>
                      <p className="text-sm text-gray-500">Estudiantes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats?.active_students ?? '—'}</p>
                      <p className="text-sm text-gray-500">Con progreso</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats?.available_folios ?? '—'}</p>
                      <p className="text-sm text-gray-500">Folios disponibles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats?.completed_subjects_count ?? '—'}</p>
                      <p className="text-sm text-gray-500">Materias aprobadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Gráfica + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribución por nivel */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Distribución por Nivel</CardTitle>
              </CardHeader>
              <CardContent>
                {levelChartData.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Sin datos. Recalcula las métricas.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={levelChartData} barSize={32}>
                      <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(val, name) => [val, name === 'alumnos' ? 'Alumnos' : 'Progreso %']}
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="alumnos" radius={[6, 6, 0, 0]}>
                        {levelChartData.map((_, i) => (
                          <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Progreso promedio por nivel */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Progreso Promedio por Nivel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {levelChartData.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Sin datos. Recalcula las métricas.</p>
                ) : levelChartData.map((d, i) => (
                  <div key={d.level} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Nivel {d.level.replace('N', '')}</span>
                      <span className="text-gray-500">{d.progreso}%</span>
                    </div>
                    <Progress value={d.progreso} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">💡 Insights Clave</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {insights.map((ins, i) => (
                  <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    ins.color === 'red' ? 'bg-red-50 text-red-800' :
                    ins.color === 'amber' ? 'bg-amber-50 text-amber-800' :
                    'bg-green-50 text-green-800'
                  }`}>
                    {ins.color === 'green'
                      ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    }
                    {ins.text}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tabla de alumnos con búsqueda y paginación */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base">Alumnos ({filtered.length})</CardTitle>
                <div className="flex gap-2 items-center">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar alumno..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = createPageUrl('ManageStudents')}>
                    Ver todos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((u) => {
                    const prog = getUserProgress(u.email);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{formatName(u)}</TableCell>
                        <TableCell className="text-gray-500 text-sm">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Nivel {prog?.current_level || 1}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = createPageUrl(`StudentDetail?email=${u.email}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                        No se encontraron alumnos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Página {page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </AdminGuard>
  );
}