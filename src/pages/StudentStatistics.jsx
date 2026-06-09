import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Users, TrendingUp, AlertTriangle, XCircle, Download,
  Flame, Zap, BookOpen
} from "lucide-react";
import AdminGuard from '@/components/auth/AdminGuard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell
} from 'recharts';

const LEVEL_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function StudentStatistics() {
  const { data: stats = {}, isLoading } = useQuery({
    queryKey: ['student-statistics-consolidated'],
    queryFn: () => base44.functions.invoke('getStudentStatistics').then(r => r.data),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // ─── Export CSV ───────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Nombre', 'Email', 'Nivel', 'XP', 'Racha', 'Días sin actividad', 'Bloqueado'],
    ];
    const students = (stats.raw_students || []).map(s => [
      s.name, s.email, s.level, s.xp, s.streak,
      s.daysSinceActivity >= 999 ? 'Sin registro' : s.daysSinceActivity,
      s.blocked ? 'Sí' : 'No',
    ]);
    const csv = [...rows, ...students]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estadisticas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskColor = (days) => {
    if (days <= 1) return 'bg-green-100 text-green-800';
    if (days <= 5) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Estadísticas de Alumnos</h1>
              <p className="text-gray-500 text-sm">Datos en tiempo real • {stats.total_students} alumnos</p>
            </div>
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total', value: stats.total_students, icon: Users, bg: 'bg-blue-100', text: 'text-blue-600' },
              { label: 'Activos hoy', value: stats.active_today, icon: TrendingUp, bg: 'bg-green-100', text: 'text-green-600' },
              { label: 'En riesgo', value: stats.at_risk, icon: AlertTriangle, bg: 'bg-amber-100', text: 'text-amber-600' },
              { label: 'Inactivos', value: stats.inactive, icon: XCircle, bg: 'bg-red-100', text: 'text-red-600' },
              { label: 'XP promedio', value: stats.avg_xp, icon: Zap, bg: 'bg-purple-100', text: 'text-purple-600' },
              { label: 'Racha prom.', value: `${stats.avg_streak}d`, icon: Flame, bg: 'bg-orange-100', text: 'text-orange-600' },
            ].map(({ label, value, icon: Icon, bg, text }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${bg}`}>
                    <Icon className={`w-4 h-4 ${text}`} />
                  </div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Gráficas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actividad semanal */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Actividad Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={stats.weekActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [v, 'Alumnos activos']}
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    />
                    <Line type="monotone" dataKey="activos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución por nivel */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Progreso Promedio por Nivel</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.levelDist.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Sin datos de progreso</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={stats.levelDist} barSize={28}>
                      <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip
                        formatter={(v, name) => [name === 'progreso' ? `${v}%` : v, name === 'progreso' ? 'Progreso' : 'Alumnos']}
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="progreso" radius={[6, 6, 0, 0]}>
                        {stats.levelDist.map((_, i) => (
                          <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alumnos en riesgo */}
          {stats.atRiskList.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Alumnos en Riesgo de Abandono
                  <Badge className="bg-amber-100 text-amber-800 ml-2">{stats.atRiskList.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Días sin actividad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.atRiskList.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-gray-500 text-sm">{s.email}</TableCell>
                        <TableCell><Badge variant="outline">Nivel {s.level}</Badge></TableCell>
                        <TableCell>
                          <Badge className={riskColor(s.daysSinceActivity)}>
                            {s.daysSinceActivity >= 999 ? 'Sin registro' : `${s.daysSinceActivity} días`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Top estudiantes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  Top 10 por XP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topByXP.filter(s => s.xp > 0).slice(0, 10).map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">{s.xp.toLocaleString()} XP</Badge>
                  </div>
                ))}
                {stats.topByXP.filter(s => s.xp > 0).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Sin datos de XP aún</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Top 10 por Racha
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topByStreak.filter(s => s.streak > 0).slice(0, 10).map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">{s.streak} días 🔥</Badge>
                  </div>
                ))}
                {stats.topByStreak.filter(s => s.streak > 0).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Sin datos de racha aún</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Materias completadas (solo las que tienen > 0) */}
          {stats.subjectCompletions.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  Materias Aprobadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.subjectCompletions.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs w-14 text-center">N{s.level}</Badge>
                      <p className="text-sm flex-1 truncate">{s.name}</p>
                      <div className="w-32">
                        <Progress value={Math.min(100, (s.completions / Math.max(1, stats.total_students)) * 100)} className="h-2" />
                      </div>
                      <span className="text-sm text-gray-600 w-6 text-right">{s.completions}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </AdminGuard>
  );
}