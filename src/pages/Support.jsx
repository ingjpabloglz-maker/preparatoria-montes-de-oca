import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Upload, X, HeadphonesIcon, MapPin, Clock } from 'lucide-react';

const TICKET_TYPES = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'curso', label: 'Contenido del Curso' },
  { value: 'pagos', label: 'Pagos y Colegiaturas' },
  { value: 'tecnico', label: 'Problema Técnico' },
  { value: 'acceso', label: 'Acceso a la Plataforma' },
  { value: 'otro', label: 'Otro' },
];

export default function Support() {
  const { user } = useAuth();
  const [ticketType, setTicketType] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 3) {
      setError('Máximo 3 imágenes permitidas.');
      return;
    }
    setImages(prev => [...prev, ...files]);
    setError('');
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticketType || !subject || !description) {
      setError('Por favor completa todos los campos obligatorios.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Upload images if any
      const imageUrls = [];
      for (const img of images) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: img });
        imageUrls.push(file_url);
      }

      await base44.functions.invoke('sendSupportTicket', {
        ticket_type: ticketType,
        subject,
        description,
        image_urls: imageUrls,
      });

      setSent(true);
    } catch (err) {
      setError('Ocurrió un error al enviar tu ticket. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">¡Ticket enviado con éxito!</h2>
        <p className="text-gray-600 mb-2">Hemos recibido tu solicitud de soporte.</p>
        <p className="text-gray-600 mb-8">Recibirás una respuesta en tu correo <strong>{user?.email}</strong> en un plazo de <strong>24 a 48 horas hábiles</strong>.</p>
        <Button onClick={() => { setSent(false); setTicketType(''); setSubject(''); setDescription(''); setImages([]); }}>
          Enviar otro ticket
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <HeadphonesIcon className="w-7 h-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Asistencia y Soporte</h1>
        <p className="text-gray-500 mt-1">¿Tienes algún problema o duda? Envíanos un ticket y te ayudamos.</p>
      </div>

      {/* Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Nuevo Ticket de Soporte</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="type">Tipo de solicitud <span className="text-red-500">*</span></Label>
              <Select value={ticketType} onValueChange={setTicketType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subject">Asunto <span className="text-red-500">*</span></Label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Resume tu problema en una línea"
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe detalladamente tu problema o pregunta..."
                rows={5}
                className="mt-1"
              />
            </div>

            {/* Image upload */}
            <div>
              <Label>Imágenes adjuntas (opcional, máx. 3)</Label>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-400 mt-1">Agregar</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando ticket...' : 'Enviar Ticket de Soporte'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Atención presencial */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">¿Prefieres atención presencial?</p>
              <p className="text-sm text-amber-800 mt-1">
                También puedes acudir directamente al plantel donde nuestro personal administrativo estará disponible para atenderte y resolver tus dudas de manera inmediata.
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700">
                <Clock className="w-3.5 h-3.5" />
                <span>Horario de atención: Lunes a Viernes, 8:00 AM – 3:00 PM</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}