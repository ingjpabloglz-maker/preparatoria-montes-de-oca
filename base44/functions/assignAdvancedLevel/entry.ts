import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Asigna un alumno avanzado directamente a un nivel específico (2-6).
 * Marca todos los niveles anteriores como completados (pagos, materias, progreso).
 * Solo ejecutable por administradores.
 *
 * Parámetros:
 *   - user_email: email del alumno
 *   - target_level: nivel al que debe ingresar directamente (2-6)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores pueden ejecutar esta operación.' }, { status: 403 });

    const body = await req.json();
    const { user_email, target_level } = body;

    if (!user_email || !target_level) {
      return Response.json({ error: 'Faltan parámetros: user_email, target_level' }, { status: 400 });
    }
    if (target_level < 2 || target_level > 6) {
      return Response.json({ error: 'target_level debe ser entre 2 y 6.' }, { status: 400 });
    }

    const sa = base44.asServiceRole;

    // Verificar que el alumno exista y tenga rol 'user'
    const targetUsers = await sa.entities.User.filter({ email: user_email });
    const targetUser = targetUsers[0];
    if (!targetUser || targetUser.role !== 'user') {
      return Response.json({ error: 'Alumno no encontrado o no tiene rol de estudiante.' }, { status: 404 });
    }

    // Obtener todas las materias de los niveles anteriores al target
    const allSubjects = await sa.entities.Subject.list();
    const previousSubjects = allSubjects.filter(s => s.level < target_level);

    // Obtener LevelConfig del nivel destino
    const levelConfigs = await sa.entities.LevelConfig.list();
    const targetLevelConfig = levelConfigs.find(lc => lc.level_number === target_level);
    if (!targetLevelConfig?.time_limit_days) {
      return Response.json({ error: `LevelConfig no encontrado para nivel ${target_level}.` }, { status: 500 });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + targetLevelConfig.time_limit_days);

    // ── 1. Actualizar UserProgress al nivel destino ───────────────────────────
    const progressList = await sa.entities.UserProgress.filter({ user_email });
    const progressData = {
      current_level: target_level,
      level_start_date: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      blocked_due_to_time: false,
      graduation_status: 'in_progress',
      current_installment: 2,
      completed_subjects: previousSubjects.map(s => s.id),
      test_scores: [],
    };
    if (progressList.length > 0) {
      await sa.entities.UserProgress.update(progressList[0].id, progressData);
    } else {
      await sa.entities.UserProgress.create({ user_email, ...progressData });
    }

    // ── 2. Crear/actualizar SubjectProgress para cada materia anterior ────────
    const existingSubjectProgress = await sa.entities.SubjectProgress.filter({ user_email });
    const existingBySubjectId = {};
    for (const sp of existingSubjectProgress) {
      existingBySubjectId[sp.subject_id] = sp;
    }

    for (const subject of previousSubjects) {
      const completedAt = now.toISOString();
      const spData = {
        user_email,
        subject_id: subject.id,
        progress_percent: 100,
        completed: true,
        test_passed: true,
        final_grade: 10,
        final_exam_status: 'approved',
        test_attempts: 1,
        last_activity: completedAt,
      };
      if (existingBySubjectId[subject.id]) {
        await sa.entities.SubjectProgress.update(existingBySubjectId[subject.id].id, spData);
      } else {
        await sa.entities.SubjectProgress.create(spData);
      }
    }

    // ── 3. Crear Payments ficticios (level_advance) para niveles 1..target-1 ──
    const existingPayments = await sa.entities.Payment.filter({ user_email });

    for (let lvl = 1; lvl < target_level; lvl++) {
      const alreadyHas = existingPayments.some(
        p => p.level === lvl && p.folio_type === 'level_advance' && p.status === 'used'
      );
      if (!alreadyHas) {
        const folioCode = `ADV-${user_email.split('@')[0].toUpperCase()}-L${lvl}-${Date.now()}`;
        await sa.entities.Payment.create({
          folio: folioCode,
          user_email,
          level: lvl,
          status: 'used',
          folio_type: 'level_advance',
          used_date: now.toISOString(),
          student_name: targetUser.full_name || user_email,
          amount: 0,
        });
      }
    }

    // También crear Payment para el nivel destino (requerido por checkLevelAccess y advanceToLevel)
    const hasTargetPayment = existingPayments.some(
      p => p.level === target_level && p.folio_type === 'level_advance' && p.status === 'used'
    );
    if (!hasTargetPayment) {
      const folioTarget = `ADV-${user_email.split('@')[0].toUpperCase()}-L${target_level}-${Date.now()}`;
      await sa.entities.Payment.create({
        folio: folioTarget,
        user_email,
        level: target_level,
        status: 'used',
        folio_type: 'level_advance',
        used_date: now.toISOString(),
        student_name: targetUser.full_name || user_email,
        amount: 0,
      });
    }

    // ── 4. Generar colegiaturas del nivel destino directamente (sin invoke) ──
    const allPaymentsNow = await sa.entities.Payment.filter({ user_email, level: target_level, status: 'used' });
    const originPayment = allPaymentsNow[0];

    const targetConfig = levelConfigs.find(lc => lc.level_number === target_level);
    const totalDays = targetConfig?.time_limit_days || 100;
    const intervalDays = Math.floor(totalDays / 4);

    // Eliminar colegiaturas previas del nivel destino
    const existingTargetInstallments = await sa.entities.LevelPaymentPlan.filter({ user_email, level: target_level });
    for (const rec of existingTargetInstallments) {
      await sa.entities.LevelPaymentPlan.delete(rec.id);
    }

    const createdInstallments = [];
    for (let i = 0; i < 4; i++) {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + i * intervalDays);
      const isFirst = i === 0;
      const rec = await sa.entities.LevelPaymentPlan.create({
        user_email,
        level: target_level,
        installment_number: i + 1,
        due_date: dueDate.toISOString(),
        paid_at: isFirst ? now.toISOString() : null,
        status: isFirst ? 'paid' : 'pending',
        folio_used: isFirst ? (originPayment?.folio || null) : null,
        payment_id: isFirst ? (originPayment?.id || null) : null,
      });
      createdInstallments.push(rec);
    }

    // Actualizar current_installment en UserProgress
    await sa.entities.UserProgress.filter({ user_email }).then(async (pList) => {
      if (pList[0]) {
        await sa.entities.UserProgress.update(pList[0].id, { current_installment: 2 });
      }
    });

    // ── 5. Marcar colegiaturas de niveles anteriores como pagadas ────────────
    for (let lvl = 1; lvl < target_level; lvl++) {
      const prevInstallments = await sa.entities.LevelPaymentPlan.filter({ user_email, level: lvl });
      if (prevInstallments.length === 0) {
        // Crear 4 colegiaturas ficticias pagadas para este nivel
        for (let i = 1; i <= 4; i++) {
          await sa.entities.LevelPaymentPlan.create({
            user_email,
            level: lvl,
            installment_number: i,
            due_date: now.toISOString(),
            paid_at: now.toISOString(),
            status: 'paid',
          });
        }
      } else {
        for (const inst of prevInstallments) {
          if (inst.status !== 'paid') {
            await sa.entities.LevelPaymentPlan.update(inst.id, {
              status: 'paid',
              paid_at: now.toISOString(),
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      user_email,
      target_level,
      expires_at: expiresAt.toISOString(),
      previous_levels_completed: target_level - 1,
      subjects_marked_completed: previousSubjects.length,
      message: `Alumno asignado exitosamente al Nivel ${target_level}. Niveles 1-${target_level - 1} marcados como completados.`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});