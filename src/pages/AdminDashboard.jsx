import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users,
  GraduationCap,
  CreditCard,
  Search,
  TrendingUp,
  Clock,
  ChevronRight,
  Plus,
  Eye
} from "lucide-react";
import AdminGuard from '../components/auth/AdminGuard';

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || 'Sin nombre');
};

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: allUsers = [] } = useQuery({
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

  const { data: allPayments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('-created_date'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Estadísticas
  const totalStudents = allUsers.filter(u => u.role !== 'admin').length;
  const activeStudents = allProgress.length;
  const usedFolios = allPayments.filter(p => p.status === 'used').length;
  const availableFolios = allPayments.filter(p => p.status === 'available').length;

  // Distribución por nivel
  const levelDistribution = [1, 2, 3, 4, 5, 6].map(level => ({
    level,
    count: allProgress.filter(p => p.current_level === level).length
  }));

  // Filtrar usuarios (solo no-admins)
  const filteredUsers = allUsers.filter(u => 
    u.role !== 'admin' &&
    (u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getUserProgress = (email) => {
    return allProgress.find(p => p.user_email === email);
  };

  return (
    <AdminGuard><div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-gray-500">Gestiona estudiantes, pagos y progreso</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => window.location.href = createPageUrl('ManageFolios')}>
              <CreditCard className="w-4 h-4 mr-2" />
              Gestionar Folios
            </Button>

          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{totalStudents}</p>
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
                  <p className="text-3xl font-bold">{activeStudents}</p>
                  <p className="text-sm text-gray-500">Activos</p>
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
                  <p className="text-3xl font-bold">{usedFolios}</p>
                  <p className="text-sm text-gray-500">Folios Usados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{subjects.length}</p>
                  <p className="text-sm text-gray-500">Materias</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="students">Estudiantes</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {/* Recent Activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Estudiantes Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.slice(0, 10).map((u) => {
                      const prog = getUserProgress(u.email);
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{formatName(u)}</p>
                              <p className="text-sm text-gray-500">{u.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              Nivel {prog?.current_level || 1}
                            </Badge>
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
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Todos los Estudiantes</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Buscar estudiante..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.filter(u => u.role !== 'admin').map((u) => {
                      const prog = getUserProgress(u.email);
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{formatName(u)}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Nivel {prog?.current_level || 1}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.location.href = createPageUrl(`StudentDetail?email=${u.email}`)}
                            >
                              Ver Detalle
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Folios de Pago</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-50">
                      {availableFolios} disponibles
                    </Badge>
                    <Badge variant="outline" className="bg-gray-50">
                      {usedFolios} usados
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Usado Por</TableHead>
                      <TableHead>Fecha de Uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayments.slice(0, 20).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono font-medium">{payment.folio}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Nivel {payment.level}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              payment.status === 'available' ? 'bg-green-100 text-green-800' :
                              payment.status === 'used' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }
                          >
                            {payment.status === 'available' ? 'Disponible' :
                             payment.status === 'used' ? 'Usado' : 'Expirado'}
                          </Badge>
                        </TableCell>
                        <TableCell>{payment.user_email || '-'}</TableCell>
                        <TableCell>
                          {payment.used_date 
                            ? new Date(payment.used_date).toLocaleDateString() 
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div></AdminGuard>
  );
}