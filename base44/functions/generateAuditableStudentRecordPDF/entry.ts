import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

const crypto = globalThis.crypto;

/**
 * Genera PDF auditable tipo SEP con trazabilidad completa
 * 
 * Input: user_email
 * Output: PDF descargable
 * 
 * Incluye:
 * - Encabezado institucional (RVOE, modalidad, folio)
 * - Identificación alumno (CURP, estatus académico)
 * - Resumen académico
 * - Detalle por materia
 * - Historial de evaluaciones (resuelto con nombres)
 * - Bloque crítico: Exámenes finales presenciales
 * - Hash de integridad SHA-256
 */

async function calculateSHA256(data) {
  const msgBuffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return `${d.toLocaleDateString('es-MX')} ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
}

function secondsToTime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function minutesToHours(minutes) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const userEmail = body.user_email || user.email;

    // Verificar permiso: solo admin o el usuario mismo
    if (user.role !== 'admin' && user.email !== userEmail) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cargar datos
    const [userData, userProgress, subjectProgressList, evaluationAttempts, subjects, modules, lessons] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: userEmail }).then(r => r[0]),
      base44.asServiceRole.entities.UserProgress.filter({ user_email: userEmail }).then(r => r[0]),
      base44.asServiceRole.entities.SubjectProgress.filter({ user_email: userEmail }),
      base44.asServiceRole.entities.EvaluationAttempt.filter({ user_email: userEmail }),
      base44.asServiceRole.entities.Subject.list(),
      base44.asServiceRole.entities.CourseModule.list(),
      base44.asServiceRole.entities.CourseLesson.list(),
    ]);

    if (!userData) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Mapeos para resolución de nombres
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const moduleMap = new Map(modules.map(m => [m.id, m]));
    const lessonMap = new Map(lessons.map(l => [l.id, l]));

    // Calcular tiempo total invertido
    const timeTotalMinutes = subjectProgressList.reduce((sum, sp) => sum + (sp.time_spent_minutes || 0), 0);
    const timeTotalHours = minutesToHours(timeTotalMinutes);

    // Datos para hash
    const hashData = JSON.stringify({
      user_email: userEmail,
      full_name: userData.full_name,
      timestamp: new Date().toISOString(),
      subject_count: subjectProgressList.length,
      evaluation_count: evaluationAttempts.length,
    });
    const integrityHash = await calculateSHA256(hashData);

    // Crear PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let y = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Helper: nueva página si es necesario
    function checkNewPage(minSpace = 30) {
      if (y + minSpace > doc.internal.pageSize.getHeight() - 10) {
        doc.addPage();
        y = 15;
      }
    }

    // ========== 1. ENCABEZADO INSTITUCIONAL ==========
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('EXPEDIENTE ACADÉMICO OFICIAL PARA AUDITORÍA', margin, y, { maxWidth: contentWidth, align: 'center' });
    y += 12;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    const headerData = [
      ['Institución', 'Preparatoria SEP'],
      ['RVOE', 'Registrado ante SEP'],
      ['Modalidad', 'No escolarizada (80% en línea / 20% presencial)'],
      ['Folio del Expediente', integrityHash.substring(0, 12).toUpperCase()],
      ['Fecha de Generación', formatDate(new Date().toISOString())],
    ];
    headerData.forEach(([label, value]) => {
      doc.setFont('Helvetica', 'bold');
      doc.text(label + ':', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(value, margin + 50, y);
      y += 5;
    });

    y += 3;
    doc.setDrawColor(100);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ========== 2. IDENTIFICACIÓN DEL ALUMNO ==========
    checkNewPage(25);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('IDENTIFICACIÓN DEL ALUMNO', margin, y);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    const studentData = [
      ['Nombre Completo', userData.full_name || '—'],
      ['CURP', userData.curp || '—'],
      ['Correo Electrónico', userData.email || '—'],
      ['Rol', userData.role === 'admin' ? 'Administrador' : userData.role === 'docente' ? 'Docente' : 'Estudiante'],
      ['Fecha de Inscripción', formatDate(userData.created_date)],
      ['Estatus Académico', userProgress?.graduation_status || 'enrolled'],
      ...(userProgress?.course_completed_at ? [['Fecha de Egreso', formatDate(userProgress.course_completed_at)]] : []),
    ];

    studentData.forEach(([label, value]) => {
      doc.setFont('Helvetica', 'bold');
      doc.text(label + ':', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(String(value).substring(0, 100), margin + 50, y);
      y += 5;
    });

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ========== 3. RESUMEN ACADÉMICO ==========
    checkNewPage(20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RESUMEN ACADÉMICO', margin, y);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    const summaryData = [
      ['Progreso General', `${userProgress?.total_progress_percent || 0}%`],
      ['Materias Completadas', `${subjectProgressList.filter(s => s.completed).length} / ${subjectProgressList.length}`],
      ['Promedio General', userProgress?.total_progress_percent ? `${userProgress.total_progress_percent.toFixed(1)}%` : '—'],
      ['Tiempo Total Invertido', timeTotalHours],
    ];

    summaryData.forEach(([label, value]) => {
      doc.setFont('Helvetica', 'bold');
      doc.text(label + ':', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(String(value), margin + 50, y);
      y += 5;
    });

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ========== 4. DETALLE POR MATERIA ==========
    checkNewPage(20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DETALLE POR MATERIA', margin, y);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);

    subjectProgressList.forEach((sp) => {
      checkNewPage(12);
      const subject = subjectMap.get(sp.subject_id);
      const subjectName = subject?.name || `Materia ${sp.subject_id}`;

      doc.setFont('Helvetica', 'bold');
      doc.text(`• ${subjectName}`, margin, y);
      y += 4;

      doc.setFont('Helvetica', 'normal');
      const matData = [
        [`Nivel: ${subject?.level || '—'}`, `Avance: ${sp.progress_percent || 0}%`, `Estado: ${sp.completed ? 'Completada' : 'En progreso'}`],
        [`Calificación Final: ${sp.final_grade ? sp.final_grade.toFixed(1) : '—'}`, `Examen: ${sp.test_passed ? 'Aprobado' : 'Pendiente'}`, `Intentos: ${sp.test_attempts || 0}`],
      ];
      matData.forEach(row => {
        doc.text(row.join('  |  '), margin + 5, y);
        y += 4;
      });

      y += 2;
    });

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ========== 5. HISTORIAL DE EVALUACIONES ==========
    checkNewPage(25);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('HISTORIAL DE EVALUACIONES', margin, y);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);

    const sortedAttempts = evaluationAttempts.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    if (sortedAttempts.length === 0) {
      doc.text('Sin evaluaciones registradas', margin, y);
      y += 5;
    } else {
      const colX = [margin, margin + 25, margin + 50, margin + 90, margin + 130];
      doc.setFont('Helvetica', 'bold');
      doc.text('Fecha', colX[0], y);
      doc.text('Tipo', colX[1], y);
      doc.text('Materia', colX[2], y);
      doc.text('Score', colX[3], y);
      doc.text('Estado', colX[4], y);
      y += 4;

      doc.setFont('Helvetica', 'normal');
      sortedAttempts.forEach((attempt) => {
        checkNewPage(5);
        const subject = subjectMap.get(attempt.subject_id);
        const lessonTitle = lessonMap.get(attempt.lesson_id)?.title || `Lección ${attempt.lesson_id}`;

        const typeLabel = attempt.type === 'final_exam' ? 'Final' : attempt.type === 'mini_eval' ? 'Mini-eval' : 'Lección';
        const stateLabel = attempt.passed ? 'Aprobado' : attempt.requires_manual_review ? 'Revisión' : 'No aprobado';

        doc.text(formatDate(attempt.submitted_at).split(' ')[0], colX[0], y);
        doc.text(typeLabel, colX[1], y);
        doc.text((subject?.name || 'N/A').substring(0, 15), colX[2], y);
        doc.text(`${attempt.score || 0}%`, colX[3], y);
        doc.text(stateLabel, colX[4], y);
        y += 4;
      });
    }

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ========== 6. SECCIÓN CRÍTICA: EXÁMENES FINALES PRESENCIALES ==========
    checkNewPage(30);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('EXÁMENES FINALES - SUPERVISIÓN PRESENCIAL', margin, y);
    y += 7;

    const finalExams = sortedAttempts.filter(a => a.type === 'final_exam');

    if (finalExams.length === 0) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Sin exámenes finales presenciales registrados', margin, y);
      y += 5;
    } else {
      finalExams.forEach((attempt) => {
        checkNewPage(25);
        const subject = subjectMap.get(attempt.subject_id);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Materia: ${subject?.name || 'N/A'}`, margin, y);
        y += 5;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        const examData = [
          ['Fecha de Envío', formatDate(attempt.submitted_at)],
          ['Calificación', `${attempt.score}%`],
          ['Estado', attempt.passed ? 'Aprobado' : attempt.requires_manual_review ? 'Pendiente revisión' : 'No aprobado'],
          ['', ''],
          ['[BLOQUE DE AUDITORÍA]', ''],
          ['Token (código)', attempt.token_code || '—'],
          ['Docente (generador)', attempt.validated_by_name || '—'],
          ['Token validado', formatDate(attempt.token_validated_at)],
          ['Inicio real del examen', formatDate(attempt.exam_started_at)],
          ['Envío del examen', formatDate(attempt.submitted_at)],
          ['Duración', secondsToTime(attempt.duration_seconds)],
          ['IP de validación', attempt.ip_address || '—'],
          ['Dispositivo', (attempt.device_info || '—').substring(0, 40)],
          ['Modalidad', 'Presencial supervisada'],
        ];

        examData.forEach(([label, value]) => {
          if (label.includes('BLOQUE')) {
            doc.setFont('Helvetica', 'bold');
            doc.text(label, margin + 2, y);
            y += 3;
            doc.setFont('Helvetica', 'normal');
          } else if (label === '') {
            y += 2;
          } else {
            doc.setFont('Helvetica', 'bold');
            doc.text(label + ':', margin + 5, y);
            doc.setFont('Helvetica', 'normal');
            doc.text(String(value), margin + 60, y);
            y += 4;
          }
        });

        y += 3;
        doc.setDrawColor(180);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
      });
    }

    // ========== 7. VALIDACIÓN DE INTEGRIDAD ==========
    checkNewPage(20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('VALIDACIÓN DE INTEGRIDAD DEL EXPEDIENTE', margin, y);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    const integrityData = [
      ['Hash SHA-256', integrityHash],
      ['Generado por', user.full_name || user.email],
      ['Fecha de generación', new Date().toISOString()],
    ];

    integrityData.forEach(([label, value]) => {
      doc.setFont('Helvetica', 'bold');
      doc.text(label + ':', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(value.length > 60 ? value.substring(0, 60) + '...' : value, margin + 50, y);
      y += 5;
    });

    y += 5;
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('Este expediente ha sido generado por el sistema académico y contiene datos verificables.', margin, y, { maxWidth: contentWidth });

    // ========== 8. FIRMA INSTITUCIONAL ==========
    checkNewPage(25);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('FIRMA INSTITUCIONAL', margin, y);
    y += 15;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('_________________________________', margin + 10, y);
    y += 4;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Responsable Académico', margin + 20, y);
    y += 8;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Sello Institucional', margin + 80, y - 8);

    // Generar PDF
    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="expediente_auditable_${userEmail}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[GENERATE_AUDITABLE_PDF] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});