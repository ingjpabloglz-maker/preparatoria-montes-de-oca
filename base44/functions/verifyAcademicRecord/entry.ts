import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Hash SHA-256 del snapshot para verificación de integridad
async function calculateSnapshotHash(snapshot) {
  const content = JSON.stringify({
    user_email: snapshot.user_email,
    full_name: snapshot.full_name,
    curp: snapshot.curp,
    fecha_inscripcion: snapshot.fecha_inscripcion,
    course_completed_at: snapshot.course_completed_at,
    promedio_final: snapshot.promedio_final,
    total_subjects: snapshot.total_subjects,
    subjects_completed: snapshot.subjects_completed,
    materias: snapshot.materias,
    version: snapshot.version || '1.0',
  });
  
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Solo admin puede verificar
  if (user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { user_email } = body;

  if (!user_email) {
    return Response.json({ error: 'user_email is required' }, { status: 400 });
  }

  try {
    // Obtener snapshot del alumno
    const snapshots = await base44.asServiceRole.entities.AcademicRecordSnapshot.filter({
      user_email,
    });

    if (snapshots.length === 0) {
      return Response.json({
        status: 'no_snapshot',
        verified: false,
        message: 'No snapshot found for this student',
      });
    }

    const snapshot = snapshots[0];
    const storedHash = snapshot.snapshot_hash;

    // Recalcular hash
    const calculatedHash = await calculateSnapshotHash(snapshot);

    const verified = storedHash === calculatedHash;

    return Response.json({
      status: 'ok',
      user_email,
      verified,
      stored_hash: storedHash,
      calculated_hash: calculatedHash,
      snapshot_date: snapshot.course_completed_at,
      integrity_status: verified ? 'valid' : 'tampered',
    });
  } catch (e) {
    console.error('verifyAcademicRecord error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});