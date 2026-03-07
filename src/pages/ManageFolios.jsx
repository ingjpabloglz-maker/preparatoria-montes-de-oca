import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Printer,
  Search
} from "lucide-react";
import { toast } from "sonner";
import AdminGuard from '../components/auth/AdminGuard';
import FolioTicket from '../components/payment/FolioTicket';

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || u.email || 'Sin nombre');
};

const folioTypeLabel = {
  level_advance: 'Avance de Nivel',
  time_unlock: 'Desbloqueo por Tiempo',
  extraordinary_test: 'Prueba Extraordinaria',
};

export default function ManageFolios() {
  const [bulkCount, setBulkCount] = useState(1);
  const [bulkLevel, setBulkLevel] = useState(1);
  const [bulkFolioType, setBulkFolioType] = useState('level_advance');
  const [bulkStudentEmail, setBulkStudentEmail] = useState('');
  const [bulkStudentName, setBulkStudentName] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const [ticketPayment, setTicketPayment] = useState(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-created_date'),
  });

  // Cargar todos los alumnos para el selector
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const students = allUsers.filter(u => u.role !== 'admin');

  const filteredStudents = studentSearchQuery.trim().length > 0
    ? students.filter(s =>
        s.full_name?.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(studentSearchQuery.toLowerCase())
      )
    : students;

  const deleteFolioMutation = useMutation({
    mutationFn: (id) => base44.entities.Payment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      toast.success('Folio eliminado');
    },
  });

  const generateFolio = (type = 'level_advance') => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefix = type === 'extraordinary_test' ? 'EXT-' : 'PAY-';
    let result = prefix;
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerate = async () => {
    if (!bulkStudentEmail) {
      toast.error('Debes seleccionar un alumno');
      return;
    }

    const needsLevel = bulkFolioType !== 'extraordinary_test';

    const folios = [];
    for (let i = 0; i < bulkCount; i++) {
      folios.push({
        folio: generateFolio(bulkFolioType),
        level: needsLevel ? bulkLevel : 0,
        status: 'available',
        amount: 0,
        folio_type: bulkFolioType,
        user_email: bulkStudentEmail,
        student_name: bulkStudentName,
      });
    }

    await base44.entities.Payment.bulkCreate(folios);
    queryClient.invalidateQueries(['payments']);
    toast.success(`${bulkCount} folio${bulkCount > 1 ? 's' : ''} generado${bulkCount > 1 ? 's' : ''} y asignado${bulkCount > 1 ? 's' : ''} a ${bulkStudentName}`);
  };

  const handleSelectStudent = (user) => {
    setBulkStudentEmail(user.email);
    setBulkStudentName(formatName(user));
    setStudentSearchQuery('');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Folio copiado');
  };

  const openTicket = (payment) => {
    setTicketPayment(payment);
    setTicketOpen(true);
  };

  const needsLevel = bulkFolioType !== 'extraordinary_test';

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.href = createPageUrl('AdminDashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Folios</h1>
              <p className="text-gray-500">Genera y asigna folios de pago a alumnos</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-600">
                  {payments.filter(p => p.status === 'available').length}
                </p>
                <p className="text-sm text-gray-500">Disponibles</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-gray-600">
                  {payments.filter(p => p.status === 'used').length}
                </p>
                <p className="text-sm text-gray-500">Usados</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {payments.length}
                </p>
                <p className="text-sm text-gray-500">Total</p>
              </CardContent>
            </Card>
          </div>

          {/* Generador */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" /> Generar Folio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">

                {/* Tipo */}
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Folio</Label>
                  <Select value={bulkFolioType} onValueChange={(v) => setBulkFolioType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="level_advance">Avance de Nivel</SelectItem>
                      <SelectItem value="time_unlock">Desbloqueo por Tiempo</SelectItem>
                      <SelectItem value="extraordinary_test">Prueba Extraordinaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nivel (condicional) */}
                {needsLevel ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Nivel</Label>
                    <Select value={bulkLevel.toString()} onValueChange={(v) => setBulkLevel(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((l) => (
                          <SelectItem key={l} value={l.toString()}>Nivel {l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Nivel</Label>
                    <div className="h-9 flex items-center px-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-400">
                      General (todos los niveles)
                    </div>
                  </div>
                )}

                {/* Cantidad */}
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad de Folios</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                {/* Botón generar */}
                <Button onClick={handleGenerate} className="h-9">
                  <Plus className="w-4 h-4 mr-2" />
                  Generar {bulkCount > 1 ? `${bulkCount} Folios` : 'Folio'}
                </Button>
              </div>

              {/* Asignación al alumno */}
              <div className="mt-4 space-y-2">
                <Label className="text-xs">Asignar a Alumno <span className="text-red-500">*</span></Label>
                {bulkStudentEmail ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-blue-900">{bulkStudentName}</p>
                      <p className="text-xs text-blue-600">{bulkStudentEmail}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-800"
                      onClick={() => { setBulkStudentEmail(''); setBulkStudentName(''); }}
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Buscar alumno por nombre o correo..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {studentSearchQuery.trim().length > 0 && (
                      <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white shadow-sm">
                        {filteredStudents.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>
                        ) : (
                          filteredStudents.map((s) => (
                            <button
                              key={s.id}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b last:border-0 transition-colors"
                              onClick={() => handleSelectStudent(s)}
                            >
                              <p className="text-sm font-medium">{formatName(s)}</p>
                              <p className="text-xs text-gray-500">{s.email}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabla de folios */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Lista de Folios</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Alumno Asignado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                            {payment.folio}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(payment.folio)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          payment.folio_type === 'time_unlock' ? 'bg-purple-100 text-purple-800' :
                          payment.folio_type === 'extraordinary_test' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {folioTypeLabel[payment.folio_type] || payment.folio_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.folio_type === 'extraordinary_test'
                          ? <span className="text-xs text-gray-400">General</span>
                          : <Badge variant="outline">Nivel {payment.level}</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        {payment.student_name ? (
                          <div>
                            <p className="text-sm font-medium">{payment.student_name}</p>
                            <p className="text-xs text-gray-400">{payment.user_email}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          payment.status === 'available' ? 'bg-green-100 text-green-800' :
                          payment.status === 'used' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {payment.status === 'available' ? 'Disponible' :
                           payment.status === 'used' ? 'Usado' : 'Expirado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-500 hover:text-blue-700"
                            onClick={() => openTicket(payment)}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          {payment.status === 'available' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => deleteFolioMutation.mutate(payment.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <FolioTicket
        payment={ticketPayment}
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
      />
    </AdminGuard>
  );
}