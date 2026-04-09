import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import PDFDocument from 'npm:pdfkit@0.15.0';

const crypto = globalThis.crypto;

// ── Datos institucionales oficiales ──────────────────────────────────────────
const INSTITUCION = {
  nombre:       'ESCUELA PREPARATORIA FERNANDO MONTES DE OCA',
  cct:          '28PBH0301U',
  estado:       'Tamaulipas',
  municipio:    'Reynosa',
  plan:         'Bachillerato General',
  nivel:        'Bachillerato General',
  modalidad:    'No escolarizada',
  opcion:       'Intensiva',
  rvoe:         'NMS/02/01/2010',
  autoridad:    'Ejecutivo del Estado de Tamaulipas',
};

// ── Utilidades ────────────────────────────────────────────────────────────────
async function sha256(data) {
  const buf = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safe(str, maxLen = 200) {
  if (!str && str !== 0) return '\u2014';
  return String(str).substring(0, maxLen) || '\u2014';
}

function formatDate(isoStr) {
  if (!isoStr) return '\u2014';
  try {
    const d = new Date(isoStr);
    if (isNaN(d)) return '\u2014';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch { return '\u2014'; }
}

function formatDateShort(isoStr) {
  if (!isoStr) return '\u2014';
  try {
    const d = new Date(isoStr);
    if (isNaN(d)) return '\u2014';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '\u2014'; }
}

function secondsToTime(s) {
  if (!s && s !== 0) return '\u2014';
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function minutesToHours(m) {
  if (!m) return '0h';
  const h = Math.floor(m / 60), rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

// Convierte el PDF stream (PDFKit) a ArrayBuffer
function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      const buf = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { buf.set(c, offset); offset += c.length; }
      resolve(buf.buffer);
    });
    doc.on('error', reject);
  });
}

// ── Helpers de dibujo ─────────────────────────────────────────────────────────
const MARGIN   = 40;
const COL_LABEL = MARGIN;
const COL_VALUE = MARGIN + 145;
const PAGE_W    = 595.28;  // A4 points
const PAGE_H    = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawSeparator(doc, y, color = '#BBBBBB') {
  doc.save().strokeColor(color).lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke().restore();
  return y + 8;
}

function sectionTitle(doc, title, y) {
  // Fondo gris claro
  doc.save()
    .fillColor('#F0F0F0')
    .rect(MARGIN - 4, y - 10, CONTENT_W + 8, 16)
    .fill()
    .restore();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1A1A1A').text(title, MARGIN, y - 7, { width: CONTENT_W });
  return y + 12;
}

function labelValue(doc, label, value, y, labelWidth = 140) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#333333').text(label + ':', COL_LABEL, y, { width: labelWidth, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#111111').text(safe(value, 120), COL_LABEL + labelWidth, y, { width: CONTENT_W - labelWidth });
  return y + 13;
}

function checkPage(doc, y, needed = 40) {
  if (y + needed > PAGE_H - 50) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

// ── Handler principal ─────────────────────────────────────────────────────────
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

    // ── Carga de datos ──
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
    const lessonMap  = new Map(lessons.map(l => [l.id, l]));

    const timeTotalMinutes = subjectProgressList.reduce((s, sp) => s + (sp.time_spent_minutes || 0), 0);
    const sortedAttempts   = [...evaluationAttempts].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    // ── Hash de integridad ──
    const integrityHash = await sha256(JSON.stringify({
      user_email:       userEmail,
      full_name:        userData.full_name,
      timestamp:        new Date().toISOString(),
      subject_count:    subjectProgressList.length,
      evaluation_count: evaluationAttempts.length,
    }));
    const folio = integrityHash.substring(0, 12).toUpperCase();

    // ── Crear documento PDF ──
    const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: 40, left: MARGIN, right: MARGIN }, bufferPages: true });
    const bufferPromise = streamToBuffer(doc);

    let y = MARGIN + 10;

    // ══════════════════════════════════════════════════════════
    // 1. ENCABEZADO INSTITUCIONAL
    // ══════════════════════════════════════════════════════════
    // Barra superior de color
    doc.save().fillColor('#1A3A5C').rect(0, 0, PAGE_W, 6).fill().restore();

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1A3A5C')
      .text('EXPEDIENTE ACADEMICO OFICIAL - AUDITORIA SEP', MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 18;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A3A5C')
      .text(INSTITUCION.nombre, MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 14;

    // Grid de datos institucionales (2 columnas)
    doc.save().fillColor('#EAF1FB').rect(MARGIN - 4, y - 4, CONTENT_W + 8, 70).fill().restore();

    const half = CONTENT_W / 2;
    const institucionalLeft = [
      ['CCT',                INSTITUCION.cct],
      ['Estado',             INSTITUCION.estado],
      ['Municipio',          INSTITUCION.municipio],
      ['Plan de estudios',   INSTITUCION.plan],
    ];
    const institucionalRight = [
      ['Modalidad',          INSTITUCION.modalidad],
      ['Opcion educativa',   INSTITUCION.opcion],
      ['Num. Acuerdo RVOE',  INSTITUCION.rvoe],
      ['Autoridad de emision', INSTITUCION.autoridad],
    ];

    let yL = y, yR = y;
    const colL = MARGIN, colR = MARGIN + half + 5;
    for (let i = 0; i < institucionalLeft.length; i++) {
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#444').text(institucionalLeft[i][0] + ':', colL, yL, { width: 85, lineBreak: false });
      doc.font('Helvetica').fontSize(7).fillColor('#111').text(safe(institucionalLeft[i][1], 60), colL + 88, yL, { width: half - 92 });
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#444').text(institucionalRight[i][0] + ':', colR, yR, { width: 95, lineBreak: false });
      doc.font('Helvetica').fontSize(7).fillColor('#111').text(safe(institucionalRight[i][1], 80), colR + 98, yR, { width: half - 102 });
      yL += 11; yR += 11;
    }
    y = Math.max(yL, yR) + 8;

    // Folio y fecha de generación
    doc.save().fillColor('#1A3A5C').rect(MARGIN - 4, y, CONTENT_W + 8, 14).fill().restore();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF')
      .text(`Folio del Expediente: ${folio}`, MARGIN, y + 4, { width: half, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor('#FFFFFF')
      .text(`Fecha de generacion: ${formatDate(new Date().toISOString())}`, MARGIN + half, y + 4, { align: 'right', width: half });
    y += 22;

    y = drawSeparator(doc, y);

    // ══════════════════════════════════════════════════════════
    // 2. IDENTIFICACION DEL ALUMNO
    // ══════════════════════════════════════════════════════════
    y = checkPage(doc, y, 80);
    y = sectionTitle(doc, '1. IDENTIFICACION DEL ALUMNO', y);

    const graduationLabels = { enrolled: 'Inscrito', in_progress: 'Cursando', completed: 'Egresado', certified: 'Certificado' };
    const alumnoRows = [
      ['Nombre completo',   safe(userData.full_name)],
      ['CURP',              safe(userData.curp)],
      ['Correo electronico',safe(userData.email)],
      ['Fecha de inscripcion', formatDate(userData.created_date)],
      ['Estatus academico', graduationLabels[userProgress?.graduation_status] || safe(userProgress?.graduation_status) || 'Inscrito'],
    ];
    if (userProgress?.course_completed_at) {
      alumnoRows.push(['Fecha de egreso', formatDate(userProgress.course_completed_at)]);
    }
    for (const [label, value] of alumnoRows) {
      y = checkPage(doc, y, 18);
      y = labelValue(doc, label, value, y);
    }

    y += 4;
    y = drawSeparator(doc, y);

    // ══════════════════════════════════════════════════════════
    // 3. RESUMEN ACADEMICO
    // ══════════════════════════════════════════════════════════
    y = checkPage(doc, y, 70);
    y = sectionTitle(doc, '2. RESUMEN ACADEMICO', y);

    const completadas = subjectProgressList.filter(s => s.completed).length;
    const promedioFinal = subjectProgressList.length > 0
      ? (subjectProgressList.reduce((s, sp) => s + (sp.final_grade || 0), 0) / subjectProgressList.length).toFixed(1)
      : '\u2014';

    const resumenRows = [
      ['Progreso general',       `${userProgress?.total_progress_percent || 0}%`],
      ['Materias completadas',   `${completadas} de ${subjectProgressList.length}`],
      ['Promedio general',       promedioFinal !== '\u2014' ? `${promedioFinal}` : '\u2014'],
      ['Tiempo total invertido', minutesToHours(timeTotalMinutes)],
      ['Total evaluaciones',     `${evaluationAttempts.length}`],
    ];
    for (const [label, value] of resumenRows) {
      y = checkPage(doc, y, 18);
      y = labelValue(doc, label, value, y);
    }

    y += 4;
    y = drawSeparator(doc, y);

    // ══════════════════════════════════════════════════════════
    // 4. DETALLE POR MATERIA
    // ══════════════════════════════════════════════════════════
    y = checkPage(doc, y, 40);
    y = sectionTitle(doc, '3. DETALLE POR MATERIA', y);

    if (subjectProgressList.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor('#666').text('Sin materias registradas.', MARGIN, y);
      y += 14;
    } else {
      // Encabezados de tabla
      const tCols = [MARGIN, MARGIN + 110, MARGIN + 155, MARGIN + 205, MARGIN + 255, MARGIN + 305];
      const tHeaders = ['Materia', 'Nivel', 'Avance', 'Calificacion', 'Examen', 'Intentos'];
      doc.save().fillColor('#1A3A5C').rect(MARGIN - 2, y - 2, CONTENT_W + 4, 13).fill().restore();
      tHeaders.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF').text(h, tCols[i], y, { width: 50, lineBreak: false });
      });
      y += 14;

      subjectProgressList.forEach((sp, idx) => {
        y = checkPage(doc, y, 14);
        const subject = subjectMap.get(sp.subject_id);
        if (idx % 2 === 0) {
          doc.save().fillColor('#F7FAFD').rect(MARGIN - 2, y - 2, CONTENT_W + 4, 12).fill().restore();
        }
        const cols = [
          safe(subject?.name, 28),
          safe(subject?.level),
          `${sp.progress_percent || 0}%`,
          sp.final_grade != null ? String(sp.final_grade.toFixed(1)) : '\u2014',
          sp.test_passed ? 'Aprobado' : sp.final_exam_status === 'pending_review' ? 'Revision' : 'Pendiente',
          String(sp.test_attempts || 0),
        ];
        cols.forEach((c, i) => {
          doc.font('Helvetica').fontSize(7).fillColor('#111').text(c, tCols[i], y, { width: 50, lineBreak: false });
        });
        y += 12;
      });
    }

    y += 6;
    y = drawSeparator(doc, y);

    // ══════════════════════════════════════════════════════════
    // 5. HISTORIAL DE EVALUACIONES
    // ══════════════════════════════════════════════════════════
    y = checkPage(doc, y, 40);
    y = sectionTitle(doc, '4. HISTORIAL DE EVALUACIONES', y);

    if (sortedAttempts.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor('#666').text('Sin evaluaciones registradas.', MARGIN, y);
      y += 14;
    } else {
      const eCols  = [MARGIN, MARGIN + 62, MARGIN + 100, MARGIN + 195, MARGIN + 240, MARGIN + 290];
      const eHeaders = ['Fecha', 'Tipo', 'Materia', 'Calificacion', 'Estado', 'Revision'];
      doc.save().fillColor('#1A3A5C').rect(MARGIN - 2, y - 2, CONTENT_W + 4, 13).fill().restore();
      eHeaders.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF').text(h, eCols[i], y, { width: 60, lineBreak: false });
      });
      y += 14;

      sortedAttempts.forEach((attempt, idx) => {
        y = checkPage(doc, y, 12);
        if (idx % 2 === 0) {
          doc.save().fillColor('#F7FAFD').rect(MARGIN - 2, y - 2, CONTENT_W + 4, 12).fill().restore();
        }
        const subject   = subjectMap.get(attempt.subject_id);
        const typeLabel = attempt.type === 'final_exam' ? 'Examen Final' : attempt.type === 'mini_eval' ? 'Mini-Eval' : 'Leccion';
        const stateLabel= attempt.passed ? 'Aprobado' : attempt.requires_manual_review ? 'Revision' : 'No aprobado';
        const reviewLabel = attempt.review_decision === 'approved' ? 'Aprobado' : attempt.review_decision === 'rejected' ? 'Rechazado' : '\u2014';
        const row = [
          formatDateShort(attempt.submitted_at),
          typeLabel,
          safe(subject?.name, 16),
          attempt.score != null ? `${attempt.score}%` : '\u2014',
          stateLabel,
          reviewLabel,
        ];
        row.forEach((c, i) => {
          doc.font('Helvetica').fontSize(7).fillColor('#111').text(c, eCols[i], y, { width: 58, lineBreak: false });
        });
        y += 12;
      });
    }

    y += 6;
    y = drawSeparator(doc, y);

    // ══════════════════════════════════════════════════════════
    // 6. EXAMENES FINALES PRESENCIALES
    // ══════════════════════════════════════════════════════════
    const finalExams = sortedAttempts.filter(a => a.type === 'final_exam');
    y = checkPage(doc, y, 40);
    y = sectionTitle(doc, '5. EXAMENES FINALES - SUPERVISION PRESENCIAL', y);

    if (finalExams.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor('#666').text('Sin examenes finales presenciales registrados.', MARGIN, y);
      y += 14;
    } else {
      for (const attempt of finalExams) {
        y = checkPage(doc, y, 90);
        const subject = subjectMap.get(attempt.subject_id);

        // Cabecera de materia
        doc.save().fillColor('#2C5282').rect(MARGIN - 2, y - 2, CONTENT_W + 4, 13).fill().restore();
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFF')
          .text(`Materia: ${safe(subject?.name)}`, MARGIN, y, { width: CONTENT_W });
        y += 16;

        const examRows = [
          ['Fecha de envio',         formatDate(attempt.submitted_at)],
          ['Calificacion',           attempt.score != null ? `${attempt.score}%` : '\u2014'],
          ['Estado',                 attempt.passed ? 'Aprobado' : attempt.requires_manual_review ? 'Pendiente revision' : 'No aprobado'],
          ['Token (codigo)',          safe(attempt.token_code)],
          ['Docente generador',      safe(attempt.validated_by_name)],
          ['Token validado en',      formatDate(attempt.token_validated_at)],
          ['Inicio real del examen', formatDate(attempt.exam_started_at)],
          ['Duracion del examen',    secondsToTime(attempt.duration_seconds)],
          ['Metodo de validacion',   'Token presencial'],
          ['IP de validacion',       safe(attempt.ip_address)],
          ['Dispositivo',            safe((attempt.device_info || '').substring(0, 60))],
        ];
        for (const [label, value] of examRows) {
          y = checkPage(doc, y, 14);
          y = labelValue(doc, label, value, y);
        }
        y += 4;
        y = drawSeparator(doc, y, '#AACCEE');
      }
    }

    // ══════════════════════════════════════════════════════════
    // 7. VALIDACION DE INTEGRIDAD
    // ══════════════════════════════════════════════════════════
    y = checkPage(doc, y, 60);
    y = sectionTitle(doc, '6. VALIDACION DE INTEGRIDAD DEL EXPEDIENTE', y);

    const intRows = [
      ['Hash SHA-256', integrityHash.substring(0, 40) + '...'],
      ['Hash completo', integrityHash],
      ['Generado por',  safe(user.full_name || user.email)],
      ['Timestamp ISO', new Date().toISOString()],
    ];
    for (const [label, value] of intRows) {
      y = checkPage(doc, y, 14);
      y = labelValue(doc, label, value, y, 110);
    }

    y += 6;
    doc.font('Helvetica').fontSize(7).fillColor('#888')
      .text(
        'Este expediente ha sido generado automaticamente por el sistema academico y contiene datos verificables para auditoria SEP.',
        MARGIN, y, { width: CONTENT_W, align: 'justify' }
      );
    y += 14;

    // ══════════════════════════════════════════════════════════
    // 8. FIRMA INSTITUCIONAL
    // ══════════════════════════════════════════════════════════
    y = checkPage(doc, y, 60);
    y = sectionTitle(doc, '7. FIRMA INSTITUCIONAL', y);
    y += 10;

    const lineY = y + 20;
    doc.save().strokeColor('#333').lineWidth(0.8)
      .moveTo(MARGIN + 10, lineY).lineTo(MARGIN + 120, lineY).stroke()
      .moveTo(MARGIN + 160, lineY).lineTo(MARGIN + 270, lineY).stroke()
      .restore();

    doc.font('Helvetica').fontSize(7.5).fillColor('#333')
      .text('Responsable Academico', MARGIN + 10, lineY + 4, { width: 110, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).fillColor('#333')
      .text('Sello Institucional', MARGIN + 160, lineY + 4, { width: 110, align: 'center' });

    // Barra inferior
    y = PAGE_H - 30;
    doc.save().fillColor('#1A3A5C').rect(0, PAGE_H - 20, PAGE_W, 20).fill().restore();
    doc.font('Helvetica').fontSize(6.5).fillColor('#FFFFFF')
      .text(`${INSTITUCION.nombre} | CCT: ${INSTITUCION.cct} | RVOE: ${INSTITUCION.rvoe} | Folio: ${folio}`,
        MARGIN, PAGE_H - 14, { width: CONTENT_W, align: 'center' });

    // Numeracion de paginas
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(6.5).fillColor('#999')
        .text(`Pagina ${i + 1} de ${totalPages}`, MARGIN, PAGE_H - 35, { width: CONTENT_W, align: 'right' });
    }

    doc.end();
    const pdfBytes = await bufferPromise;

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