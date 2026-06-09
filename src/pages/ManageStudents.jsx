import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Users, Trophy, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportGradesModal from '../components/admin/ExportGradesModal';
import AdminGuard from '../components/auth/AdminGuard';

const PAGE_SIZE = 30;

export default function ManageStudents() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Debounce search para no disparar fetch en cada keystroke
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => setDebouncedSearch(val), 350);
  }, []);

  const handleLevelChange = (val) => {
    setLevelFilter(val);
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', 'user', debouncedSearch, levelFilter, page],
    queryFn: () =>
      base44.functions.invoke('adminListUsers', {
        role: 'user',
        search: debouncedSearch,
        level: levelFilter,
        page,
        limit: PAGE_SIZE,
      }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const students = data?.users || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 1;

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Alumnos</h1>
              <p className="text-gray-500 text-sm">{total} alumnos registrados</p>
            </div>
            <Button onClick={() => setExportModalOpen(true)} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar calificaciones por nivel
            </Button>
          </div>

          <ExportGradesModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />

          {/* Table Card */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base">Lista de Alumnos ({total})</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Select value={levelFilter} onValueChange={handleLevelChange}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="Todos los niveles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los niveles</SelectItem>
                      {[1, 2, 3, 4, 5, 6].map(l => (
                        <SelectItem key={l} value={l.toString()}>Nivel {l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nombre o email..."
                      value={search}
                      onChange={handleSearchChange}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Estatus</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell className="text-gray-500">{s.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Nivel {s.current_level}</Badge>
                          </TableCell>
                          <TableCell>
                            {s.graduation_status === 'certified'
                              ? <Badge className="bg-purple-100 text-purple-700 text-xs gap-1"><Trophy className="w-3 h-3" />🟣 Certificado</Badge>
                              : s.graduation_status === 'completed'
                                ? <Badge className="bg-blue-100 text-blue-700 text-xs gap-1"><Trophy className="w-3 h-3" />🔵 Egresado</Badge>
                                : s.graduation_status === 'in_progress'
                                  ? <Badge className="bg-green-100 text-green-700 text-xs">🟢 En curso</Badge>
                                  : <Badge className="bg-gray-100 text-gray-600 text-xs">Inscrito</Badge>
                            }
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.location.href = createPageUrl(`StudentDetail?email=${s.email}`)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {students.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-400 py-8">
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
                        Página {page} de {totalPages} — {total} alumnos
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 1}
                          onClick={() => setPage(p => p - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => setPage(p => p + 1)}
                        >
                          Siguiente
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </AdminGuard>
  );
}