import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Download, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Diálogo para buscar un alumno y descargar su expediente auditable
 */
export default function AuditRecordDownload() {
  const [open, setOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownload = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) {
      toast.error('Ingresa un correo electrónico');
      return;
    }

    try {
      setLoading(true);
      const response = await base44.functions.invoke('generateAuditableStudentRecordPDF', {
        user_email: searchEmail.trim(),
      });

      // Crear blob desde respuesta
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expediente_auditable_${searchEmail.trim()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Expediente auditable descargado');
      setSearchEmail('');
      setOpen(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al descargar expediente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Descargar Expediente SEP
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Descargar Expediente Auditable (SEP)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleDownload} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Correo del Alumno
            </label>
            <Input
              type="email"
              placeholder="ejemplo@escuela.edu"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={loading || !searchEmail.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Descargar
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}