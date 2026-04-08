import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, KeyRound, Loader2, AlertTriangle } from 'lucide-react';

const ERROR_MESSAGES = {
  TOKEN_NOT_FOUND: 'Código no encontrado. Verifica que lo hayas escrito correctamente.',
  TOKEN_ALREADY_USED: 'Este código ya fue utilizado. Solicita uno nuevo a tu docente.',
  TOKEN_INACTIVE: 'Este código ha sido desactivado. Solicita uno nuevo.',
  TOKEN_EXPIRED: 'El código ha expirado. Solicita un nuevo código a tu docente.',
  TOKEN_SUBJECT_MISMATCH: 'Este código no corresponde a esta materia.',
};

export default function PresentialTokenModal({ subjectId, onValidated, onCancel }) {
  const [tokenCode, setTokenCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleValidate() {
    const code = tokenCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Ingresa el código completo proporcionado por tu docente.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('validateExamToken', {
      token_code: code,
      subject_id: subjectId,
    });
    if (res.data?.valid && res.data?.session_token) {
      onValidated(res.data.session_token, res.data.session_expires_at);
    } else {
      const errCode = res.data?.error || 'UNKNOWN';
      setError(ERROR_MESSAGES[errCode] || 'Código inválido. Intenta de nuevo.');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Validación Presencial</h2>
          <p className="text-sm text-gray-500 mt-1">
            Este examen final debe presentarse de forma presencial.<br />
            Solicita el código de acceso a tu docente.
          </p>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">📍 ¿Por qué necesito un código?</p>
          <p>El examen final se presenta en las instalaciones del plantel bajo supervisión docente. El código confirma que estás en el lugar correcto.</p>
        </div>

        {/* Input */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Código proporcionado por tu docente</Label>
          <Input
            value={tokenCode}
            onChange={e => {
              setTokenCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={e => e.key === 'Enter' && handleValidate()}
            placeholder="Ej. A7K9L2"
            maxLength={10}
            className="text-center text-2xl font-mono tracking-widest uppercase h-14"
            autoFocus
          />
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleValidate}
            disabled={loading || tokenCode.trim().length < 4}
            className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando...</>
              : <><KeyRound className="w-4 h-4" /> Validar y comenzar</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}