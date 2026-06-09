/**
 * studentGuard.js — Central role validation helper for LMS/academic functions.
 * 
 * USAGE:
 *   import { requireStudentRole, isServiceAccount, blockNonStudentLog } from './lib/studentGuard.js';
 *
 *   const blocked = requireStudentRole(user, 'myFunctionName');
 *   if (blocked) return blocked; // Returns a Response.json 403 immediately
 */

const SERVICE_ACCOUNT_PATTERNS = [
  /^service\+/i,
  /@no-reply\.base44\.com$/i,
  /^bot\+/i,
  /^automation\+/i,
  /^system\+/i,
];

/**
 * Returns true if the email looks like a service/bot account.
 */
export function isServiceAccount(email = '') {
  return SERVICE_ACCOUNT_PATTERNS.some(p => p.test(email));
}

/**
 * Validates that the user is a real student (role === 'user') and not a service account.
 * Returns a Response (403) if blocked, or null if the user is allowed to proceed.
 * Also logs a structured NON_STUDENT_OPERATION_BLOCKED event.
 *
 * @param {object|null} user  - The authenticated user object from base44.auth.me()
 * @param {string} fnName     - The calling function name (for audit logs)
 * @returns {Response|null}
 */
export function requireStudentRole(user, fnName = 'unknown') {
  const email = user?.email || 'anonymous';
  const role = user?.role || 'none';
  const timestamp = new Date().toISOString();

  if (!user || user.role !== 'user' || isServiceAccount(email)) {
    console.log(JSON.stringify({
      event: 'NON_STUDENT_OPERATION_BLOCKED',
      function: fnName,
      email,
      role,
      is_service_account: isServiceAccount(email),
      timestamp,
    }));

    return Response.json({
      status: 'ignored',
      message: 'Operación exclusiva para alumnos.',
      blocked_role: role,
    }, { status: 403 });
  }

  return null; // allowed
}