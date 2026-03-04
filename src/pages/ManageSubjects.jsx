import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  BookOpen
} from "lucide-react";
import { toast } from "sonner";
import AdminGuard from '../components/auth/AdminGuard';

export default function ManageSubjects() {
  const [user, setUser] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [activeLevel, setActiveLevel] = useState('1');
  const [formData, setFormData] = useState({
    name: '',
    level: 1,
    description: '',
    order: 1
  });
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
      if (userData?.role !== 'admin') {
        window.location.href = createPageUrl('Dashboard');
      }
    };
    loadUser();
  }, []);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level,order'),
  });

  const createSubjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Subject.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      setIsDialogOpen(false);
      resetForm();
      toast.success('Materia creada');
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      setIsDialogOpen(false);
      resetForm();
      toast.success('Materia actualizada');
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      toast.success('Materia eliminada');
    },
  });

  const resetForm = () => {
    setFormData({ name: '', level: 1, description: '', order: 1 });
    setEditingSubject(null);
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      level: subject.level,
      description: subject.description || '',
      order: subject.order || 1
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingSubject) {
      updateSubjectMutation.mutate({ id: editingSubject.id, data: formData });
    } else {
      createSubjectMutation.mutate(formData);
    }
  };

  // Agrupar materias por nivel
  const subjectsByLevel = subjects.reduce((acc, subject) => {
    if (!acc[subject.level]) acc[subject.level] = [];
    acc[subject.level].push(subject);
    return acc;
  }, {});

  return (
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
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Materias</h1>
            <p className="text-gray-500">Administra las materias de cada nivel</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Agregar Materia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSubject ? 'Editar Materia' : 'Nueva Materia'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    placeholder="Nombre de la materia"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nivel</Label>
                  <Select
                    value={formData.level.toString()}
                    onValueChange={(v) => setFormData({ ...formData, level: parseInt(v) })}
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
                  <Label>Descripción</Label>
                  <Textarea
                    placeholder="Descripción de la materia"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <Button className="w-full" onClick={handleSubmit}>
                  {editingSubject ? 'Guardar Cambios' : 'Crear Materia'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <Card key={level} className="border-0 shadow-sm text-center">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-blue-600">
                  {subjectsByLevel[level]?.length || 0}
                </p>
                <p className="text-xs text-gray-500">Nivel {level}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs by Level */}
        <Tabs value={activeLevel} onValueChange={setActiveLevel}>
          <TabsList className="bg-white shadow-sm">
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <TabsTrigger key={level} value={level.toString()}>
                Nivel {level}
              </TabsTrigger>
            ))}
          </TabsList>

          {[1, 2, 3, 4, 5, 6].map((level) => (
            <TabsContent key={level} value={level.toString()} className="mt-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(subjectsByLevel[level] || []).map((subject) => (
                  <Card key={subject.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{subject.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              Orden: {subject.order || 1}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(subject)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => deleteSubjectMutation.mutate(subject.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {subject.description && (
                        <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                          {subject.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {(!subjectsByLevel[level] || subjectsByLevel[level].length === 0) && (
                  <div className="col-span-full text-center py-12 text-gray-400">
                    No hay materias en este nivel
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}