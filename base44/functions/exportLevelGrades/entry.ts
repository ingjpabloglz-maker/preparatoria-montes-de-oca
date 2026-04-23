import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

// Calcular SHA-256 de un objeto como string
async function sha256(obj) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
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
  const exportedKey = `level_${level}_exported`;

  // Obtener todos los datos necesarios en paralelo
  const [allProgress, allSubjectProgress, allSubjects, allUsers] = await Promise.all([
    sa.entities.UserProgress.list(),
    sa.entities.SubjectProgress.list(),
    sa.entities.Subject.list(),
    sa.entities.User.list(),
  ]);

  const subjectMap = Object.fromEntries(allSubjects.map(s => [s.id, s]));
  const userMap = Object.fromEntries(allUsers.map(u => [u.email, u]));

  // Agrupar SubjectProgress por usuario
  const subjectProgressByUser = {};
  for (const sp of allSubjectProgress) {
    if (!subjectProgressByUser[sp.user_email]) subjectProgressByUser[sp.user_email] = [];
    subjectProgressByUser[sp.user_email].push(sp);
  }

  // Filtrar alumnos elegibles
  const eligibleProgress = allProgress.filter(prog => {
    const levelCompleted = prog.current_level > level ||
      prog.graduation_status === 'completed' ||
      prog.graduation_status === 'certified';
    if (!levelCompleted) return false;
    if (!include_exported && prog[exportedKey] === true) return false;
    return true;
  });

  if (eligibleProgress.length === 0) {
    return Response.json({
      message: 'No hay alumnos pendientes de exportación para este nivel.',
      total_students: 0,
      xlsx_base64: null,
      batch_id: null,
    });
  }

  const now = new Date().toISOString();

  // 1. Crear batch de auditoría primero (para tener el batch_id)
  const fileName = `calificaciones_nivel_${level}_${now.split('T')[0]}.xlsx`;
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

  // 2. Crear snapshots e inmutabilizar datos
  const rows = [];
  const snapshotPromises = [];

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

    const materias = userSubjectProgress.map(sp => ({
      subject_id: sp.subject_id,
      subject_name: subjectMap[sp.subject_id]?.name || sp.subject_id,
      final_grade: sp.final_grade ?? null,
      test_passed: sp.test_passed ?? false,
    }));

    const grades = materias.map(m => m.final_grade).filter(g => g != null && !isNaN(g));
    const promedio = grades.length > 0
      ? parseFloat((grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1))
      : null;

    const completed_at = prog.course_completed_at || prog.level_start_date || null;

    // Calcular hash para integridad
    const hashPayload = {
      user_email: userEmail,
      apellido_paterno, apellido_materno, nombres, curp,
      level, materias, promedio, exported_at: now,
    };

    // Crear snapshot (inmutable)
    snapshotPromises.push(
      sha256(hashPayload).then(hash =>
        sa.entities.LevelExportSnapshot.create({
          batch_id: batch.id,
          user_id: userData.id || '',
          user_email: userEmail,
          apellido_paterno,
          apellido_materno,
          nombres,
          curp,
          email: userEmail,
          level,
          materias,
          promedio,
          completed_at,
          exported_at: now,
          hash_integrity: hash,
        })
      )
    );

    // Generar filas para el Excel (una fila por materia)
    if (materias.length === 0) {
      rows.push({
        'Apellido Paterno': apellido_paterno,
        'Apellido Materno': apellido_materno,
        'Nombres': nombres,
        'CURP': curp,
        'Email': userEmail,
        'Nivel': level,
        'Materia': 'Sin datos',
        'Calificación': '',
        'Promedio': promedio ?? 'N/A',
        'Fecha de Término': completed_at ? completed_at.split('T')[0] : '',
      });
    } else {
      for (const m of materias) {
        rows.push({
          'Apellido Paterno': apellido_paterno,
          'Apellido Materno': apellido_materno,
          'Nombres': nombres,
          'CURP': curp,
          'Email': userEmail,
          'Nivel': level,
          'Materia': m.subject_name,
          'Calificación': m.final_grade != null ? m.final_grade : (m.test_passed ? 'Aprobado' : 'Sin calificación'),
          'Promedio': promedio ?? 'N/A',
          'Fecha de Término': completed_at ? completed_at.split('T')[0] : '',
        });
      }
    }
  }

  // Esperar todos los snapshots
  await Promise.all(snapshotPromises);

  // 3. Marcar alumnos como exportados (solo nuevos)
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

  // 4. Generar Excel con XLSX
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      'Apellido Paterno', 'Apellido Materno', 'Nombres', 'CURP', 'Email',
      'Nivel', 'Materia', 'Calificación', 'Promedio', 'Fecha de Término'
    ]
  });

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 30 },
    { wch: 8 }, { wch: 35 }, { wch: 14 }, { wch: 10 }, { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Nivel ${level}`);
  const xlsxBuffer = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  return Response.json({
    message: `Exportación exitosa: ${eligibleProgress.length} alumnos`,
    total_students: eligibleProgress.length,
    batch_id: batch.id,
    file_name: fileName,
    xlsx_base64: xlsxBuffer,
  });
});