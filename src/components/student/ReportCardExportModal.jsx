import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription } from
"@/components/ui/dialog";
import { FileText, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

async function downloadPDFFromFunction(functionName, payload, filename) {
  // base44.functions.invoke retorna un objeto axios: { data, status, headers }
  // Para PDFs necesitamos pasar responseType: 'arraybuffer'
  const res = await base44.functions.invoke(functionName, payload, { responseType: 'arraybuffer' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportCardExportModal({ open, onClose, studentEmail, studentName, currentLevel, adminEmail }) {
  const [loading, setLoading] = useState(null); // 'full' | 'level' | null
  const [selectedLevel, setSelectedLevel] = useState(currentLevel);

  const logAudit = (action, metadata = {}) => {
    base44.entities.UserReport?.create({
      admin_email: adminEmail,
      student_email: studentEmail,
      action,
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify(metadata)
    }).catch(() => {});
  };

  const handleFullExport = async () => {
    setLoading('full');
    try {
      await downloadPDFFromFunction(
        'generateAuditableStudentRecordPDF',
        { user_email: studentEmail },
        `expediente_${(studentEmail || 'alumno').replace(/[^a-z0-9]/gi, '_')}.pdf`
      );
      logAudit('ADMIN_EXPORTED_REPORT_CARD', { type: 'full', student_email: studentEmail });
      toast.success('Expediente académico descargado');
      onClose();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleLevelExport = async () => {
    setLoading('level');
    try {
      // exportLevelGrades genera Excel + snapshot de auditoría para el nivel
      const res = await base44.functions.invoke('exportLevelGrades', {
        level: selectedLevel,
        include_exported: true,
        student_email: studentEmail,
      });
      const data = res.data;
      if (data?.xlsx_base64) {
        const binary = atob(data.xlsx_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.file_name || `calificaciones_nivel_${selectedLevel}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        logAudit('ADMIN_EXPORTED_REPORT_CARD', { type: 'level', level: selectedLevel, student_email: studentEmail });
        toast.success(`Boleta Nivel ${selectedLevel} descargada`);
        onClose();
      } else {
        toast.error(data?.message || 'No hay datos para exportar en este nivel');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Exportar Boleta
          </DialogTitle>
          <DialogDescription>
            Selecciona el tipo de documento a generar para <strong>{studentName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Opción 1: Expediente completo */}
          <div className="border rounded-xl p-4 space-y-3 hover:border-blue-300 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">Expediente Académico Completo</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  PDF oficial con todos los niveles, evaluaciones, exámenes presenciales y hash de integridad.
                </p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <Badge className="text-[10px] bg-blue-50 text-blue-700 border-0">PDF Oficial</Badge>
                  <Badge className="text-[10px] bg-green-50 text-green-700 border-0">Hash SHA-256</Badge>
                  <Badge className="text-[10px] bg-purple-50 text-purple-700 border-0">Auditable</Badge>
                </div>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleFullExport}
              disabled={loading !== null}>
              
              {loading === 'full' ?
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando PDF...</> :
              <><Download className="w-4 h-4 mr-2" />Descargar Expediente PDF</>}
            </Button>
          </div>

          {/* Opción 2: Boleta por nivel (Excel) */}
          <div className="border rounded-xl p-4 space-y-3 hover:border-green-300 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">Boleta por Nivel (Excel)</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Exportación de calificaciones en formato Excel para registro SEP. Genera snapshot de auditoría.
                </p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <Badge className="text-[10px] bg-green-50 text-green-700 border-0">Excel .xlsx</Badge>
                  <Badge className="text-[10px] bg-amber-50 text-amber-700 border-0">Snapshot Inmutable</Badge>
                </div>
              </div>
            </div>

            {/* Selector de nivel */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex-shrink-0">Nivel:</span>
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map((n) =>
                <button
                  key={n}
                  onClick={() => setSelectedLevel(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                  selectedLevel === n ?
                  'bg-green-600 text-white border-green-600' :
                  'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`
                  }>
                  
                    {n}
                  </button>
                )}
              </div>
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleLevelExport}
              disabled={loading !== null}>
              
              {loading === 'level' ?
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando Excel...</> :
              <><Download className="w-4 h-4 mr-2" />Exportar Nivel {selectedLevel}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);

}