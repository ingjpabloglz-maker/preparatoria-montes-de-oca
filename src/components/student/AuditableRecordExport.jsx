import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Botones para descargar expedientes:
 * - PDF estándar (ya existe)
 * - PDF auditable SEP (nuevo)
 */
export default function AuditableRecordExport({ userEmail, className = '' }) {
  const [loadingAuditable, setLoadingAuditable] = useState(false);

  const downloadAuditablePDF = async () => {
    try {
      setLoadingAuditable(true);
      const response = await base44.functions.invoke('generateAuditableStudentRecordPDF', {
        user_email: userEmail,
      });

      // Crear blob desde base64 o binario
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expediente_auditable_${userEmail}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF auditable descargado exitosamente');
    } catch (error) {
      console.error('Error descargando PDF auditable:', error);
      toast.error('Error al generar PDF auditable');
    } finally {
      setLoadingAuditable(false);
    }
  };

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={downloadAuditablePDF}
        disabled={loadingAuditable}
        className="gap-2"
      >
        {loadingAuditable ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Descargar expediente auditable (SEP)
      </Button>
    </div>
  );
}