/**
 * Sistema de permisos centralizado.
 * Extiende el sistema de roles sin romper la arquitectura existente.
 *
 * Roles disponibles: admin | docente | user
 */

export const ROLE_PERMISSIONS = {
  admin: ['*'],
  docente: [
    'forum.access',
    'forum.read',
    'forum.post',
    'forum.moderate',
    'forum.delete_post',     // Eliminar respuestas (soft delete)
    'forum.delete_thread',   // Eliminar hilos (soft delete)
    'forum.penalize',        // Penalizar usuarios manualmente
    'exam.review',
    'exam.grade',
  ],
  user: [
    'forum.read',
    'profile.view',
  ],
};

/**
 * Verifica si un usuario tiene un permiso específico.
 * @param {object} user - Objeto de usuario con campo `role`
 * @param {string} permission - Permiso a verificar (ej. "forum.access")
 * @returns {boolean}
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const perms = ROLE_PERMISSIONS[user.role] || [];
  // admin tiene acceso total
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/**
 * Permisos de backend para funciones Deno.
 * Misma lógica, sin dependencia de módulos de browser.
 */
export const BACKEND_ROLE_PERMISSIONS = ROLE_PERMISSIONS;

export function backendHasPermission(userRole, permission) {
  if (!userRole) return false;
  const perms = BACKEND_ROLE_PERMISSIONS[userRole] || [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}