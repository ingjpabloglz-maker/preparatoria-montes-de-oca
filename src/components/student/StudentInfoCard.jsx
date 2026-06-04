import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, Mail, CreditCard, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || 'Sin nombre');
};

function fmtDate(d) {
  try { return format(new Date(d), "dd/MM/yy"); } catch { return '—'; }
}

export default function StudentInfoCard({ student, progress, paymentPlans = [] }) {
  const profileComplete = student.nombres && student.apellido_paterno && student.telefono_personal && student.correo_contacto;
  const currentLevel = progress?.current_level || 1;

  // Filtrar colegiaturas del nivel actual
  const levelPlans = paymentPlans
    .filter(p => p.level === currentLevel)
    .sort((a, b) => a.installment_number - b.installment_number);

  const paidCount = levelPlans.filter(p => p.status === 'paid').length;
  const overdueCount = levelPlans.filter(p => p.status === 'overdue').length;
  const totalCount = levelPlans.length || 4;
  const payProgress = Math.round((paidCount / totalCount) * 100);

  const statusConfig = {
    paid:    { cls: 'bg-green-50 border-green-200 text-green-800',  dot: 'bg-green-500',  label: 'Pagada' },
    overdue: { cls: 'bg-red-50 border-red-200 text-red-700',        dot: 'bg-red-500',    label: 'Vencida' },
    pending: { cls: 'bg-gray-50 border-gray-200 text-gray-500',     dot: 'bg-gray-300',   label: 'Pendiente' },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Columna izquierda: Info básica */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xl text-gray-900 truncate">{formatName(student)}</p>
              <p className="text-gray-500 flex items-center gap-1 text-sm mt-1">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{student.email}</span>
              </p>
              {student.curp && (
                <p className="text-xs text-gray-400 mt-1 font-mono">CURP: {student.curp}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Inscrito: {student.created_date ? format(new Date(student.created_date), "d 'de' MMMM, yyyy", { locale: es }) : 'N/A'}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Nivel {currentLevel}</Badge>
                {progress?.graduation_status === 'completed' && (
                  <Badge className="bg-green-100 text-green-800 border-0 text-xs">Egresado</Badge>
                )}
                {progress?.graduation_status === 'certified' && (
                  <Badge className="bg-purple-100 text-purple-800 border-0 text-xs">Certificado</Badge>
                )}
                {!profileComplete && (
                  <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">
                    Perfil incompleto
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Columna derecha: Estado de colegiaturas */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-700">
              Colegiaturas — Nivel {currentLevel}
            </p>
          </div>

          {levelPlans.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sin plan de pagos para este nivel.</p>
          ) : (
            <>
              {/* Mini-grid 2x2 */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[1, 2, 3, 4].map(num => {
                  const plan = levelPlans.find(p => p.installment_number === num);
                  const status = plan?.status || 'pending';
                  const cfg = statusConfig[status] || statusConfig.pending;
                  return (
                    <div key={num} className={`rounded-lg border p-2.5 text-xs ${cfg.cls}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">Mens. {num}</span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      </div>
                      <p className="text-[10px] opacity-75 font-medium">{cfg.label}</p>
                      {plan && (
                        <p className="text-[10px] mt-0.5 opacity-60 truncate">
                          {status === 'paid'
                            ? (plan.folio_used ? `Folio: ${plan.folio_used}` : fmtDate(plan.paid_at))
                            : `Vence: ${fmtDate(plan.due_date)}`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Barra de progreso */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Pagadas: <strong className="text-gray-800">{paidCount} / {totalCount}</strong></span>
                  <span className={overdueCount > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                    {overdueCount > 0 ? `${overdueCount} vencida${overdueCount > 1 ? 's' : ''}` : `${payProgress}%`}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${overdueCount > 0 ? 'bg-red-400' : 'bg-green-500'}`}
                    style={{ width: `${payProgress}%` }}
                  />
                </div>
              </div>

              {/* Alerta de vencimiento */}
              {overdueCount > 0 && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Acceso bloqueado por colegiatura vencida
                </div>
              )}
              {overdueCount === 0 && paidCount < totalCount && (
                (() => {
                  const nextPlan = levelPlans.find(p => p.status === 'pending');
                  if (!nextPlan) return null;
                  return (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      Próximo vencimiento: {fmtDate(nextPlan.due_date)}
                    </div>
                  );
                })()
              )}
              {paidCount === totalCount && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  Todas las colegiaturas pagadas
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}