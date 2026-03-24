import React, { useMemo } from 'react';
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
  Flame, Star, Zap, BookOpen
} from "lucide-react";
import AdminGuard from '@/components/auth/AdminGuard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell
} from 'recharts';

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || 'Sin nombre');
};

const LEVEL_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

// Calcula días transcurridos desde una fecha ISO
const daysSince = (isoDate) => {
  if (!isoDate) return 999;
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export default function StudentStatistics() {
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: allProgress = [] } = useQuery({
    queryKey: ['allProgress'],
    queryFn: () => base44.entities.UserProgress.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: allGamification = [] } = useQuery({
    queryKey: ['allGamification'],
    queryFn: () => base44.entities.GamificationProfile.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: allSubjectProgress = [] } = useQuery({
    queryKey: ['allSubjectProgress'],
    queryFn: () => base44.entities.SubjectProgress.list(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ─── getAdminStats ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const students = allUsers.filter(u => u.role !== 'admin');
    const total_students = students.length;

    const enriched = students.map(u => {
      const prog = allProgress.find(p => p.user_email === u.email);
      const gam = allGamification.find(g => g.user_email === u.email);
      const lastStudy = gam?.last_study_date_normalized;
      const days = daysSince(lastStudy);
      return {
        ...u,
        name: formatName(u),
        level: prog?.current_level || 1,
        progress: Math.round(prog?.total_progress_percent || 0),
        blocked: prog?.blocked_due_to_time || false,
        xp: gam?.xp_points || 0,
        streak: gam?.streak_days || 0,
        completedSubjects: (prog?.completed_subjects || []).length,
        lastStudy,
        daysSinceActivity: days,
      };
    });

    const active_today = enriched.filter(s => s.daysSinceActivity <= 1).length;
    const at_risk = enriched.filter(s => s.daysSinceActivity >= 2 && s.daysSinceActivity <= 5).length;
    const inactive = enriched.filter(s => s.daysSinceActivity >= 6).length;

    const avg_xp = total_students > 0
      ? Math.round(enriched.reduce((a, s) => a + s.xp, 0) / total_students)
      : 0;
    const avg_streak = total_students > 0
      ? Math.round(enriched.reduce((a, s) => a + s.streak, 0) / total_students)
      : 0;

    // Distribución por nivel (solo niveles con alumnos)
    const levelDist = [1, 2, 3, 4, 5, 6].map(lvl => {
      const inLevel = allProgress.filter(p => p.current_level === lvl);
      const avgProg = inLevel.length > 0
        ? Math.round(inLevel.reduce((a, p) => a + (p.total_progress_percent || 0), 0) / inLevel.length)
        : 0;
      return { level: `N${lvl}`, alumnos: inLevel.length, progreso: avgProg };
    }).filter(d => d.alumnos > 0);

    // Alumnos en riesgo (2–5 días) ordenados por mayor inactividad
    const atRiskList = enriched
      .filter(s => s.daysSinceActivity >= 2)
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
      .slice(0, 15);

    // Top 10 por XP
    const topByXP = [...enriched].sort((a, b) => b.xp - a.xp).slice(0, 10);

    // Top 10 por racha
    const topByStreak = [...enriched].sort((a, b) => b.streak - a.streak).slice(0, 10);

    // Materias completadas (solo las que tienen > 0)
    const subjectCompletions = subjects.map(s => ({
      name: s.name,
      level: s.level,
      completions: allSubjectProgress.filter(sp => sp.subject_id === s.id && sp.test_passed).length,
    })).filter(s => s.completions > 0).sort((a, b) => b.completions - a.completions);

    // Actividad "semanal" simulada desde last_study_date (últimos 7 días)
    const weekActivity = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('es-MX', { weekday: 'short' });
      const count = enriched.filter(s => s.daysSinceActivity === (6 - i)).length;
      return { day: label, activos: count };
    });

    return {
      total_students, active_today, at_risk, inactive,
      avg_xp, avg_streak,
      levelDist, atRiskList, topByXP, topByStreak,
      subjectCompletions, weekActivity,
    };
  }, [allUsers, allProgress, allGamification, allSubjectProgress, subjects]);

  // ─── Export CSV ───────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Nombre', 'Email', 'Nivel', 'Progreso (%)', 'XP', 'Racha', 'Días sin actividad', 'Bloqueado'],
    ];
    const students = allUsers.filter(u => u.role !== 'admin').map(u => {
      const prog = allProgress.find(p => p.user_email === u.email);
      const gam = allGamification.find(g => g.user_email === u.email);
      return [
        formatName(u), u.email,
        prog?.current_level || 1,
        Math.round(prog?.total_progress_percent || 0),
        gam?.xp_points || 0,
        gam?.streak_days || 0,
        daysSince(gam?.last_study_date_normalized),
        prog?.blocked_due_to_time ? 'Sí' : 'No',
      ];
    });
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