import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Loader2, Shield, XCircle, Calendar, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';

const fmt = (dateStr) =>
  new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Pantalla de bloqueo por colegiatura vencida.
 * A diferencia del bloqueo por tiempo, aquí el alumno debe pagar su colegiatura
 * usando un folio tipo "installment" vía la función payInstallment.
 */
export default function InstallmentBlockScreen({ installmentNumber, dueDate, userEmail, onSuccess }) {
  const [folio, setFolio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePay = async () => {
    if (!folio.trim()) {
      setError('Ingresa tu folio de pago');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('payInstallment', { folio: folio.trim() });
      if (res.data?.success) {
        setSuccess(true);
        setTimeout(() => onSuccess?.(), 1500);
      } else {
        setError(res.data?.error || 'Error al procesar el pago');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Error al procesar el pago';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-red-700">Colegiatura Vencida</CardTitle>
            <p className="text-sm text-gray-500 mt-2">
              Tu colegiatura <strong>{installmentNumber}</strong> venció el{' '}
              <strong>{fmt(dueDate)}</strong>. Regulariza tu pago para restablecer tu acceso.
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {success ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-green-700">¡Pago Exitoso!</h3>
                <p className="text-gray-500">Restaurando tu acceso...</p>
              </div>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    Tu acceso está bloqueado por falta de pago. Ingresa tu folio de colegiatura para continuar.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Folio de Colegiatura
                  </label>
                  <Input
                    placeholder="Ej: PAY-XXXXXXXX"
                    value={folio}
                    onChange={(e) => setFolio(e.target.value.toUpperCase())}
                    className="text-center text-lg tracking-wider uppercase font-mono"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={handlePay}
                  disabled={loading || !folio.trim()}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                  ) : (
                    <><Shield className="w-4 h-4 mr-2" />Pagar Colegiatura</>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-gray-500"
                    onClick={() => window.location.href = createPageUrl('Profile')}
                  >
                    Ver todas mis colegiaturas
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-blue-800 font-medium">
                    📋 ¿Cómo obtener tu folio?
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Acude presencialmente a la administración escolar del plantel, realiza tu pago y te será entregado tu folio de colegiatura.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}