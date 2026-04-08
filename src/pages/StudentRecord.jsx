import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Download, User, GraduationCap, AlertTriangle } from 'lucide-react';
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-2">
          <Download className="w-4 h-4" />
          {exporting ? 'Exportando...' : 'Exportar PDF'}
        </Button>
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
              {student.enrollment_date && (
                <Badge variant="outline" className="text-xs">
                  Ingreso: {format(new Date(student.enrollment_date), 'dd MMM yyyy', { locale: es })}
                </Badge>
              )}
              <Badge className="bg-green-100 text-green-700 text-xs">Activo</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <RecordSummaryCards summary={summary} />

      {/* Subjects table */}
      <RecordSubjectTable subjects={subjects} onSelectAttempt={setSelectedAttempt} />

      {/* Evaluation history */}
      <RecordEvalHistory history={evaluation_history} onSelectAttempt={setSelectedAttempt} />
    </div>
  );
}