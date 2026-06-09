# React Query Cache Audit — LMS Montes de Oca

> Fecha: 2026-06-09 | Estado: **APLICADO**

---

## 1. Inventario completo de queryKeys

| queryKey | Archivo(s) | Cardinalidad | Tipo |
|---|---|---|---|
| `['levels']` | StudentDashboard | 1 global | estática |
| `['subjects']` | StudentDashboard, StudentDetail, PaymentHistoryTab, AdminDashboardView, ManageStudents | 1 global | estática |
| `['levelSubjects', levelNum]` | Level.jsx | 6 entradas (niveles 1-6) | acotada |
| `['levelConfig', levelNum]` | Level.jsx | 6 entradas | acotada |
| `['userProgress', email]` | StudentDashboard, Level | 1 por alumno activo | por-usuario |
| `['subjectProgress', email]` | StudentDashboard, Level | 1 por alumno activo | por-usuario |
| `['userPayments', email]` | StudentDashboard | 1 por alumno activo | por-usuario |
| `['gamificationProfile', email]` | useGamification hook | 1 por alumno activo | por-usuario |
| `['userAchievements', email]` | Rewards | 1 por alumno activo | por-usuario |
| `['achievements']` | Rewards | 1 global | estática |
| `['subject', subjectId]` | Subject.jsx | N (una por materia visitada) | por-recurso |
| `['evalStatus', email, subjectId]` | Subject.jsx | N (email × subjectId) | ⚠ crítica |
| `['courseLessons', subjectId]` | useSubjectProgress | N por materia | por-recurso |
| `['lessonProgress', email, subjectId]` | useSubjectProgress | N×M (email × subjectId) | ⚠ crítica |
| `['allLessonsForSubjects', sortedIds]` | useSubjectProgress multi | acotada por nivel | estabilizada |
| `['allLessonProgressForSubjects', email, sortedIds]` | useSubjectProgress multi | acotada | estabilizada |
| `['allUsers']` | AdminDashboardView, ManageStudents | 1 global admin | admin-only |
| `['allProgress']` | AdminDashboardView, ManageStudents | 1 global admin | admin-only |
| `['payments']` | AdminDashboardView | 1 global admin | admin-only |
| `['student', email]` | StudentDetail | N (una por alumno visto) | ⚠ per-student |
| `['studentProgress', email]` | StudentDetail, MateriasTab | N per-student | ⚠ per-student |
| `['studentSubjectProgress', email]` | StudentDetail, MateriasTab | N per-student | ⚠ per-student |
| `['studentPayments', email]` | PaymentHistoryTab | N per-student | ⚠ per-student |
| `['studentPaymentPlans', email]` | StudentDetail, PaymentHistoryTab | N per-student | ⚠ per-student |

---

## 2. Problemas detectados y fixes aplicados

### 2.1 Cache cardinality explosiva — StudentDetail

**Problema:** Cada alumno visitado crea 5 entradas de cache (`student`, `studentProgress`,
`studentSubjectProgress`, `studentPayments`, `studentPaymentPlans`) que nunca se liberaban
(gcTime global = 5 min, pero si el admin navega rápido entre 30 alumnos = 150 entradas activas).

**Fix aplicado:** `gcTime: 3 * 60 * 1000` en todas las queries per-student en:
- `pages/StudentDetail.jsx` (página principal + MateriasTab)
- `components/student/PaymentHistoryTab.jsx`

### 2.2 evalStatus: cardinality O(users × subjects)

**Problema:** `['evalStatus', email, subjectId]` sin `gcTime` explícito. Un alumno con 6 materias
genera 6 entradas, más con el gcTime global de 5 min se acumulan durante la sesión.

**Fix aplicado:**
- `gcTime: 2 * 60 * 1000` en `pages/Subject.jsx`
- `staleTime: 0` (ya estaba) — mantener siempre fresco

### 2.3 invalidateQueries amplia en Subject.jsx

**Problema:** `queryClient.invalidateQueries(['subject'])` invalidaba TODAS las queries
que empiezan con `'subject'` — incluye `subjectProgress`, `subjects`, etc.

**Fix aplicado:** Reemplazado por invalidaciones exactas:
```js
queryClient.invalidateQueries({ queryKey: ['evalStatus', user?.email, subjectId] });
queryClient.invalidateQueries({ queryKey: ['subjectProgress', user?.email] });
```

### 2.4 queryKey inestable en useMultiSubjectProgress

**Problema:** `subjectIds.join(',')` — si el array llega en orden diferente entre renders,
crea duplicados de cache para los mismos datos.

**Fix aplicado:** `[...subjectIds].sort().join(',')` en ambas queries del hook.

### 2.5 Level.jsx: staleTime/gcTime faltantes

**Problema:** `levelConfig`, `levelSubjects`, `userProgress`, `subjectProgress` sin gcTime.
`refetchOnWindowFocus: true` causaba refetches al cambiar de tab del navegador.

**Fix aplicado:** staleTime y gcTime coherentes, `refetchOnWindowFocus: false`.

### 2.6 ManageStudents.jsx: gcTime faltante

**Problema:** `allUsers` y `allProgress` (datasets grandes) sin gcTime explícito.
Al navegar fuera y volver antes de 5 min, persisten innecesariamente.

**Fix aplicado:** `gcTime: 5 * 60 * 1000` explícito en ambas queries.

### 2.7 Rewards: gcTime faltante en userAchievements

**Problema:** Sin gcTime explícito. Si el email cambia (improbable pero posible), la entrada
anterior queda en cache por el gcTime global.

**Fix aplicado:** `gcTime: 5 * 60 * 1000` y `gcTime: 30 * 60 * 1000` para achievements estáticos.

---

## 3. Queries que NO usan React Query (correcto)

Los siguientes componentes/páginas usan `useState + useEffect` directo sin RQ — esto es
intencional y correcto ya que son datos paginados bajo demanda (no se benefician de cache):

- `AuditDashboard.jsx` — listado paginado de intentos, filtros dinámicos
- `TeacherDashboard.jsx` — intentos pendientes de revisión, actualización manual

---

## 4. Estrategia de gcTime y staleTime por categoría

| Categoría | staleTime | gcTime | Razón |
|---|---|---|---|
| Estática global (subjects, levels, achievements) | 30 min | 10–30 min | Cambia raramente, safe en cache |
| Progreso del alumno activo | 2 min | 5 min | Necesita estar relativamente fresco |
| Perfil gamificación | 30s | 5 min (global) | Cambia en tiempo real por actividad |
| Estado evaluación (evalStatus) | 0 | 2 min | Fuente de verdad = backend |
| Datos per-student (admin) | 0 | 3 min | Nunca reusar entre visitas distintas |
| Datasets admin globales | 5 min | 5 min | Grandes, liberar rápido al navegar |
| Logros estáticos | Infinity | 30 min | Nunca cambian en sesión |

---

## 5. Queries zombie — estado actual

**AuditDashboard y TeacherDashboard:** No usan React Query, no generan observers.
Datos viven en state local, se liberan al desmontar. ✅

**useAssistant:** No usa React Query. Usa `base44.entities` directo con lógica de cooldown
manual. Cleanup correcto con `clearTimeout`. ✅

**GamificationHUD:** Usa `useGamificationProfile` (hook RQ). Al ser lazy-loaded solo para
role=user, los observers solo existen cuando el estudiante está logueado. ✅

---

## 6. Prefetches

**No se encontraron `prefetchQuery` ni warmups innecesarios en ningún archivo.** ✅

---

## 7. Resumen de entradas máximas estimadas en cache

**Sesión de estudiante típica:**
- 1 levels + 1 subjects + 1 userProgress + 1 subjectProgress + 1 userPayments
- 1 gamificationProfile + 1 userAchievements + 1 achievements
- ~3 evalStatus (materias visitadas, gcTime 2 min)
- ~3 lessonProgress + ~3 courseLessons (materias abiertas)
- **Total: ~16 entradas activas. Controlado.**

**Sesión de admin visitando 10 alumnos:**
- 1 allUsers + 1 allProgress + 1 payments + 1 subjects (globales)
- 5 × 10 alumnos = 50 entradas per-student (gcTime 3 min — se liberan progresivamente)
- **Pico máximo: ~54 entradas, baja a ~4 globales tras 3 min sin actividad.**

**Antes de esta auditoría (estimado):**
- Per-student sin gcTime explícito = podían persistir 5 min global
- Con 30 alumnos visitados = 150 entradas acumuladas por sesión de admin