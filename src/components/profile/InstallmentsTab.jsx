import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Shield,
  Calendar,
  Lock,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

// ── helpers ────────────────────────────────────────────────────────────────────
const fmt = (dateStr, opts) =>
  new Date(dateStr).toLocaleDateString('es-MX', opts || { day: 'numeric', month: 'long', year: 'numeric' });

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── PayForm ────────────────────────────────────────────────────────────────────
function PayForm({ installmentNumber, onPay, onCancel }) {
  const [folio, setFolio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!folio.trim()) { setError('Ingresa tu folio de pago'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('payInstallment', { folio });
      if (res.data?.success) {
        toast.success(`¡Colegiatura ${installmentNumber} pagada exitosamente!`);
        onPay?.();
      } else {
        setError(res.data?.error || 'Error al procesar el pago');
      }
    } catch (e) {
      setError(e.message || 'Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200 space-y-2">
      <p className="text-xs text-gray-500 font-medium">Ingresa tu folio de colegiatura:</p>
      <Input
        placeholder="Ej: PAY-XXXXXXXX"
        value={folio}
        onChange={e => setFolio(e.target.value.toUpperCase())}
        className="text-center tracking-wider uppercase font-mono"
        autoFocus
      />
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="flex-1" onClick={handlePay} disabled={loading}>
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <><Shield className="w-4 h-4 mr-1" />Confirmar pago</>}
        </Button>
      </div>
    </div>
  );
}

// ── InstallmentRow (timeline item) ────────────────────────────────────────────
function InstallmentRow({ inst, isNext, onPay }) {
  const [showForm, setShowForm] = useState(false);
  const days = inst.status !== 'paid' ? daysUntil(inst.due_date) : null;
  const isLocked = !isNext && inst.status === 'pending';

  const statusMap = {
    paid:    { icon: CheckCircle2, dot: 'bg-green-500', label: 'Pagada',   text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    overdue: { icon: AlertTriangle, dot: 'bg-red-500',  label: 'Vencida',  text: 'text-red-700',   bg: 'bg-red-50 border-red-200' },
    pending: isLocked
      ? { icon: Lock,         dot: 'bg-gray-300',  label: 'Bloqueada', text: 'text-gray-400',   bg: 'bg-gray-50 border-gray-200' }
      : { icon: Clock,        dot: 'bg-blue-500',  label: 'Pendiente', text: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  };
  const s = statusMap[inst.status] || statusMap.pending;
  const Icon = s.icon;

  return (
    <div className={`rounded-xl border p-4 space-y-1 transition-all ${s.bg} ${isLocked ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* dot connector */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.dot} bg-opacity-20`}>
            <Icon className={`w-4 h-4 ${s.text}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${isLocked ? 'text-gray-400' : 'text-gray-900'}`}>
              Colegiatura {inst.installment_number}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />
              {inst.status === 'paid'
                ? `Pagada el ${fmt(inst.paid_at)}`
                : `Vence: ${fmt(inst.due_date)}`}
            </p>
            {inst.folio_used && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">Folio: {inst.folio_used}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={`text-xs ${s.text} border-0 ${inst.status === 'paid' ? 'bg-green-100' : inst.status === 'overdue' ? 'bg-red-100' : isLocked ? 'bg-gray-100' : 'bg-blue-100'}`}>
            {s.label}
          </Badge>
          {days !== null && !isLocked && inst.status !== 'paid' && (
            <span className={`text-xs font-medium ${days <= 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-400'}`}>
              {days <= 0 ? 'Vencida' : `${days}d`}
            </span>
          )}
        </div>
      </div>

      {/* Action button */}
      {isNext && inst.status !== 'paid' && !showForm && (
        <Button
          size="sm"
          className={`w-full mt-2 ${inst.status === 'overdue' ? 'bg-red-600 hover:bg-red-700' : ''}`}
          onClick={() => setShowForm(true)}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          {inst.status === 'overdue' ? 'Pagar (acceso bloqueado)' : 'Pagar con folio'}
        </Button>
      )}

      {showForm && (
        <PayForm
          installmentNumber={inst.installment_number}
          onPay={() => { setShowForm(false); onPay?.(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InstallmentsTab({ userEmail }) {
  const queryClient = useQueryClient();

  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['userProgress', userEmail],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const level = progress?.current_level || 1;

  const { data: installments = [], isLoading: loadingInstallments } = useQuery({
    queryKey: ['installments', userEmail, level],
    queryFn: () => base44.entities.LevelPaymentPlan.filter({ user_email: userEmail, level }),
    enabled: !!userEmail,
  });

  const isLoading = loadingProgress || loadingInstallments;

  const sorted = [...installments].sort((a, b) => a.installment_number - b.installment_number);
  const nextIndex = sorted.findIndex(i => i.status !== 'paid');
  const paidCount = sorted.filter(i => i.status === 'paid').length;
  const overdueCount = sorted.filter(i => i.status === 'overdue').length;
  const nextDue = sorted.find(i => i.status !== 'paid');
  const daysToNext = nextDue ? daysUntil(nextDue.due_date) : null;

  const handlePay = () => {
    queryClient.invalidateQueries(['installments', userEmail, level]);
    queryClient.invalidateQueries(['userProgress', userEmail]);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
      </div>
    );
  }

  // ── Estado vacío ─────────────────────────────────────────────────────────────
  if (sorted.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center space-y-3">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-7 h-7 text-blue-300" />
          </div>
          <p className="font-medium text-gray-700">Sin colegiaturas registradas</p>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            Las colegiaturas se generan automáticamente al activar el acceso al nivel con un folio de inscripción.
          </p>
          {!progress && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-2 inline-block">
              Aún no has activado tu nivel. Solicita tu folio en la administración escolar.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Alertas dinámicas ─────────────────────────────────────────────────────────
  const hasOverdue = overdueCount > 0;
  const nearDue = !hasOverdue && daysToNext !== null && daysToNext <= 7 && daysToNext >= 0;

  // ── Progreso de pagos ────────────────────────────────────────────────────────
  const payProgress = Math.round((paidCount / 4) * 100);
  const academicProgress = progress?.total_progress_percent || 0;

  return (
    <div className="space-y-5">

      {/* ── Tarjeta resumen superior ── */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wider font-medium">Nivel actual</p>
              <p className="text-3xl font-bold">{level}</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-xs uppercase tracking-wider font-medium">Colegiatura</p>
              <p className="text-3xl font-bold">{paidCount} <span className="text-blue-300 text-lg">/ 4</span></p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-blue-200">
              <span>Pagos completados</span>
              <span>{payProgress}%</span>
            </div>
            <div className="h-2 bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${payProgress}%` }}
              />
            </div>
          </div>
          {daysToNext !== null && !hasOverdue && (
            <p className="text-xs text-blue-200 mt-3">
              {daysToNext <= 0
                ? '⚠ La próxima colegiatura está vencida'
                : `📅 Próximo vencimiento en ${daysToNext} día${daysToNext !== 1 ? 's' : ''}`}
            </p>
          )}
          {hasOverdue && (
            <p className="text-xs text-red-300 font-medium mt-3">
              🔴 Acceso bloqueado — {overdueCount} colegiatura{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Alertas ── */}
      {hasOverdue && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="font-medium">
            Tu acceso está bloqueado por falta de pago. Paga la colegiatura vencida para restaurar tu acceso inmediatamente.
          </AlertDescription>
        </Alert>
      )}
      {nearDue && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Tu próxima colegiatura vence en <strong>{daysToNext} día{daysToNext !== 1 ? 's' : ''}</strong>. Evita bloqueos pagando antes de la fecha.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Progreso académico ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-medium text-gray-700">Progreso académico</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Avance del nivel {level}</span>
              <span className="font-medium text-gray-700">{Math.round(academicProgress)}%</span>
            </div>
            <Progress value={academicProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* ── Timeline de colegiaturas ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <BookOpen className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-medium text-gray-600">Colegiaturas — Nivel {level}</p>
        </div>
        {sorted.map((inst, idx) => (
          <InstallmentRow
            key={inst.id}
            inst={inst}
            isNext={idx === nextIndex}
            onPay={handlePay}
          />
        ))}
      </div>

      {/* ── Historial de pagos ── */}
      {paidCount > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Historial de pagos
            </p>
            <div className="divide-y divide-gray-100">
              {sorted.filter(i => i.status === 'paid').map(inst => (
                <div key={inst.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-800">Colegiatura {inst.installment_number}</span>
                    {inst.folio_used && (
                      <span className="ml-2 text-xs text-gray-400 font-mono">{inst.folio_used}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{inst.paid_at ? fmt(inst.paid_at) : '—'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
        <p className="text-xs text-blue-600">
          📋 Para pagar, acude a la administración escolar y solicita tu folio de colegiatura.
        </p>
      </div>
    </div>
  );
}