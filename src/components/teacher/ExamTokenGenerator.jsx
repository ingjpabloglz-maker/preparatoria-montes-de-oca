import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { KeyRound, Copy, CheckCircle2, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import { differenceInSeconds } from 'date-fns';

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const secs = Math.max(0, differenceInSeconds(new Date(expiresAt), new Date()));
      setRemaining(secs);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const display = `${hours > 0 ? `${hours}h ` : ''}${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  const percent = expiresAt
    ? Math.max(0, (remaining / (2 * 3600)) * 100)
    : 0;

  return { remaining, display, percent };
}

export default function ExamTokenGenerator() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [token, setToken] = useState(null); // { token_code, expires_at, subject_name }
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { remaining, display, percent } = useCountdown(token?.expires_at);

  useEffect(() => {
    base44.functions.invoke('getAcademicPlanSubjects', {}).then(res => {
      setSubjects(res.data?.subjects || []);
    }).catch(() => {});
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setToken(null);
    const subject = subjects.find(s => s.id === selectedSubjectId);
    const res = await base44.functions.invoke('generateExamToken', {
      subject_id: selectedSubjectId || undefined,
      subject_name: subject?.name || undefined,
    });
    setToken(res.data);
    setGenerating(false);
  }

  function handleCopy() {
    if (!token?.token_code) return;
    navigator.clipboard.writeText(token.token_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isExpired = remaining === 0 && token;

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          Generar código de examen presencial
        </CardTitle>
        <p className="text-xs text-gray-500">
          El alumno debe ingresar este código en la plataforma antes de iniciar su examen final.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Materia (opcional)</Label>
          <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar materia..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">— Sin restricción de materia —</SelectItem>
              {subjects.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
        >
          {generating
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generando...</>
            : <><KeyRound className="w-4 h-4" /> Generar código</>
          }
        </Button>

        {token && (
          <div className={`rounded-xl border-2 p-4 space-y-3 ${isExpired ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
            {/* Código */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Código de examen</p>
              <p className="text-4xl font-mono font-bold tracking-widest text-blue-800 select-all">
                {token.token_code}
              </p>
              {token.subject_name && (
                <Badge variant="outline" className="mt-2 text-xs">{token.subject_name}</Badge>
              )}
            </div>

            {/* Countdown */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-500">
                  <Clock className="w-3 h-3" /> Tiempo restante
                </span>
                <span className={`font-mono font-medium ${isExpired ? 'text-red-600' : 'text-blue-700'}`}>
                  {isExpired ? 'EXPIRADO' : display}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${isExpired ? 'bg-red-400' : percent > 30 ? 'bg-blue-500' : 'bg-orange-400'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                disabled={isExpired}
              >
                {copied
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Copiado</>
                  : <><Copy className="w-3.5 h-3.5" /> Copiar</>
                }
              </Button>
              <Button
                onClick={handleGenerate}
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                disabled={generating}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Nuevo
              </Button>
            </div>

            {isExpired && (
              <p className="text-xs text-red-600 text-center">
                Este código ha expirado. Genera uno nuevo para el alumno.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}