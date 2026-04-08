import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Download, User, GraduationCap, AlertTriangle, CalendarDays, Trophy, Shield } from 'lucide-react';
import { differenceInDays, differenceInMonths } from 'date-fns';
import RecordSummaryCards from '@/components/student/RecordSummaryCards';
import RecordSubjectTable from '@/components/student/RecordSubjectTable';
import RecordEvalHistory from '@/components/student/RecordEvalHistory';
import AuditAttemptDetail from '@/components/audit/AuditAttemptDetail';

export default function StudentRecord() {
  const { user_email } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user_email) return;
    loadRecord();
  }, [user_email]);

  async function loadRecord() {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getStudentRecord', { user_email: decodeURIComponent(user_email) });
      setRecord(res.data);
    } catch (e) {
      setError('No se pudo cargar el expediente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    if (!record) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 20;

      // Header
      doc.setFontSize(18);
      doc.setTextColor(30, 30, 120);
      doc.text('Expediente Académico — Sistema Preparatoria', 14, y); y += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generado: ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: es })}`, 14, y); y += 12;

      // Student info
      doc.setFontSize(14);
      doc.setTextColor(30, 30, 30);
      doc.text(`Alumno: ${record.student.full_name}`, 14, y); y += 7;
      doc.setFontSize(10);
      doc.text(`Correo: ${record.student.email}`, 14, y); y += 5;
      if (record.student.curp) { doc.text(`CURP: ${record.student.curp}`, 14, y); y += 5; }
      if (record.student.enrollment_date) {
        doc.text(`Fecha de registro: ${format(new Date(record.student.enrollment_date), 'dd MMM yyyy', { locale: es })}`, 14, y); y += 5;
      }
      y += 5;

      // Summary
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 180);
      doc.text('Resumen académico', 14, y); y += 6;
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`Progreso general: ${record.summary.total_progress ?? 0}%`, 14, y); y += 5;
      doc.text(`Materias completadas: ${record.summary.subjects_completed} / ${record.summary.total_subjects}`, 14, y); y += 5;
      if (record.summary.average_grade !== null) {
        doc.text(`Promedio general: ${record.summary.average_grade}%`, 14, y); y += 5;
      }
      y += 5;

      // Subjects
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 180);
      doc.text('Materias', 14, y); y += 6;
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      for (const sub of record.subjects) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont(undefined, 'bold');
        doc.text(`${sub.subject_title}`, 14, y); y += 5;
        doc.setFont(undefined, 'normal');
        doc.text(`  Avance: ${sub.progress}%  |  Calificación: ${sub.final_grade !== null ? sub.final_grade + '%' : '—'}  |  Estado: ${sub.completed ? 'Completada' : 'En progreso'}`, 14, y); y += 7;
      }
      y += 5;

      // Evaluation history
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 180);
      doc.text('Historial de evaluaciones', 14, y); y += 6;
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      for (const a of record.evaluation_history) {
        if (y > 270) { doc.addPage(); y = 20; }
        const date = a.submitted_at ? format(new Date(a.submitted_at), 'dd/MM/yy HH:mm', { locale: es }) : '—';
        const path = [a.subject_title, a.lesson_title].filter(Boolean).join(' › ');
        doc.text(`${date}  |  ${a.type}  |  ${path}  |  Score: ${a.score ?? '—'}%  |  ${a.passed ? 'Aprobado' : 'No aprobado'}`, 14, y); y += 5;
      }

      const safeName = record.student.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`expediente_${safeName}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  if (!currentUser) return null;

  if (currentUser.role !== 'admin' && currentUser.role !== 'teacher') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold text-gray-800">Acceso denegado</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-red-500">{error || 'Expediente no encontrado.'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    );
  }

  // If viewing attempt detail
  if (selectedAttempt) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <AuditAttemptDetail
          attempt={selectedAttempt}
          onBack={() => setSelectedAttempt(null)}
          onReview={async ({ attempt_id, score, passed, feedback }) => {
            await base44.functions.invoke('reviewEvaluationAttempt', { attempt_id, score, passed, feedback });
            setSelectedAttempt(null);
            loadRecord();
          }}
          userRole={currentUser.role}
        />
      </div>
    );
  }

  const { student, summary, subjects, evaluation_history } = record;

  // Calcular duración total del curso
  function formatDuration(start, end) {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    const months = differenceInMonths(e, s);
    const days = differenceInDays(e, s) - months * 30;
    if (months > 0) return `${months} mes${months !== 1 ? 'es' : ''}${days > 0 ? ` ${days} día${days !== 1 ? 's' : ''}` : ''}`;
    return `${differenceInDays(e, s)} días`;
  }

  const isGraduated = student.graduation_status === 'completed' || student.graduation_status === 'certified';
  const isCertified = student.graduation_status === 'certified';
  const duration = formatDuration(student.fecha_inscripcion, student.course_completed_at);

  // Función para certificar al alumno (admin)
  async function handleCertifyStudent() {
    if (isCertified) return;
    try {
      await base44.functions.invoke('markStudentAsCertified', { user_email: student.email });
      loadRecord();
    } catch (e) {
      console.error('Error certifying student:', e);
    }
  }

  // Función para verificar integridad del snapshot
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  async function handleVerifyIntegrity() {
    setVerifyingIntegrity(true);
    try {
      const res = await base44.functions.invoke('verifyAcademicRecord', { user_email: student.email });
      console.log('Integrity check:', res.data);
      if (!res.data?.verified && res.data?.status !== 'no_snapshot') {
        alert('⚠️ ALERTA: El expediente presenta inconsistencias. Posible manipulación detectada.');
      } else if (res.data?.verified) {
        alert('✅ Expediente verificado: Integridad confirmada.');
      }
    } catch (e) {
      console.error('Error verifying integrity:', e);
    } finally {
      setVerifyingIntegrity(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-2">
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
          {currentUser.role === 'admin' && isGraduated && (
            <Button variant="outline" size="sm" onClick={handleVerifyIntegrity} disabled={verifyingIntegrity} className="gap-2">
              <Shield className="w-4 h-4" />
              {verifyingIntegrity ? 'Verificando...' : 'Verificar Integridad'}
            </Button>
          )}
        </div>
      </div>

      {/* Header alumno */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-white">
        <CardContent className="p-6 flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
            <GraduationCap className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{student.full_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{student.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {student.curp && (
                <Badge variant="outline" className="text-xs font-mono">CURP: {student.curp}</Badge>
              )}
              {student.current_level && (
                <Badge className="bg-indigo-100 text-indigo-700 text-xs">Nivel {student.current_level}</Badge>
              )}
              {student.fecha_inscripcion && (
                <Badge variant="outline" className="text-xs">
                  Inscripción: {format(new Date(student.fecha_inscripcion), 'dd MMM yyyy', { locale: es })}
                </Badge>
              )}
              {isCertified
                ? <Badge className="bg-purple-100 text-purple-700 text-xs gap-1"><Trophy className="w-3 h-3" />Certificado</Badge>
                : isGraduated
                  ? <Badge className="bg-blue-100 text-blue-700 text-xs gap-1"><Trophy className="w-3 h-3" />Egresado</Badge>
                  : student.graduation_status === 'in_progress'
                    ? <Badge className="bg-green-100 text-green-700 text-xs">En curso</Badge>
                    : <Badge className="bg-gray-100 text-gray-600 text-xs">Inscrito</Badge>
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <RecordSummaryCards summary={summary} />

      {/* Estado Académico */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Estado Académico</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Fecha de inscripción</p>
              <p className="font-medium text-gray-800">
                {student.fecha_inscripcion
                  ? format(new Date(student.fecha_inscripcion), 'dd MMM yyyy', { locale: es })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Fecha de egreso</p>
              <p className="font-medium text-gray-800">
                {student.course_completed_at
                  ? format(new Date(student.course_completed_at), 'dd MMM yyyy', { locale: es })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Tiempo total cursado</p>
              <p className="font-medium text-gray-800">{duration || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Estatus</p>
              {isCertified
                ? <Badge className="bg-purple-100 text-purple-700 gap-1 text-xs"><Trophy className="w-3 h-3" />Certificado</Badge>
                : isGraduated
                  ? <Badge className="bg-blue-100 text-blue-700 gap-1 text-xs"><Trophy className="w-3 h-3" />Egresado</Badge>
                  : student.graduation_status === 'in_progress'
                    ? <Badge className="bg-green-100 text-green-700 text-xs">En curso</Badge>
                    : <Badge className="bg-gray-100 text-gray-600 text-xs">Inscrito</Badge>
              }
            </div>
          </div>

          {currentUser.role === 'admin' && isGraduated && !isCertified && (
            <div className="mt-4 pt-4 border-t border-blue-100 flex justify-end">
              <Button 
                onClick={handleCertifyStudent} 
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Marcar como Certificado
              </Button>
            </div>
          )}
          {isCertified && student.certificate_validated_at && (
            <div className="mt-4 pt-4 border-t border-blue-100 text-xs text-gray-500">
              Certificado validado el {format(new Date(student.certificate_validated_at), 'dd MMM yyyy', { locale: es })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subjects table */}
      <RecordSubjectTable subjects={subjects} onSelectAttempt={setSelectedAttempt} />

      {/* Evaluation history */}
      <RecordEvalHistory history={evaluation_history} onSelectAttempt={setSelectedAttempt} />
    </div>
  );
}