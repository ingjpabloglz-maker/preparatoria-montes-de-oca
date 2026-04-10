import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GraduationCap, KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function WelcomeGate({ onValidated }) {
  const [folio, setFolio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!folio.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('validateLevel1Folio', { folio: folio.trim() });
      if (res.data?.status === 'ok') {
        onValidated();
      } else {
        setError(res.data?.error || 'Error al validar el folio. Intenta de nuevo.');
      }
    } catch (err) {
      // Axios lanza error en respuestas 4xx/5xx — extraer mensaje del backend
      const msg = err?.response?.data?.error || 'Error al validar el folio. Intenta de nuevo.';
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-lg">
        {/* Header institucional */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Bienvenido a la<br />
            <span className="text-blue-700">Escuela Preparatoria<br />Fernando Montes de Oca</span>
          </h1>
          <p className="text-sm text-gray-500 mt-2">Modalidad en línea — Bachillerato General</p>
        </div>

        {/* Tarjeta principal */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="text-center mb-6">
            <p className="text-gray-700 font-medium text-lg">¡Nos alegra tenerte aquí!</p>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              Para comenzar tu formación académica, es necesario validar tu acceso mediante tu folio de inscripción del <strong>Nivel 1</strong>.
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm text-blue-800">
            <p className="font-medium mb-1">🧾 Instrucciones</p>
            <p>Ingresa tu folio de pago proporcionado por la institución para desbloquear tu acceso a la plataforma.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Ingresa tu folio de inscripción"
                value={folio}
                onChange={(e) => setFolio(e.target.value.toUpperCase())}
                className="pl-10 text-center font-mono tracking-widest text-lg h-12"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-base" disabled={loading || !folio.trim()}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" />Validar folio y comenzar</>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Si no tienes un folio, comunícate con la administración de tu plantel.
        </p>
      </div>
    </div>
  );
}