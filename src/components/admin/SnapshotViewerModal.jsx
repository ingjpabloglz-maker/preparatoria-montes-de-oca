import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SnapshotViewerModal({ batch, open, onClose }) {
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['snapshots', batch?.id],
    queryFn: () => base44.entities.LevelExportSnapshot.filter({ batch_id: batch.id }),
    enabled: !!batch?.id && open,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            Snapshot — Nivel {batch?.level} &bull;{' '}
            {batch?.generated_at
              ? format(new Date(batch.generated_at), "d MMM yyyy HH:mm", { locale: es })
              : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 mb-3">
          <p className="text-xs text-gray-500">
            Generado por: <strong>{batch?.generated_by_name || batch?.generated_by_email}</strong>
          </p>
          <p className="text-xs text-gray-400 font-mono">Batch ID: {batch?.id}</p>
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-1">
            ✔ Datos inmutables — Representan el estado exacto del alumno al momento de exportar.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No se encontraron snapshots para este batch.</p>
        ) : (
          <div className="space-y-4">
            {snapshots.map(snap => (
              <div key={snap.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {snap.apellido_paterno} {snap.apellido_materno}, {snap.nombres}
                    </p>
                    <p className="text-xs text-gray-500">{snap.email}</p>
                    <p className="text-xs text-gray-500">CURP: {snap.curp || 'PENDIENTE'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs">Promedio: {snap.promedio ?? 'N/A'}</Badge>
                  </div>
                </div>

                {/* Materias */}
                {snap.materias && snap.materias.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-gray-600">
                          <th className="text-left px-2 py-1 font-medium">Materia</th>
                          <th className="text-right px-2 py-1 font-medium">Calificación</th>
                          <th className="text-right px-2 py-1 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snap.materias.map((m, i) => (
                          <tr key={i} className="border-t border-gray-200">
                            <td className="px-2 py-1 text-gray-700">{m.subject_name}</td>
                            <td className="px-2 py-1 text-right text-gray-700">
                              {m.final_grade != null ? m.final_grade : '—'}
                            </td>
                            <td className="px-2 py-1 text-right">
                              {m.test_passed
                                ? <span className="text-green-600">Aprobado</span>
                                : <span className="text-red-500">No aprobado</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Hash de integridad */}
                <p className="text-xs text-gray-400 font-mono truncate">
                  SHA-256: {snap.hash_integrity}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}