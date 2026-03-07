import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Shield
} from "lucide-react";
import { base44 } from '@/api/base44Client';

export default function FolioValidator({ levelToUnlock, onSuccess, userEmail, folioType = 'level_advance' }) {
  const [folio, setFolio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateFolio = async () => {
    if (!folio.trim()) {
      setError('Por favor ingresa un folio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Buscar el folio en la base de datos
      const payments = await base44.entities.Payment.filter({
        folio: folio.trim().toUpperCase(),
        level: levelToUnlock,
        status: 'available',
        folio_type: folioType
      });

      if (payments.length === 0) {
        setError('Folio no válido, ya usado o no corresponde a este nivel');
        setLoading(false);
        return;
      }

      const payment = payments[0];

      // Verificar que el folio esté asignado a este alumno
      if (payment.user_email && payment.user_email !== userEmail) {
        setError('Este folio está asignado a otro alumno');
        setLoading(false);
        return;
      }

      // Marcar el folio como usado
      await base44.entities.Payment.update(payment.id, {
        status: 'used',
        user_email: userEmail,
        used_date: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);

    } catch (err) {
      setError('Error al validar el folio. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center pb-2">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-blue-600" />
        </div>
        <CardTitle>Desbloquear Nivel {levelToUnlock}</CardTitle>
        <p className="text-sm text-gray-500 mt-2">
          Ingresa tu folio de pago para acceder al siguiente nivel
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {success ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700">¡Folio Validado!</h3>
            <p className="text-gray-500">Accediendo al nivel...</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Folio de Pago
              </label>
              <Input
                placeholder="Ej: PAY-2024-XXXX"
                value={folio}
                onChange={(e) => setFolio(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-wider uppercase"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              className="w-full" 
              onClick={validateFolio}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Validar Folio
                </>
              )}
            </Button>

            <p className="text-xs text-center text-gray-400">
              El folio se obtiene al realizar el pago en la administración escolar
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}