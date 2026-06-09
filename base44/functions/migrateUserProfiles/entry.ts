/**
 * migrateUserProfiles
 * Script de migración único: lee todos los usuarios de User (solo owner puede) 
 * y crea/actualiza sus registros en UserProfile.
 * Invocar una sola vez desde el panel del Owner.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Solo el owner (colaborador) puede ejecutar esto correctamente
  // ya que necesita listar la entidad User de sistema
  const allUsers = await base44.asServiceRole.entities.User.list();

  // Traer UserProfiles existentes para no duplicar
  const existingProfiles = await base44.asServiceRole.entities.UserProfile.list();
  const profileMap = {};
  for (const p of existingProfiles) {
    profileMap[p.user_email] = p;
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  for (const u of allUsers) {
    try {
      const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
      const full_name = parts.length > 0 ? parts.join(' ') : (u.full_name || u.email);
      const profile_completed = !!(u.nombres && u.apellido_paterno && u.curp && u.telefono_personal && u.correo_contacto);

      const payload = {
        user_email: u.email,
        user_id: u.id,
        nombres: u.nombres || '',
        apellido_paterno: u.apellido_paterno || '',
        apellido_materno: u.apellido_materno || '',
        full_name,
        curp: u.curp || '',
        curp_validated: u.curp_validated || false,
        curp_validated_at: u.curp_validated_at || null,
        telefono_personal: u.telefono_personal || u.telefono || '',
        telefono_tutor: u.telefono_tutor || '',
        correo_contacto: u.correo_contacto || '',
        domicilio: u.domicilio || '',
        fecha_nacimiento: u.fecha_nacimiento || '',
        role: u.role || 'user',
        status: u.status || 'active',
        profile_completed,
        last_synced_at: new Date().toISOString(),
      };

      const existing = profileMap[u.email];
      if (existing) {
        await base44.asServiceRole.entities.UserProfile.update(existing.id, payload);
        updated++;
      } else {
        await base44.asServiceRole.entities.UserProfile.create(payload);
        created++;
      }
    } catch (e) {
      errors.push({ email: u.email, error: e.message });
    }
  }

  return Response.json({
    status: 'ok',
    total: allUsers.length,
    created,
    updated,
    errors,
  });
});