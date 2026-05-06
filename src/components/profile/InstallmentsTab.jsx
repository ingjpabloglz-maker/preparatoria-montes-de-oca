import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Loader2,
  Shield,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

const statusConfig = {
  paid:    { label: 'Pagado',   color: 'bg-green-100 text-green-800',  icon: CheckCircle2 },
  pending: { label: 'Pendiente', color: 'bg-blue-100 text-blue-800',   icon: Clock },
  overdue: { label: 'Vencido',  color: 'bg-red-100 text-red-800',     icon: AlertTriangle },
};

function InstallmentCard({ inst, isNext, onPay }) {
  const [folio, setFolio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const cfg = statusConfig[inst.status] || statusConfig.pending;
  const Icon = cfg.icon;

  const handlePay = async () => {
    if (!folio.trim()) { setError('Ingresa tu folio de pago'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('payInstallment', { folio });
      if (res.data?.success) {
        toast.success(`¡Colegiatura ${inst.installment_number} pagada!`);
        setShowForm(false);
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

  const formattedDue = new Date(inst.due_date).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const formattedPaid = inst.paid_at ? new Date(inst.paid_at).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric'
  }) : null;

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${
      inst.status === 'overdue' ? 'border-red-200 bg-red-50' :
      inst.status === 'paid' ? 'border-green-200 bg-green-50' :
      isNext ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            inst.status === 'paid' ? 'bg-green-200' :
            inst.status === 'overdue' ? 'bg-red-200' : 'bg-blue-100'
          }`}>
            <Icon className={`w-4 h-4 ${
              inst.status === 'paid' ? 'text-green-700' :
              inst.status === 'overdue' ? 'text-red-700' : 'text-blue-600'
            }`} />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Colegiatura {inst.installment_number}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {inst.status === 'paid' ? `Pagada el ${formattedPaid}` : `Vence: ${formattedDue}`}
            </p>
          </div>
        </div>
        <Badge className={cfg.color}>{cfg.label}</Badge>
      </div>

      {isNext && inst.status !== 'paid' && !showForm && (
        <Button size="sm" className="w-full" onClick={() => setShowForm(true)}>
          <CreditCard className="w-4 h-4 mr-2" />
          Pagar con folio
        </Button>
      )}

      {showForm && (
        <div className="space-y-2">
          <Input
            placeholder="Código del folio (ej: PAY-XXXXXXXX)"
            value={folio}
            onChange={e => setFolio(e.target.value.toUpperCase())}
            className="text-center tracking-wider uppercase"
          />
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setShowForm(false); setError(''); }}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={handlePay} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Shield className="w-4 h-4 mr-1" />Confirmar</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InstallmentsTab({ userEmail }) {
  const queryClient = useQueryClient();

  const { data: progress } = useQuery({
    queryKey: ['userProgress', userEmail],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const level = progress?.current_level || 1;

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['installments', userEmail, level],
    queryFn: () => base44.entities.LevelPaymentPlan.filter({ user_email: userEmail, level }),
    enabled: !!userEmail,
  });

  const sorted = [...installments].sort((a, b) => a.installment_number - b.installment_number);
  const nextIndex = sorted.findIndex(i => i.status !== 'paid');
  const paidCount = sorted.filter(i => i.status === 'paid').length;
  const overdueCount = sorted.filter(i => i.status === 'overdue').length;

  const handlePay = () => {
    queryClient.invalidateQueries(['installments', userEmail, level]);
    queryClient.invalidateQueries(['userProgress', userEmail]);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (sorted.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-10 text-center text-gray-400">
          <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No hay colegiaturas registradas para el Nivel {level}.</p>
          <p className="text-xs mt-1">Se generan automáticamente al iniciar el nivel.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{paidCount}</p>
            <p className="text-xs text-gray-500">Pagadas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{4 - paidCount - overdueCount}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            <p className="text-xs text-gray-500">Vencidas</p>
          </CardContent>
        </Card>
      </div>

      {overdueCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Tienes {overdueCount} colegiatura{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''}. Paga para restablecer tu acceso.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de colegiaturas */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-600">Colegiaturas — Nivel {level}</p>
        {sorted.map((inst, idx) => (
          <InstallmentCard
            key={inst.id}
            inst={inst}
            isNext={idx === nextIndex}
            onPay={handlePay}
          />
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
        <p className="text-xs text-blue-700">
          📋 Para pagar, acude a la administración escolar y solicita tu folio de colegiatura.
        </p>
      </div>
    </div>
  );
}