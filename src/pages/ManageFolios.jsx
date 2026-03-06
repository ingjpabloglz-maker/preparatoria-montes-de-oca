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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import AdminGuard from '../components/auth/AdminGuard';

export default function ManageFolios() {
  const [user, setUser] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFolio, setNewFolio] = useState({
    folio: '',
    level: 1,
    amount: 0,
    student_name: '',
    folio_type: 'level_advance'
  });
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkLevel, setBulkLevel] = useState(1);
  const [bulkFolioType, setBulkFolioType] = useState('level_advance');
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-created_date'),
  });

  const createFolioMutation = useMutation({
    mutationFn: (data) => base44.entities.Payment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      setIsDialogOpen(false);
      setNewFolio({ folio: '', level: 1, amount: 0, student_name: '' });
      toast.success('Folio creado exitosamente');
    },
  });

  const deleteFolioMutation = useMutation({
    mutationFn: (id) => base44.entities.Payment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      toast.success('Folio eliminado');
    },
  });

  const generateFolio = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PAY-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateSingle = () => {
    const folio = newFolio.folio || generateFolio();
    createFolioMutation.mutate({
      ...newFolio,
      folio,
      status: 'available'
    });
  };

  const handleBulkCreate = async () => {
    const folios = [];
    for (let i = 0; i < bulkCount; i++) {
      folios.push({
        folio: generateFolio(),
        level: bulkLevel,
        status: 'available',
        amount: 0,
        folio_type: bulkFolioType
      });
    }
    await base44.entities.Payment.bulkCreate(folios);
    queryClient.invalidateQueries(['payments']);
    toast.success(`${bulkCount} folios creados`);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Folio copiado');
  };

  return (
    <AdminGuard><div className="min-h-screen bg-gray-50">
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
            <p className="text-gray-500">Crea y administra folios de pago</p>
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

        {/* Actions */}
        <div className="flex gap-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Crear Folio Individual
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Folio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Folio (opcional, se genera automáticamente)</Label>
                  <Input
                    placeholder="PAY-XXXXXXXX"
                    value={newFolio.folio}
                    onChange={(e) => setNewFolio({ ...newFolio, folio: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nivel</Label>
                  <Select
                    value={newFolio.level.toString()}
                    onValueChange={(v) => setNewFolio({ ...newFolio, level: parseInt(v) })}
                  >
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
                <div className="space-y-2">
                  <Label>Tipo de Folio</Label>
                  <Select
                    value={newFolio.folio_type}
                    onValueChange={(v) => setNewFolio({ ...newFolio, folio_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="level_advance">Avance de Nivel</SelectItem>
                      <SelectItem value="time_unlock">Desbloqueo por Tiempo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre del Estudiante (opcional)</Label>
                  <Input
                    placeholder="Nombre del estudiante"
                    value={newFolio.student_name}
                    onChange={(e) => setNewFolio({ ...newFolio, student_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto (opcional)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newFolio.amount}
                    onChange={(e) => setNewFolio({ ...newFolio, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <Button className="w-full" onClick={handleCreateSingle}>
                  Crear Folio
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Bulk Create */}
          <Card className="flex-1 border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 flex items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nivel</Label>
                  <Select value={bulkLevel.toString()} onValueChange={(v) => setBulkLevel(parseInt(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((l) => (
                        <SelectItem key={l} value={l.toString()}>Nivel {l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={bulkFolioType} onValueChange={(v) => setBulkFolioType(v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="level_advance">Avance Nivel</SelectItem>
                      <SelectItem value="time_unlock">Desbloqueo Tiempo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" onClick={handleBulkCreate}>
                Crear {bulkCount} Folios
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Lista de Folios</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Estudiante Asignado</TableHead>
                  <TableHead>Usado Por</TableHead>
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
                      <Badge variant="outline">Nivel {payment.level}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={payment.folio_type === 'time_unlock' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                        {payment.folio_type === 'time_unlock' ? 'Desbloqueo Tiempo' : 'Avance Nivel'}
                      </Badge>
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
                    <TableCell>{payment.student_name || '-'}</TableCell>
                    <TableCell>{payment.user_email || '-'}</TableCell>
                    <TableCell>
                      {payment.status === 'available' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteFolioMutation.mutate(payment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div></AdminGuard>
  );
}