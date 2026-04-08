import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuditAttemptDetail from '@/components/audit/AuditAttemptDetail';
import { ClipboardCheck, Clock, CheckCircle2, XCircle, MessageCircle, User, BookOpen, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { hasPermission } from '@/lib/permissions';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [pendingAttempts, setPendingAttempts] = useState([]);
  const [reviewedAttempts, setReviewedAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Redirigir si no es docente
      if (u && !hasPermission(u, 'exam.review')) {
        window.location.href = '/';
      }
    }).catch(() => {});
  }, []);

  const loadAttempts = useCallback(async () => {
    setLoading(true);
    try {
      // Pendientes de revisión
      const [pendRes, reviewedRes] = await Promise.all([
        base44.functions.invoke('getEvaluationAttempts', {
          requires_manual_review: true,
          page: 1,
          limit: 20,
        }),
        base44.functions.invoke('getEvaluationAttempts', {
          requires_manual_review: false,
          type: 'final_exam',
          page: 1,
          limit: 20,
        }),
      ]);
      setPendingAttempts(pendRes.data?.attempts || []);
      // Filtrar solo los que ya fueron revisados por un docente
      const reviewed = (reviewedRes.data?.attempts || []).filter(a => a.reviewed_by);
      setReviewedAttempts(reviewed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadAttempts();
  }, [user, loadAttempts]);

  async function handleReview({ attempt_id, score, passed, feedback }) {
    await base44.functions.invoke('reviewEvaluationAttempt', { attempt_id, score, passed, feedback });
    setSelectedAttempt(null);
    loadAttempts();
  }

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel Docente</h1>
            <p className="text-sm text-gray-500">Revisión de exámenes finales y moderación del foro</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadAttempts} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{pendingAttempts.length}</p>
              <p className="text-xs text-yellow-600">Pendientes de revisión</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">
                {reviewedAttempts.filter(a => a.passed).length}
              </p>
              <p className="text-xs text-green-600">Aprobados por mí</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">
                {reviewedAttempts.filter(a => !a.passed).length}
              </p>
              <p className="text-xs text-red-600">Rechazados por mí</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedAttempt ? (
        <AuditAttemptDetail
          attempt={selectedAttempt}
          onBack={() => setSelectedAttempt(null)}
          onReview={handleReview}
          userRole={user.role}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pendientes
              {pendingAttempts.length > 0 && (
                <Badge className="bg-yellow-500 text-white text-xs ml-1 h-5 px-1.5">
                  {pendingAttempts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Revisados
            </TabsTrigger>
            <TabsTrigger value="forum" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Foro
            </TabsTrigger>
          </TabsList>

          {/* Pendientes */}
          <TabsContent value="pending">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
              </div>
            ) : pendingAttempts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No hay exámenes pendientes de revisión</p>
                  <p className="text-gray-400 text-sm mt-1">Cuando un alumno entregue un examen final, aparecerá aquí.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingAttempts.map(attempt => (
                  <AttemptCard key={attempt.id} attempt={attempt} onSelect={setSelectedAttempt} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Revisados */}
          <TabsContent value="reviewed">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
              </div>
            ) : reviewedAttempts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aún no has revisado ningún examen.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviewedAttempts.map(attempt => (
                  <AttemptCard key={attempt.id} attempt={attempt} onSelect={setSelectedAttempt} showDecision />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Foro */}
          <TabsContent value="forum">
            <Card>
              <CardContent className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-4">Ir al Foro para Moderar</p>
                <Link to="/Forum">
                  <Button className="gap-2">
                    <MessageCircle className="w-4 h-4" /> Abrir Foro
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function AttemptCard({ attempt, onSelect, showDecision = false }) {
  const isPending = attempt.requires_manual_review;
  const approved = attempt.passed === true;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: isPending ? '#f59e0b' : approved ? '#22c55e' : '#ef4444' }}
      onClick={() => onSelect(attempt)}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900 truncate">{attempt.full_name || attempt.user_email}</p>
            {isPending && (
              <Badge className="bg-yellow-100 text-yellow-700 gap-1 text-xs shrink-0">
                <Clock className="w-3 h-3" /> Pendiente
              </Badge>
            )}
            {showDecision && !isPending && (
              approved
                ? <Badge className="bg-green-100 text-green-700 gap-1 text-xs shrink-0"><CheckCircle2 className="w-3 h-3" /> Aprobado</Badge>
                : <Badge className="bg-red-100 text-red-700 gap-1 text-xs shrink-0"><XCircle className="w-3 h-3" /> Rechazado</Badge>
            )}
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>{attempt.subject_title || 'Materia'}</span>
            <span>·</span>
            <span>Intento #{attempt.attempt_number}</span>
            <span>·</span>
            <span>{attempt.score ?? '—'}%</span>
            {attempt.submitted_at && (
              <>
                <span>·</span>
                <span>{format(new Date(attempt.submitted_at), "d MMM yyyy HH:mm", { locale: es })}</span>
              </>
            )}
          </div>
          {showDecision && attempt.reviewed_by && (
            <p className="text-xs text-gray-400 mt-1">
              Revisado por: {attempt.reviewer_name || attempt.reviewed_by}
              {attempt.reviewed_at && ` — ${format(new Date(attempt.reviewed_at), "d MMM yyyy", { locale: es })}`}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="shrink-0">Ver detalle →</Button>
      </CardContent>
    </Card>
  );
}