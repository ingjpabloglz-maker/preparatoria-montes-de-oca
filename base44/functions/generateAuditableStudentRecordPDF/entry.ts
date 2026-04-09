import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

const crypto = globalThis.crypto;

const INSTITUCION = {
  nombre:    'ESCUELA PREPARATORIA FERNANDO MONTES DE OCA',
  cct:       '28PBH0301U',
  estado:    'Tamaulipas',
  municipio: 'Reynosa',
  plan:      'Bachillerato General',
  modalidad: 'No escolarizada',
  opcion:    'Intensiva',
  rvoe:      'NMS/02/01/2010',
  autoridad: 'Ejecutivo del Estado de Tamaulipas',
};

async function sha256(data) {
  const buf = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Elimina tildes y caracteres especiales para compatibilidad con fuentes PDF estandar
function ascii(str) {
  if (!str && str !== 0) return '-';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00f1/g, 'n').replace(/\u00d1/g, 'N')
    .replace(/[^\x00-\x7F]/g, '?')
    .substring(0, 200) || '-';
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d)) return '-';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return '-'; }
}

function formatDateShort(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d)) return '-';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  } catch { return '-'; }
}

function secondsToTime(s) {
  if (!s && s !== 0) return '-';
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function minutesToHours(m) {
  if (!m) return '0h';
  const h = Math.floor(m / 60), rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const userEmail = body.user_email || user.email;

    if (user.role !== 'admin' && user.role !== 'docente' && user.email !== userEmail) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [userData, userProgress, subjectProgressList, evaluationAttempts, subjects, modules, lessons] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: userEmail }).then(r => r[0]),
      base44.asServiceRole.entities.UserProgress.filter({ user_email: userEmail }).then(r => r[0]),
      base44.asServiceRole.entities.SubjectProgress.filter({ user_email: userEmail }),
      base44.asServiceRole.entities.EvaluationAttempt.filter({ user_email: userEmail }),
      base44.asServiceRole.entities.Subject.list(),
      base44.asServiceRole.entities.CourseModule.list(),
      base44.asServiceRole.entities.CourseLesson.list(),
    ]);

    if (!userData) return Response.json({ error: 'User not found' }, { status: 404 });

    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const timeTotalMinutes = subjectProgressList.reduce((s, sp) => s + (sp.time_spent_minutes || 0), 0);
    const sortedAttempts = [...evaluationAttempts].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    const integrityHash = await sha256(JSON.stringify({
      user_email: userEmail,
      full_name: userData.full_name,
      timestamp: new Date().toISOString(),
      subject_count: subjectProgressList.length,
      evaluation_count: evaluationAttempts.length,
    }));
    const folio = integrityHash.substring(0, 12).toUpperCase();

    // ── Crear PDF ──
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M = 15;
    const CW = PW - M * 2;
    let y = 10;

    function checkPage(need = 25) {
      if (y + need > PH - 10) { doc.addPage(); y = 15; }
    }

    function drawLine(color = [180, 180, 180]) {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.3);
      doc.line(M, y, PW - M, y);
      y += 4;
    }

    function sectionHeader(title) {
      checkPage(16);
      doc.setFillColor(26, 58, 92);
      doc.rect(M - 2, y - 1, CW + 4, 9, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(ascii(title), M, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 12;
    }

    function row(label, value, labelW = 55) {
      checkPage(7);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text(ascii(label) + ':', M, y);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(ascii(String(value)).substring(0, 120), M + labelW, y);
      y += 5.5;
    }

    // ══ 1. ENCABEZADO ══
    doc.setFillColor(26, 58, 92);
    doc.rect(0, 0, PW, 5, 'F');
    y = 10;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 58, 92);
    doc.text('EXPEDIENTE ACADEMICO OFICIAL - AUDITORIA SEP', PW / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(9);
    doc.text(ascii(INSTITUCION.nombre), PW / 2, y, { align: 'center' });
    y += 8;

    // Grid institucional (fondo azul claro)
    doc.setFillColor(234, 241, 251);
    doc.rect(M - 2, y - 2, CW + 4, 32, 'F');

    const half = CW / 2;
    const leftCols = [
      ['CCT', INSTITUCION.cct],
      ['Estado', INSTITUCION.estado],
      ['Municipio', INSTITUCION.municipio],
      ['Plan', INSTITUCION.plan],
    ];
    const rightCols = [
      ['Modalidad', INSTITUCION.modalidad],
      ['Opcion', INSTITUCION.opcion],
      ['Acuerdo RVOE', INSTITUCION.rvoe],
      ['Autoridad', INSTITUCION.autoridad],
    ];
    const gridY = y;
    leftCols.forEach(([l, v], i) => {
      doc.setFont('Helvetica', 'bold').setFontSize(7).setTextColor(80, 80, 80);
      doc.text(ascii(l) + ':', M, gridY + i * 7);
      doc.setFont('Helvetica', 'normal').setTextColor(0, 0, 0);
      doc.text(ascii(v), M + 28, gridY + i * 7);
    });
    rightCols.forEach(([l, v], i) => {
      doc.setFont('Helvetica', 'bold').setFontSize(7).setTextColor(80, 80, 80);
      doc.text(ascii(l) + ':', M + half + 2, gridY + i * 7);
      doc.setFont('Helvetica', 'normal').setTextColor(0, 0, 0);
      doc.text(ascii(v).substring(0, 45), M + half + 30, gridY + i * 7);
    });
    y = gridY + 30;

    // Barra folio
    doc.setFillColor(26, 58, 92);
    doc.rect(M - 2, y, CW + 4, 8, 'F');
    doc.setFont('Helvetica', 'bold').setFontSize(7).setTextColor(255, 255, 255);
    doc.text(`Folio: ${folio}`, M, y + 5.5);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generado: ${formatDate(new Date().toISOString())}`, PW - M, y + 5.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 12;

    drawLine();

    // ══ 2. IDENTIFICACION DEL ALUMNO ══
    sectionHeader('1. IDENTIFICACION DEL ALUMNO');

    const graduationLabels = { enrolled: 'Inscrito', in_progress: 'Cursando', completed: 'Egresado', certified: 'Certificado' };
    row('Nombre completo', userData.full_name || '-');
    row('CURP', userData.curp || '-');
    row('Correo electronico', userData.email || '-');
    row('Fecha de inscripcion', formatDate(userData.created_date));
    row('Estatus academico', graduationLabels[userProgress?.graduation_status] || 'Inscrito');
    if (userProgress?.course_completed_at) row('Fecha de egreso', formatDate(userProgress.course_completed_at));

    y += 2; drawLine();

    // ══ 3. RESUMEN ACADEMICO ══
    sectionHeader('2. RESUMEN ACADEMICO');

    const completadas = subjectProgressList.filter(s => s.completed).length;
    const promedioFinal = subjectProgressList.length > 0
      ? (subjectProgressList.reduce((s, sp) => s + (sp.final_grade || 0), 0) / subjectProgressList.length).toFixed(1)
      : '-';

    row('Progreso general', `${userProgress?.total_progress_percent || 0}%`);
    row('Materias completadas', `${completadas} de ${subjectProgressList.length}`);
    row('Promedio general', promedioFinal);
    row('Tiempo total invertido', minutesToHours(timeTotalMinutes));
    row('Total de evaluaciones', `${evaluationAttempts.length}`);

    y += 2; drawLine();

    // ══ 4. DETALLE POR MATERIA ══
    sectionHeader('3. DETALLE POR MATERIA');

    if (subjectProgressList.length === 0) {
      doc.setFont('Helvetica', 'normal').setFontSize(8).text('Sin materias registradas.', M, y);
      y += 8;
    } else {
      // Cabeceras tabla
      const tCols = [M, M + 75, M + 100, M + 125, M + 152, M + 170];
      const tW    = [72, 22, 22, 24, 15, 22];
      const tH    = ['Materia', 'Nivel', 'Avance', 'Calif.', 'Exam.', 'Intentos'];
      doc.setFillColor(44, 82, 130);
      doc.rect(M - 2, y - 1, CW + 4, 7, 'F');
      doc.setFont('Helvetica', 'bold').setFontSize(7).setTextColor(255, 255, 255);
      tH.forEach((h, i) => doc.text(h, tCols[i], y + 4.5));
      doc.setTextColor(0, 0, 0);
      y += 8;

      subjectProgressList.forEach((sp, idx) => {
        checkPage(8);
        const subject = subjectMap.get(sp.subject_id);
        if (idx % 2 === 0) { doc.setFillColor(247, 250, 253); doc.rect(M - 2, y - 1, CW + 4, 7, 'F'); }
        const cols = [
          ascii(subject?.name || '-').substring(0, 28),
          String(subject?.level || '-'),
          `${sp.progress_percent || 0}%`,
          sp.final_grade != null ? sp.final_grade.toFixed(1) : '-',
          sp.test_passed ? 'Aprob.' : 'Pend.',
          String(sp.test_attempts || 0),
        ];
        doc.setFont('Helvetica', 'normal').setFontSize(7);
        cols.forEach((c, i) => doc.text(c, tCols[i], y + 4.5));
        y += 7;
      });
    }

    y += 3; drawLine();

    // ══ 5. HISTORIAL DE EVALUACIONES ══
    sectionHeader('4. HISTORIAL DE EVALUACIONES');

    if (sortedAttempts.length === 0) {
      doc.setFont('Helvetica', 'normal').setFontSize(8).text('Sin evaluaciones registradas.', M, y);
      y += 8;
    } else {
      const eCols = [M, M + 22, M + 45, M + 105, M + 130, M + 160];
      const eH    = ['Fecha', 'Tipo', 'Materia', 'Calif.', 'Estado', 'Revision'];
      doc.setFillColor(44, 82, 130);
      doc.rect(M - 2, y - 1, CW + 4, 7, 'F');
      doc.setFont('Helvetica', 'bold').setFontSize(7).setTextColor(255, 255, 255);
      eH.forEach((h, i) => doc.text(h, eCols[i], y + 4.5));
      doc.setTextColor(0, 0, 0);
      y += 8;

      sortedAttempts.forEach((attempt, idx) => {
        checkPage(7);
        if (idx % 2 === 0) { doc.setFillColor(247, 250, 253); doc.rect(M - 2, y - 1, CW + 4, 7, 'F'); }
        const subject    = subjectMap.get(attempt.subject_id);
        const typeLabel  = attempt.type === 'final_exam' ? 'Final' : attempt.type === 'mini_eval' ? 'Mini' : 'Leccion';
        const stateLabel = attempt.passed ? 'Aprobado' : attempt.requires_manual_review ? 'Revision' : 'No aprobado';
        const revLabel   = attempt.review_decision === 'approved' ? 'Aprob.' : attempt.review_decision === 'rejected' ? 'Rechaz.' : '-';
        const eRow = [
          formatDateShort(attempt.submitted_at),
          typeLabel,
          ascii(subject?.name || '-').substring(0, 18),
          attempt.score != null ? `${attempt.score}%` : '-',
          stateLabel,
          revLabel,
        ];
        doc.setFont('Helvetica', 'normal').setFontSize(7);
        eRow.forEach((c, i) => doc.text(c, eCols[i], y + 4.5));
        y += 7;
      });
    }

    y += 3; drawLine();

    // ══ 6. EXAMENES FINALES PRESENCIALES ══
    const finalExams = sortedAttempts.filter(a => a.type === 'final_exam');
    sectionHeader('5. EXAMENES FINALES - SUPERVISION PRESENCIAL');

    if (finalExams.length === 0) {
      doc.setFont('Helvetica', 'normal').setFontSize(8).text('Sin examenes finales presenciales registrados.', M, y);
      y += 8;
    } else {
      for (const attempt of finalExams) {
        checkPage(60);
        const subject = subjectMap.get(attempt.subject_id);

        doc.setFillColor(44, 82, 130);
        doc.rect(M - 2, y - 1, CW + 4, 7, 'F');
        doc.setFont('Helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255);
        doc.text(`Materia: ${ascii(subject?.name || '-')}`, M, y + 4.5);
        doc.setTextColor(0, 0, 0);
        y += 10;

        row('Fecha de envio', formatDate(attempt.submitted_at));
        row('Calificacion', attempt.score != null ? `${attempt.score}%` : '-');
        row('Estado', attempt.passed ? 'Aprobado' : attempt.requires_manual_review ? 'Pendiente revision' : 'No aprobado');
        row('Token (codigo)', attempt.token_code || '-');
        row('Docente generador', attempt.validated_by_name || '-');
        row('Token validado en', formatDate(attempt.token_validated_at));
        row('Inicio real del examen', formatDate(attempt.exam_started_at));
        row('Duracion del examen', secondsToTime(attempt.duration_seconds));
        row('IP de validacion', attempt.ip_address || '-');
        row('Dispositivo', (attempt.device_info || '-').substring(0, 60));

        y += 2; drawLine([170, 204, 238]);
      }
    }

    // ══ 7. INTEGRIDAD ══
    sectionHeader('6. VALIDACION DE INTEGRIDAD');
    row('Hash SHA-256 (parcial)', integrityHash.substring(0, 40) + '...');
    row('Hash completo', integrityHash.substring(0, 64));
    row('Generado por', user.full_name || user.email);
    row('Timestamp', new Date().toISOString());

    y += 4;
    doc.setFont('Helvetica', 'italic').setFontSize(7).setTextColor(120, 120, 120);
    doc.text('Expediente generado automaticamente. Contiene datos verificables para auditoria SEP.', M, y, { maxWidth: CW });
    y += 8;

    // ══ 8. FIRMA ══
    sectionHeader('7. FIRMA INSTITUCIONAL');
    y += 10;
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.5);
    doc.line(M + 5, y + 10, M + 70, y + 10);
    doc.line(M + 90, y + 10, M + 155, y + 10);
    doc.setFont('Helvetica', 'normal').setFontSize(7).setTextColor(60, 60, 60);
    doc.text('Responsable Academico', M + 5, y + 14);
    doc.text('Sello Institucional', M + 90, y + 14);

    // Barra inferior en cada pagina
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(26, 58, 92);
      doc.rect(0, PH - 8, PW, 8, 'F');
      doc.setFont('Helvetica', 'normal').setFontSize(6).setTextColor(255, 255, 255);
      doc.text(`${ascii(INSTITUCION.nombre)} | CCT: ${INSTITUCION.cct} | RVOE: ${INSTITUCION.rvoe} | Folio: ${folio}`, PW / 2, PH - 3, { align: 'center' });
      doc.setTextColor(150, 150, 150);
      doc.setFont('Helvetica', 'normal').setFontSize(6.5);
      doc.text(`Pagina ${p} de ${totalPages}`, PW - M, PH - 12, { align: 'right' });
    }

    const pdfBytes = doc.output('arraybuffer');
    const safeName = userEmail.replace(/[^a-zA-Z0-9._-]/g, '_');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="expediente_auditable_${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[GENERATE_AUDITABLE_PDF] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});