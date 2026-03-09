import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, KeyRound, CheckCircle2 } from "lucide-react";

export default function ExtraordinaryFolioValidator({ subjectId, userEmail, onUnlocked }) {
  const [folio, setFolio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleValidate = async () => {
    if (!folio.trim()) return;
    setLoading(true);
    setError('');

    // Buscar folio de tipo extraordinary_test disponible
    const results = await base44.entities.Payment.filter({ folio: folio.trim().toUpperCase() });
    const record = results[0];

    if (!record) {
      setError('Folio no encontrado.');
      setLoading(false);
      return;
    }
    if (record.folio_type !== 'extraordinary_test') {
      setError('Este folio no es válido para pruebas extraordinarias.');
      setLoading(false);
      return;
    }
    if (record.status !== 'available') {
      setError('Este folio ya fue utilizado o está expirado.');
      setLoading(false);
      return;
    }

    // Verificar que el folio esté asignado a este alumno
    if (record.user_email && record.user_email !== userEmail) {
      setError('Este folio está asignado a otro alumno.');
      setLoading(false);
      return;
    }

    // Marcar folio como usado
    await base44.entities.Payment.update(record.id, {
      status: 'used',
      user_email: userEmail,
      used_date: new Date().toISOString(),
      subject_id: subjectId,
    });

    setSuccess(true);
    setLoading(false);
    setTimeout(() => onUnlocked(), 1000);
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-lg p-4">
        <CheckCircle2 className="w-6 h-6 text-green-500" />
        <p className="font-semibold">Folio validado. Prueba desbloqueada.</p>
      </div>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-orange-700">
          <KeyRound className="w-5 h-5" />
          <p className="font-semibold text-sm">Ingresa un folio de prueba extraordinaria para desbloquear</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-600">Folio Extraordinario</Label>
          <Input
            placeholder="EXT-XXXXXXXX"
            value={folio}
            onChange={(e) => setFolio(e.target.value.toUpperCase())}
            className="font-mono"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <p className="text-sm text-orange-800 font-medium">
            📋 ¿Cómo obtener tu folio extraordinario?
          </p>
          <p className="text-xs text-orange-700 mt-1">
            Acude presencialmente a la administración escolar del plantel, realiza tu pago y te será entregado tu folio extraordinario.
          </p>
        </div>
        <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={handleValidate} disabled={loading || !folio.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Validar Folio Extraordinario
        </Button>
      </CardContent>
    </Card>
  );
}