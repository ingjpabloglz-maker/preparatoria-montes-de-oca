import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, ShieldCheck, Trash2 } from "lucide-react";
import AdminGuard from '../components/auth/AdminGuard';

export default function ManageAdmins() {
  const [search, setSearch] = useState('');
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Usa adminListUsers con role='admin' — sin dependencia de User RLS
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', 'admin'],
    queryFn: () =>
      base44.functions.invoke('adminListUsers', { role: 'admin', limit: 200 }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (userEmail) =>
      base44.functions.invoke('deleteUserCompletely', { user_email: userEmail }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users', 'admin'] }),
  });

  const PROTECTED_EMAIL = 'ing.jpablo.glz@gmail.com';

  const allAdmins = (data?.users || []).filter(u => u.email !== PROTECTED_EMAIL);

  const filteredAdmins = allAdmins.filter(a =>
    a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-5xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Administradores</h1>
              <p className="text-gray-500 text-sm">{allAdmins.length} administradores registrados</p>
            </div>
          </div>

          {/* Table Card */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base">Lista de Administradores</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdmins.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.full_name || 'Sin nombre'}</TableCell>
                        <TableCell className="text-gray-500">{a.email}</TableCell>
                        <TableCell>
                          <Badge className="bg-indigo-100 text-indigo-800">Administrador</Badge>
                        </TableCell>
                        <TableCell>
                          {currentUser?.email !== a.email ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Eliminar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar administrador?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará el acceso de <strong>{a.full_name || a.email}</strong>. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate(a.email)}
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <span className="text-xs text-gray-400 px-2">Tu cuenta</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAdmins.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                          No se encontraron administradores.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </AdminGuard>
  );
}