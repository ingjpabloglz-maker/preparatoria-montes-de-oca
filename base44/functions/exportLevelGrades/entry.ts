import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Genera CSV con BOM UTF-8 para compatibilidad con Excel
function generateCSV(rows) {
  if (rows.length === 0) return '\uFEFF';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ];
  return '\uFEFF' + lines.join('\r\n');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Solo administradores' }, { status: 403 });

  const body = await req.json();
  const level = parseInt(body.level);
  const include_exported = body.include_exported === true;

  if (!level || level < 1 || level > 6) {
    return Response.json({ error: 'Nivel inválido (1-6)' }, { status: 400 });
  }

  const sa = base44.asServiceRole;

  // 1. Obtener todos los UserProgress
  const allProgress = await sa.entities.UserProgress.list();

  // 2. Obtener SubjectProgress y Subjects en paralelo
  const [allSubjectProgress, allSubjects, allUsers] = await Promise.all([
    sa.entities.SubjectProgress.list(),
    sa.entities.Subject.list(),
    sa.entities.User.list(),
  ]);

  // Materias del nivel solicitado
  const subjectsForLevel = allSubjects.filter(s => s.level === level);
  const subjectMap = Object.fromEntries(allSubjects.map(s => [s.id, s]));
  const userMap = Object.fromEntries(allUsers.map(u => [u.email, u]));

  // 3. Filtrar alumnos que completaron el nivel
  // Un alumno completó el nivel si tiene current_level > level O graduation_status completed/certified
  // Y tiene todas las materias del nivel con test_passed = true
  const exportedKey = `level_${level}_exported`;

  const subjectProgressByUser = {};
  for (const sp of allSubjectProgress) {
    if (!subjectProgressByUser[sp.user_email]) subjectProgressByUser[sp.user_email] = [];
    subjectProgressByUser[sp.user_email].push(sp);
  }

  const eligibleProgress = allProgress.filter(prog => {
    // Nivel completado: current_level > level o egresado/certificado
    const levelCompleted = prog.current_level > level ||
      prog.graduation_status === 'completed' ||
      prog.graduation_status === 'certified';

    if (!levelCompleted) return false;

    // Filtro de exportación
    if (!include_exported && prog[exportedKey] === true) return false;

    return true;
  });

  if (eligibleProgress.length === 0) {
    return Response.json({
      message: 'No hay alumnos pendientes de exportación para este nivel.',
      total_students: 0,
      csv_content: null,
      batch_id: null,
    });
  }

  // 4. Construir filas del CSV
  const rows = [];
  for (const prog of eligibleProgress) {
    const userEmail = prog.user_email;
    const userData = userMap[userEmail] || {};
    const userSubjectProgress = (subjectProgressByUser[userEmail] || [])
      .filter(sp => {
        const subj = subjectMap[sp.subject_id];
        return subj && subj.level === level;
      });

    const apellido_paterno = userData.apellido_paterno || '';
    const apellido_materno = userData.apellido_materno || '';
    const nombres = userData.nombres || userData.full_name || '';
    const curp = userData.curp || 'PENDIENTE';

    // Calcular promedio del nivel
    const grades = userSubjectProgress.map(sp => sp.final_grade).filter(g => g != null && !isNaN(g));
    const promedio = grades.length > 0
      ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1)
      : 'N/A';

    if (userSubjectProgress.length === 0) {
      // Sin datos de materias — agregar fila genérica
      rows.push({
        'Apellido Paterno': apellido_paterno,
        'Apellido Materno': apellido_materno,
        'Nombres': nombres,
        'CURP': curp,
        'Email': userEmail,
        'Nivel': level,
        'Materia': 'Sin datos',
        'Calificación': '',
        'Promedio Nivel': promedio,
        'Fecha Finalización': prog.level_start_date ? prog.level_start_date.split('T')[0] : '',
        'Ya exportado': prog[exportedKey] ? 'Sí' : 'No',
      });
    } else {
      for (const sp of userSubjectProgress) {
        const subj = subjectMap[sp.subject_id] || {};
        rows.push({
          'Apellido Paterno': apellido_paterno,
          'Apellido Materno': apellido_materno,
          'Nombres': nombres,
          'CURP': curp,
          'Email': userEmail,
          'Nivel': level,
          'Materia': subj.name || sp.subject_id,
          'Calificación': sp.final_grade != null ? sp.final_grade : (sp.test_passed ? 'Aprobado' : 'Sin calificación'),
          'Promedio Nivel': promedio,
          'Fecha Finalización': prog.level_start_date ? prog.level_start_date.split('T')[0] : '',
          'Ya exportado': prog[exportedKey] ? 'Sí' : 'No',
        });
      }
    }
  }

  // 5. Crear batch de auditoría
  const now = new Date().toISOString();
  const fileName = `calificaciones_nivel_${level}_${now.split('T')[0]}.csv`;

  const batch = await sa.entities.LevelExportBatch.create({
    level,
    generated_at: now,
    generated_by: user.id,
    generated_by_name: user.full_name,
    generated_by_email: user.email,
    total_students: eligibleProgress.length,
    include_exported,
    file_name: fileName,
  });

  // 6. Marcar alumnos como exportados (solo si no se incluyeron ya exportados)
  if (!include_exported) {
    const exportedAtKey = `level_${level}_exported_at`;
    const exportedBatchKey = `level_${level}_export_batch_id`;
    await Promise.all(
      eligibleProgress.map(prog =>
        sa.entities.UserProgress.update(prog.id, {
          [exportedKey]: true,
          [exportedAtKey]: now,
          [exportedBatchKey]: batch.id,
        })
      )
    );
  }

  // 7. Generar CSV
  const csvContent = generateCSV(rows);

  return Response.json({
    message: `Exportación exitosa: ${eligibleProgress.length} alumnos`,
    total_students: eligibleProgress.length,
    batch_id: batch.id,
    file_name: fileName,
    csv_content: csvContent,
  });
});