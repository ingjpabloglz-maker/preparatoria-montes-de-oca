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
  duracion_programa: '2320 horas',
};

async function sha256(data) {
  const buf = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ascii(str) {
  if (str === null || str === undefined || str === '') return '--';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00f1/g, 'n').replace(/\u00d1/g, 'N')
    .replace(/[^\x00-\x7F]/g, '?')
    .substring(0, 200) || '--';
}

function safeName(str) {
  if (!str) return 'Alumno';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00f1/g, 'n').replace(/\u00d1/g, 'N')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Alumno';
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

    const [userData, userProgress, subjectProgressList, evaluationAttempts, subjects, modules, lessons, units] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: userEmail }).then(r => r[0]),
      base44.asServiceRole.entities.UserProgress.filter({ user_email: userEmail }).then(r => r[0]),
      base44.asServiceRole.entities.SubjectProgress.filter({ user_email: userEmail }),
      base44.asServiceRole.entities.EvaluationAttempt.filter({ user_email: userEmail }),
      base44.asServiceRole.entities.Subject.list(),
      base44.asServiceRole.entities.CourseModule.list(),
      base44.asServiceRole.entities.CourseLesson.list(),
      base44.asServiceRole.entities.CourseUnit.list(),
    ]);

    if (!userData) return Response.json({ error: 'User not found' }, { status: 404 });

    const subjectMap  = new Map(subjects.map(s => [s.id, s]));
    const moduleMap   = new Map(modules.map(m => [m.id, m]));
    const lessonMap   = new Map(lessons.map(l => [l.id, l]));
    const unitMap     = new Map(units.map(u => [u.id, u]));

    const sortedAttempts = [...evaluationAttempts].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    // ── Hash de integridad (sin cambios) ──
    const integrityHash = await sha256(JSON.stringify({
      user_email: userEmail,
      full_name: userData.full_name,
      timestamp: new Date().toISOString(),
      subject_count: subjectProgressList.length,
      evaluation_count: evaluationAttempts.length,
    }));
    const folio = integrityHash.substring(0, 12).toUpperCase();

    // ── Nombre completo del alumno ──
    const nombreCompleto = (() => {
      const parts = [userData.apellido_paterno, userData.apellido_materno, userData.nombres]
        .filter(Boolean).join(' ');
      return parts || userData.full_name || '-';
    })();

    // ── Nombre del archivo usando nombre completo ──
    const fileNameStudent = safeName(nombreCompleto);

    // ── Crear PDF ──
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M  = 12;
    const CW = PW - M * 2;
    let y = 10;

    function checkPage(need = 25) {
      if (y + need > PH - 14) {
        doc.addPage();
        y = 15;
        // Header repetido en nueva página
        doc.setFillColor(26, 58, 92);
        doc.rect(0, 0, PW, 5, 'F');
        doc.setFont('Helvetica', 'bold').setFontSize(7).setTextColor(26, 58, 92);
        doc.text(`${ascii(INSTITUCION.nombre)}  |  Folio: ${folio}  |  Alumno: ${ascii(nombreCompleto)}`, M, 12);
        doc.setTextColor(0, 0, 0);
        y = 18;
        drawLine();
      }
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
      doc.setFont('Helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255);
      doc.text(ascii(title), M, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 12;
    }

    function row(label, value, labelW = 55) {
      checkPage(7);
      doc.setFont('Helvetica', 'bold').setFontSize(7.5).setTextColor(60, 60, 60);
      doc.text(ascii(label) + ':', M, y);
      doc.setFont('Helvetica', 'normal').setTextColor(0, 0, 0);
      const valStr = ascii(String(value));
      const lines = doc.splitTextToSize(valStr, CW - labelW - 2);
      doc.text(lines, M + labelW, y);
      y += Math.max(5.5, lines.length * 4.5);
    }

    // ══ ENCABEZADO ══
    doc.setFillColor(26, 58, 92);
    doc.rect(0, 0, PW, 5, 'F');
    y = 10;

    doc.setFont('Helvetica', 'bold').setFontSize(11).setTextColor(26, 58, 92);
    doc.text('EXPEDIENTE ACADEMICO OFICIAL', PW / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(9);
    doc.text(ascii(INSTITUCION.nombre), PW / 2, y, { align: 'center' });
    y += 8;

    // Grid institucional
    doc.setFillColor(234, 241, 251);
    doc.rect(M - 2, y - 2, CW + 4, 28, 'F');

    const half = CW / 2;
    const leftCols = [
      ['CCT',       INSTITUCION.cct],
      ['Estado',    INSTITUCION.estado],
      ['Municipio', INSTITUCION.municipio],
      ['Plan',      INSTITUCION.plan],
    ];
    const rightCols = [
      ['Modalidad',    INSTITUCION.modalidad],
      ['Opcion',       INSTITUCION.opcion],
      ['Acuerdo RVOE', INSTITUCION.rvoe],
      ['Autoridad',    INSTITUCION.autoridad],
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
      doc.text(ascii(v), M + half + 28, gridY + i * 7);
    });
    y = gridY + 26;

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

    // ══ 1. IDENTIFICACION DEL ALUMNO ══
    sectionHeader('1. IDENTIFICACION DEL ALUMNO');

    const graduationLabels = {
      enrolled:    'Inscrito',
      in_progress: 'En curso',
      completed:   'Egresado',
      certified:   'Certificado',
    };

    row('Nombre completo',     nombreCompleto);
    row('CURP',                userData.curp || '-');
    row('Correo electronico',  userData.email || '-');
    row('Fecha de inscripcion',formatDate(userData.created_date));
    row('Estatus academico',   graduationLabels[userProgress?.graduation_status] || 'Inscrito');
    row('Fecha de egreso',     userProgress?.course_completed_at ? formatDate(userProgress.course_completed_at) : '\u2014');

    y += 2; drawLine();

    // ══ 2. RESUMEN ACADEMICO ══
    sectionHeader('2. RESUMEN ACADEMICO');

    const completadas   = subjectProgressList.filter(s => s.completed).length;
    const promedioFinal = subjectProgressList.length > 0
      ? (subjectProgressList.reduce((s, sp) => s + (sp.final_grade || 0), 0) / subjectProgressList.length).toFixed(1)
      : '-';

    row('Progreso general',         `${userProgress?.total_progress_percent || 0}%`);
    row('Materias completadas',     `${completadas} de ${subjectProgressList.length}`);
    row('Promedio general',         promedioFinal !== '-' ? promedioFinal : '\u2014');
    row('Duracion total del programa', INSTITUCION.duracion_programa);
    row('Total de evaluaciones',    `${evaluationAttempts.length}`);

    y += 2; drawLine();

    // ══ 3. DETALLE POR MATERIA ══
    sectionHeader('3. DETALLE POR MATERIA');

    if (subjectProgressList.length === 0) {
      doc.setFont('Helvetica', 'normal').setFontSize(8).text('Sin materias registradas.', M, y);
      y += 8;
    } else {
      const finalExamStatusLabels = {
        not_started:    'No presentado',
        pending_review: 'Pend. revision',
        approved:       'Aprobado',
        rejected:       'No aprobado',
        blocked:        'Bloqueado',
      };

      // Columnas: Materia | Nivel | Avance | Calif. | Examen Final | Intentos
      const tCols = [M, M + 70, M + 90, M + 110, M + 133, M + 160];
      const tH    = ['Materia', 'Nivel', 'Avance', 'Calif.', 'Examen Final', 'Intentos'];

      const drawTableHeader = () => {
        doc.setFillColor(44, 82, 130);
        doc.rect(M - 2, y - 1, CW + 4, 7, 'F');
        doc.setFont('Helvetica', 'bold').setFontSize(7).setTextColor(255, 255, 255);
        tH.forEach((h, i) => doc.text(h, tCols[i], y + 4.5));
        doc.setTextColor(0, 0, 0);
        y += 8;
      };

      drawTableHeader();

      subjectProgressList.forEach((sp, idx) => {
        checkPage(8);
        // Re-dibujar header si se agregó nueva página
        if (y <= 20 && idx > 0) drawTableHeader();

        const subject = subjectMap.get(sp.subject_id);
        if (idx % 2 === 0) { doc.setFillColor(247, 250, 253); doc.rect(M - 2, y - 1, CW + 4, 7, 'F'); }

        const subjectName = ascii(subject?.name || '-');
        const nameLines   = doc.splitTextToSize(subjectName, 66);
        const finalStatusLabel = finalExamStatusLabels[sp.final_exam_status] || '\u2014';

        doc.setFont('Helvetica', 'normal').setFontSize(7);
        doc.text(nameLines[0], tCols[0], y + 4.5);
        doc.text(`Nivel ${subject?.level || '-'}`, tCols[1], y + 4.5);
        doc.text(`${sp.progress_percent || 0}%`, tCols[2], y + 4.5);
        doc.text(sp.final_grade != null ? sp.final_grade.toFixed(1) : '\u2014', tCols[3], y + 4.5);
        doc.text(finalStatusLabel, tCols[4], y + 4.5);
        doc.text(String(sp.test_attempts || 0), tCols[5], y + 4.5);
        y += 7;
      });
    }

    y += 3; drawLine();

    // ══ 4. HISTORIAL DE ACTIVIDADES DEL PROGRAMA ══
    sectionHeader('4. HISTORIAL DE ACTIVIDADES DEL PROGRAMA');

    const nonFinalAttempts = sortedAttempts.filter(a => a.type !== 'final_exam');

    if (nonFinalAttempts.length === 0) {
      doc.setFont('Helvetica', 'normal').setFontSize(8).text('Sin actividades registradas.', M, y);
      y += 8;
    } else {
      // Columnas: Fecha | Tipo | Materia | Leccion/Contexto | Nivel | Calif. | Estado
      const eCols = [M, M + 22, M + 46, M + 90, M + 143, M + 157, M + 172];
      const eH    = ['Fecha', 'Tipo', 'Materia', 'Leccion / Contexto Academico', 'Nivel', 'Calif.', 'Estado'];

      const drawActHeader = () => {
        doc.setFillColor(44, 82, 130);
        doc.rect(M - 2, y - 1, CW + 4, 7, 'F');
        doc.setFont('Helvetica', 'bold').setFontSize(6.5).setTextColor(255, 255, 255);
        eH.forEach((h, i) => doc.text(h, eCols[i], y + 4.5));
        doc.setTextColor(0, 0, 0);
        y += 8;
      };

      drawActHeader();

      nonFinalAttempts.forEach((attempt, idx) => {
        checkPage(10);
        if (y <= 20 && idx > 0) drawActHeader();

        if (idx % 2 === 0) { doc.setFillColor(247, 250, 253); doc.rect(M - 2, y - 1, CW + 4, 9, 'F'); }

        const subject   = subjectMap.get(attempt.subject_id);
        const lesson    = lessonMap.get(attempt.lesson_id);
        const mod       = lesson ? moduleMap.get(lesson.module_id) : null;
        const unit      = mod    ? unitMap.get(mod.unit_id)        : null;

        const typeLabel = attempt.type === 'mini_eval' ? 'Mini-eval' : 'Leccion';
        const stateLabel= attempt.passed ? 'Aprobado' : attempt.requires_manual_review ? 'En revision' : 'No aprobado';

        const lessonLine  = lesson ? ascii(lesson.title).substring(0, 22) : '--';
        const moduleLine  = mod    ? ascii(mod.title).substring(0, 22)    : '';
        const unitLine    = unit   ? ascii(unit.title).substring(0, 22)   : '';
        const levelLabel  = subject ? `Nivel ${subject.level}` : '--';

        doc.setFont('Helvetica', 'normal').setFontSize(6.5);
        doc.text(formatDateShort(attempt.submitted_at), eCols[0], y + 3.5);
        doc.text(typeLabel,                              eCols[1], y + 3.5);
        doc.text(ascii(subject?.name || '--').substring(0, 20), eCols[2], y + 3.5);

        // Contexto académico compacto en 3 líneas dentro de la celda
        doc.text(lessonLine,                             eCols[3], y + 2.5);
        if (moduleLine) doc.setFontSize(5.5).setTextColor(100, 100, 100).text(moduleLine, eCols[3], y + 6);
        if (unitLine)   doc.text(unitLine, eCols[3], y + 9);
        doc.setFontSize(6.5).setTextColor(0, 0, 0);

        doc.text(levelLabel,                             eCols[4], y + 3.5);
        doc.text(attempt.score != null ? `${attempt.score}%` : '--', eCols[5], y + 3.5);
        doc.text(stateLabel,                             eCols[6], y + 3.5);

        y += 10;
      });
    }

    y += 3; drawLine();

    // ══ 5. HISTORIAL DE EXAMENES FINALES ══
    const finalExams = sortedAttempts.filter(a => a.type === 'final_exam');
    sectionHeader('5. HISTORIAL DE EXAMENES FINALES');

    if (finalExams.length === 0) {
      doc.setFont('Helvetica', 'normal').setFontSize(8).text('Sin examenes finales registrados.', M, y);
      y += 8;
    } else {
      // Columnas: Fecha | Materia | Nivel | Calif. | Estado | Intentos | Duracion | Validacion Docente
      const fCols = [M, M + 24, M + 76, M + 93, M + 110, M + 132, M + 144, M + 158];
      const fH    = ['Fecha', 'Materia', 'Nivel', 'Calif.', 'Estado', 'Intentos', 'Duracion', 'Validacion Docente'];

      const drawFinalHeader = () => {
        doc.setFillColor(44, 82, 130);
        doc.rect(M - 2, y - 1, CW + 4, 7, 'F');
        doc.setFont('Helvetica', 'bold').setFontSize(6.5).setTextColor(255, 255, 255);
        fH.forEach((h, i) => doc.text(h, fCols[i], y + 4.5));
        doc.setTextColor(0, 0, 0);
        y += 8;
      };

      drawFinalHeader();

      finalExams.forEach((attempt, idx) => {
        checkPage(12);
        if (y <= 20 && idx > 0) drawFinalHeader();

        if (idx % 2 === 0) { doc.setFillColor(247, 250, 253); doc.rect(M - 2, y - 1, CW + 4, 11, 'F'); }

        const subject = subjectMap.get(attempt.subject_id);
        const stateLabel = attempt.passed === true
          ? 'Aprobado'
          : attempt.requires_manual_review ? 'En revision' : 'No aprobado';

        // Encontrar intento anterior de misma materia para contar intentos reales
        const subjectAttempts = finalExams.filter(a => a.subject_id === attempt.subject_id);
        const attemptIdx = subjectAttempts.indexOf(attempt) + 1;

        // Validacion docente: desde reviewed_by / reviewer_name / reviewed_at del intento
        let validacionLine1 = 'Pendiente de validacion';
        let validacionLine2 = '';
        if (attempt.reviewed_by && !attempt.requires_manual_review) {
          const docName = attempt.reviewer_name || attempt.reviewed_by;
          validacionLine1 = `Doc: ${ascii(docName).substring(0, 18)}`;
          validacionLine2 = attempt.reviewed_at ? `Val: ${formatDateShort(attempt.reviewed_at)}` : '';
        }

        doc.setFont('Helvetica', 'normal').setFontSize(6.5);
        doc.text(formatDateShort(attempt.submitted_at),                    fCols[0], y + 3.5);
        doc.text(ascii(subject?.name || '--').substring(0, 22),            fCols[1], y + 3.5);
        doc.text(subject ? `Nivel ${subject.level}` : '--',               fCols[2], y + 3.5);
        doc.text(attempt.score != null ? `${attempt.score}%` : '--',      fCols[3], y + 3.5);
        doc.text(stateLabel,                                               fCols[4], y + 3.5);
        doc.text(String(attemptIdx),                                       fCols[5], y + 3.5);
        doc.text(secondsToTime(attempt.duration_seconds),                  fCols[6], y + 3.5);

        // Validacion docente en 2 sub-líneas
        doc.text(validacionLine1,                                          fCols[7], y + 2.5);
        if (validacionLine2) {
          doc.setFontSize(5.5).setTextColor(100, 100, 100);
          doc.text(validacionLine2, fCols[7], y + 7);
          doc.setFontSize(6.5).setTextColor(0, 0, 0);
        }

        y += 12;
      });
    }

    y += 3; drawLine();

    // ══ 6. VALIDACION DE INTEGRIDAD (sin cambios) ══
    sectionHeader('6. VALIDACION DE INTEGRIDAD');
    row('Hash SHA-256 (parcial)', integrityHash.substring(0, 40) + '...');
    row('Hash completo',          integrityHash.substring(0, 64));
    row('Generado por',           user.full_name || user.email);
    row('Timestamp',              new Date().toISOString());

    y += 4;
    doc.setFont('Helvetica', 'italic').setFontSize(7).setTextColor(120, 120, 120);
    doc.text('Expediente generado automaticamente. Integridad verificada con SHA-256.', M, y, { maxWidth: CW });
    y += 8;

    // ══ 7. FIRMA INSTITUCIONAL (sin cambios) ══
    sectionHeader('7. FIRMA INSTITUCIONAL');
    y += 10;
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.5);
    doc.line(M + 5, y + 10, M + 70, y + 10);
    doc.line(M + 90, y + 10, M + 155, y + 10);
    doc.setFont('Helvetica', 'normal').setFontSize(7).setTextColor(60, 60, 60);
    doc.text('Responsable Academico', M + 5, y + 14);
    doc.text('Sello Institucional', M + 90, y + 14);

    // Barra inferior + paginacion en cada página
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(26, 58, 92);
      doc.rect(0, PH - 8, PW, 8, 'F');
      doc.setFont('Helvetica', 'normal').setFontSize(6).setTextColor(255, 255, 255);
      doc.text(
        `${ascii(INSTITUCION.nombre)} | CCT: ${INSTITUCION.cct} | RVOE: ${INSTITUCION.rvoe} | Folio: ${folio}`,
        PW / 2, PH - 3, { align: 'center' }
      );
      doc.setFont('Helvetica', 'normal').setFontSize(6.5).setTextColor(200, 200, 200);
      doc.text(`Pagina ${p} de ${totalPages}`, PW - M, PH - 12, { align: 'right' });
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Expediente_Academico_${fileNameStudent}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[GENERATE_AUDITABLE_PDF] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});