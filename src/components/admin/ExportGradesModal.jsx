import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, Loader2, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function downloadCSV(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportGradesModal({ open, onClose }) {
  const [level, setLevel] = useState('1');
  const [includeExported, setIncludeExported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const { data: batches = [], refetch: refetchBatches } = useQuery({
    queryKey: ['exportBatches'],
    queryFn: () => base44.entities.LevelExportBatch.list('-generated_at'),
    enabled: open,
  });

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('exportLevelGrades', {
        level: parseInt(level),
        include_exported: includeExported,
      });
      const data = res.data;
      if (data.total_students === 0) {
        setResult({ empty: true, message: data.message });
      } else {
        downloadCSV(data.csv_content, data.file_name);
        setResult({ success: true, total: data.total_students, batch_id: data.batch_id, file_name: data.file_name });
        refetchBatches();
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al generar la exportación.');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    onClose();
  };

  const levelBatches = batches.filter(b => b.level === parseInt(level));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Exportar Calificaciones por Nivel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Selector de nivel */}
          <div className="space-y-1.5">
            <Label>Nivel académico</Label>
            <Select value={level} onValueChange={(v) => { setLevel(v); setResult(null); setError(''); }}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(l => (
                  <SelectItem key={l} value={l.toString()}>Nivel {l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Solo se exportan alumnos que completaron el nivel seleccionado.
            </p>
          </div>

          {/* Checkbox incluir ya exportados */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Checkbox
              id="include_exported"
              checked={includeExported}
              onCheckedChange={setIncludeExported}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="include_exported" className="cursor-pointer font-medium text-amber-900">
                Incluir alumnos ya exportados anteriormente
              </Label>
              <p className="text-xs text-amber-700 mt-0.5">
                Al activar esta opción, se incluirán alumnos que ya fueron marcados como exportados. No se actualizará su estado de exportación.
              </p>
            </div>
          </div>

          {/* Resultado */}
          {result?.success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Descarga iniciada: <strong>{result.total} alumnos</strong> en <code className="font-mono text-xs bg-green-100 px-1 rounded">{result.file_name}</code></span>
            </div>
          )}
          {result?.empty && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {result.message}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Botón */}
          <Button onClick={handleExport} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</>
              : <><Download className="w-4 h-4 mr-2" />Generar y descargar CSV</>
            }
          </Button>

          {/* Historial de exportaciones */}
          {levelBatches.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Historial de exportaciones — Nivel {level}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {levelBatches.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-800">{b.generated_by_name || b.generated_by_email}</p>
                      <p className="text-gray-500">
                        {b.generated_at ? format(new Date(b.generated_at), "d MMM yyyy 'a las' HH:mm", { locale: es }) : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{b.total_students} alumnos</Badge>
                      {b.include_exported && <Badge className="bg-amber-100 text-amber-700 text-xs">Incluye exportados</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}