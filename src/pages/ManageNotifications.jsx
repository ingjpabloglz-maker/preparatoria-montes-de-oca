import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Megaphone, Users, Search, X, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminGuard from '@/components/auth/AdminGuard';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ManageNotifications() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [link, setLink] = useState('');
  const [targetType, setTargetType] = useState('global');
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  // Buscar alumnos
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['notif-students', search],
    queryFn: () =>
      base44.functions.invoke('adminListUsers', {
        role: 'user',
        search,
        page: 1,
        limit: 100,
      }).then(r => r.data),
    staleTime: 60 * 1000,
    keepPreviousData: true,
  });

  const students = studentsData?.users || [];

  // Historial de notificaciones enviadas (globales recientes)
  const { data: recentNotifications = [], refetch: refetchHistory } = useQuery({
    queryKey: ['admin-notifications-history'],
    queryFn: () =>
      base44.entities.UserNotification.list('-created_date', 20),
    staleTime: 30 * 1000,
  });

  const toggleStudent = (email) => {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('El título y mensaje son obligatorios');
      return;
    }
    if (targetType === 'specific' && selectedEmails.length === 0) {
      toast.error('Selecciona al menos un alumno');
      return;
    }

    setSending(true);
    try {
      const res = await base44.functions.invoke('sendCustomNotification', {
        title: title.trim(),
        message: message.trim(),
        type,
        link: link.trim() || null,
        target_type: targetType,
        target_emails: targetType === 'specific' ? selectedEmails : [],
      });

      toast.success(`Notificación enviada a ${res.data.created} alumno(s)`);
      setTitle('');
      setMessage('');
      setLink('');
      setSelectedEmails([]);
      refetchHistory();
    } catch (err) {
      toast.error('Error al enviar la notificación: ' + (err.message || 'desconocido'));
    }
    setSending(false);
  };

  const typeStyles = {
    info: { label: 'Informativa', color: 'bg-blue-100 text-blue-700' },
    alert: { label: 'Alerta', color: 'bg-red-100 text-red-700' },
    announcement: { label: 'Anuncio', color: 'bg-purple-100 text-purple-700' },
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-blue-600" />
              Centro de Notificaciones
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Envía notificaciones a alumnos. Aparecerán instantáneamente en su campanita.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* === Panel de redacción === */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Redactar Notificación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tipo */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de notificación</label>
                  <div className="flex gap-2">
                    {Object.entries(typeStyles).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setType(key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          type === key ? cfg.color + ' ring-2 ring-offset-1' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Título */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Título *</label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: Nueva lección disponible"
                    maxLength={80}
                  />
                </div>

                {/* Mensaje */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Mensaje *</label>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Escribe el contenido de la notificación..."
                    rows={3}
                    maxLength={500}
                  />
                </div>

                {/* Link opcional */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Link opcional (URL)</label>
                  <Input
                    value={link}
                    onChange={e => setLink(e.target.value)}
                    placeholder="/app/Dashboard"
                  />
                  <p className="text-xs text-gray-400 mt-1">Si se llena, al hacer clic la notificación redirige aquí.</p>
                </div>

                {/* Destinatarios */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Destinatarios</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setTargetType('global')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        targetType === 'global' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Global (todos)
                    </button>
                    <button
                      onClick={() => setTargetType('specific')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        targetType === 'specific' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      Específicos
                    </button>
                  </div>

                  {/* Selección de alumnos específicos */}
                  {targetType === 'specific' && (
                    <div className="space-y-2">
                      {selectedEmails.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50 rounded-lg">
                          {selectedEmails.map(email => (
                            <Badge key={email} variant="secondary" className="cursor-pointer" onClick={() => toggleStudent(email)}>
                              {email.split('@')[0]}
                              <X className="w-3 h-3 ml-1" />
                            </Badge>
                          ))}
                          <span className="text-xs text-blue-600 self-center">({selectedEmails.length} seleccionados)</span>
                        </div>
                      )}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Buscar alumno por nombre o email..."
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg">
                        {loadingStudents ? (
                          <p className="p-3 text-sm text-gray-400 text-center">Buscando...</p>
                        ) : students.length === 0 ? (
                          <p className="p-3 text-sm text-gray-400 text-center">No se encontraron alumnos</p>
                        ) : (
                          students.map(s => (
                            <button
                              key={s.email}
                              onClick={() => toggleStudent(s.email)}
                              className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                                selectedEmails.includes(s.email) ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div>
                                <p className="font-medium text-gray-700">{s.full_name}</p>
                                <p className="text-xs text-gray-400">{s.email}</p>
                              </div>
                              {selectedEmails.includes(s.email) && (
                                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón enviar */}
                <Button
                  onClick={handleSend}
                  disabled={sending || !title.trim() || !message.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Enviar Notificación</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* === Historial reciente === */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Notificaciones Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto space-y-2">
                  {recentNotifications.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Aún no se han enviado notificaciones</p>
                  ) : (
                    recentNotifications.map(n => (
                      <div key={n.id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="outline" className="text-[10px]">{typeStyles[n.type]?.label || n.type}</Badge>
                              <span className="text-[10px] text-gray-400">
                                {formatDistanceToNow(new Date(n.created_date), { addSuffix: true, locale: es })}
                              </span>
                              {n.is_global && (
                                <Badge className="text-[10px] bg-blue-100 text-blue-700">Global</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}