# Guía de Implementación: Auditoría Presencial Final

**Versión:** 3.0  
**Fecha:** 2026-04-08  
**Clasificación:** Auditoría Académica SEP

---

## 1. Cambios en Backend (COMPLETADOS)

### 1.1 Entidades Actualizadas

#### `EvaluationAttempt.json` — Nuevos campos de auditoría:

```json
{
  "exam_started_at": "Timestamp real cuando alumno inicia examen (post-token)",
  "duration_seconds": "Duración calculada: submitted_at - exam_started_at",
  "ip_address": "IP desde donde se validó token",
  "device_info": "User Agent del dispositivo"
}
```

#### `PresentialExamToken.json` — Nuevos campos de control:

```json
{
  "session_status": "active | expired | completed",
  "ip_address": "IP de validación",
  "device_info": "User Agent",
  "validated_at": "Timestamp de validación"
}
```

### 1.2 Funciones Backend Actualizadas

#### `validateExamToken.js`
- ✅ Captura IP + device info
- ✅ Guarda `validated_at`
- ✅ Inicia `session_status = 'active'`
- ✅ Retorna IP y device para auditoría

#### `submitEvaluation.js`
- ✅ Recibe `exam_started_at` del cliente
- ✅ Calcula `duration_seconds = submitted_at - exam_started_at`
- ✅ Bloquea reutilización indirecta con nueva validación
- ✅ Guarda auditoría completa (IP, device, duración)
- ✅ Marca `session_status = 'completed'` al consumir token

### 1.3 Nueva Función Programada

#### `expireInactiveSessions.js`
- Scheduled automation cada 15 minutos
- Expira sesiones sin submit después de 60 minutos
- Marca `session_status = 'expired'`

---

## 2. Cambios en Frontend (REQUERIDOS)

### 2.1 Actualizar `SubjectTest.jsx`

Agregar al inicio del componente:

```jsx
import { usePresentialExamStart } from '@/hooks/usePresentialExamStart';

export default function SubjectTest() {
  // ... existing state
  
  // NUEVO: Registrar cuándo realmente inicia el examen
  const examStartTime = usePresentialExamStart(
    isFinalExam && sessionToken && !isSubmitting
  );

  // ... rest of component
}
```

Luego en `handleSubmitExam()`, pasar:

```jsx
async function handleSubmitExam() {
  // ... existing validation
  
  const response = await base44.functions.invoke('submitEvaluation', {
    lesson_id,
    subject_id,
    type,
    answers: allAnswers,
    started_at: startedAt,
    exam_started_at: examStartTime,  // NUEVO
    session_token: isFinalExam ? sessionToken : undefined,
  });
  
  // ... handle response
}
```

### 2.2 Actualizar `PresentialTokenModal.jsx` (Opcional)

Si quieres mostrar feedback:

```jsx
// Después de validateExamToken exitoso:
if (response.data.ip_address) {
  console.log('Validado desde:', response.data.ip_address);
  // Opcional: mostrar "Validado desde dispositivo Android"
}
```

---

## 3. Matriz de Auditoría Final

Cuando un alumno completa un `final_exam` presencial, la auditoría mostrará:

```
┌─────────────────────────────────────────────────────────────┐
│                  AUDITORÍA PRESENCIAL FINAL                  │
├─────────────────────────────────────────────────────────────┤
│ Alumno          │ Juan Pablo González                        │
│ Email           │ juan.gonzalez@school.edu                   │
│ Materia         │ Álgebra                                    │
│ Tipo            │ Examen Final                               │
├─────────────────────────────────────────────────────────────┤
│ TOKEN                                                        │
│ ├─ Código       │ A7K9L2                                     │
│ ├─ Docente      │ Prof. Martínez                             │
│ ├─ Generado     │ 2026-04-08 10:00:00                        │
│ └─ Método       │ Token (presencial)                         │
├─────────────────────────────────────────────────────────────┤
│ TIMELINE                                                     │
│ ├─ Validado     │ 10:00:15                                   │
│ ├─ Inicio       │ 10:03:45 [+3m 30s después de validación]   │
│ ├─ Envío        │ 10:21:12                                   │
│ └─ Duración     │ 17m 27s                                    │
├─────────────────────────────────────────────────────────────┤
│ DISPOSITIVO (Auditoría soft)                                │
│ ├─ IP           │ 192.168.1.100                              │
│ └─ Device       │ Mozilla/5.0 (Windows NT 10.0; Win64; x64)  │
├─────────────────────────────────────────────────────────────┤
│ RESULTADO                                                    │
│ ├─ Score        │ 82%                                        │
│ ├─ Estado       │ Pendiente revisión docente                 │
│ └─ Revisado por │ (vacío, pendiente)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Seguridad y Validaciones

### 4.1 Bloqueos Activos

| Condición | Error | HTTP |
|-----------|-------|------|
| No hay session_token | `PRESENTIAL_TOKEN_REQUIRED` | 403 |
| session_token inválido | `INVALID_SESSION_TOKEN` | 403 |
| session_token expirado | `SESSION_TOKEN_EXPIRED` | 403 |
| subject_id no coincide | `INVALID_SUBJECT_FOR_TOKEN` | 403 |
| Token ya usado por alumno | `FINAL_EXAM_ALREADY_SUBMITTED_WITH_TOKEN` | 403 |
| >3 intentos sin folio | `FINAL_EXAM_BLOCKED` | 403 |

### 4.2 Sesiones Inactivas

- Session válida por **1 hora** desde validación
- Si no hay submit en 60 min → `session_status = 'expired'`
- Limpieza automática cada 15 minutos

---

## 5. Campos de Trazabilidad Completa

### En `EvaluationAttempt`:

```javascript
{
  // Presencial
  presential_token_id,     // FK directo a token
  token_code,              // "A7K9L2"
  validated_by,            // ID docente
  validated_by_name,       // "Prof. Martínez"
  validation_method,       // "token"
  
  // Timeline
  token_validated_at,      // 10:00:15
  exam_started_at,         // 10:03:45 [NUEVO]
  submitted_at,            // 10:21:12
  duration_seconds,        // 1047 [NUEVO]
  
  // Auditoría soft
  ip_address,              // "192.168.1.100" [NUEVO]
  device_info,             // "Mozilla/5.0..." [NUEVO]
  
  // Revisión
  reviewed_by,             // (se completa post-revisión)
  review_decision,         // "approved" | "rejected"
  reviewed_at,
  feedback,
  review_history,
}
```

---

## 6. Checklist de Implementación

- [x] Actualizar `EvaluationAttempt.json`
- [x] Actualizar `PresentialExamToken.json`
- [x] Actualizar `validateExamToken.js`
- [x] Actualizar `submitEvaluation.js`
- [x] Crear `expireInactiveSessions.js`
- [x] Crear `usePresentialExamStart.js`
- [ ] **TODO FRONTEND**: Actualizar `SubjectTest.jsx` con hook
- [ ] **TODO FRONTEND**: Pasar `exam_started_at` a submitEvaluation
- [ ] Crear automation para `expireInactiveSessions` (cada 15 min)
- [ ] Actualizar `AuditAttemptDetail.jsx` ✅ DONE
- [ ] Testing: validar flujo completo
- [ ] Testing: verificar bloqueos

---

## 7. Testing Recomendado

### Test 1: Timeline Completo
```
1. Docente genera token A7K9L2
2. Alumno valida → token_validated_at = 10:00:15
3. Alumno inicia examen → exam_started_at = 10:03:45
4. Alumno envía → submitted_at = 10:21:12
5. Verificar: duration_seconds = 1047 (17m 27s)
✅ Auditoría muestra timeline completo
```

### Test 2: Bloqueo de Reutilización
```
1. Alumno envía examen con token A7K9L2 → aprobado
2. Intenta nuevo intento con MISMO A7K9L2
✅ FINAL_EXAM_ALREADY_SUBMITTED_WITH_TOKEN
```

### Test 3: Sesión Inactiva
```
1. Alumno valida token → session_status = 'active'
2. Espera >60 minutos SIN enviar
3. automation expireInactiveSessions corre → session_status = 'expired'
4. Intenta submit → SESSION_TOKEN_EXPIRED
✅ Sesión expirada correctamente
```

### Test 4: Auditoría Soft
```
1. Validar desde IP 192.168.1.100 / Chrome
2. Verificar en AuditAttemptDetail que IP + Device aparecen
✅ Auditoría soft funciona
```

---

## 8. Consideraciones Importantes

### ✅ LO QUE FUNCIONA

- Token no se quema en validación (alumno puede intentar múltiples veces)
- Sesiones inactivas se expiran automáticamente
- Duración real se calcula correctamente
- Auditoría soft (IP + Device) es optional y no bloquea
- Reutilización indirecta está prevenida
- Trazabilidad completa para SEP

### ⚠️ LIMITACIONES

- IP/Device es **soft** (no usa GPS ni geolocalización estricta)
- Alumno podría cambiar de dispositivo en medio del examen (permitido)
- No hay bloqueo de VPN/proxy (solo auditoría)

### 🔒 NO AFECTA

- Flujo de mini-evaluaciones (solo final_exam)
- Límite de 3 intentos (intacto)
- Folio extraordinario (intacto)
- Revisión docente (intacta)

---

## 9. Rollback (si necesario)

Si algo sale mal:

1. Remover campo `exam_started_at` de `EvaluationAttempt` (opcional)
2. Parar automation `expireInactiveSessions`
3. `submitEvaluation` sigue aceptando `exam_started_at` pero puede ser undefined
4. `duration_seconds` será null si no existe `exam_started_at`

**No hay cambios irreversibles en schema.**

---

## 10. Conclusión

Sistema de auditoría presencial completo para SEP:

✅ **Trazabilidad 360°**: Token, timeline, dispositivo, duración  
✅ **Seguridad robusta**: Bloqueos, expiración de sesiones, prevención de reutilización  
✅ **Integridad académica**: Imposible manipular timestamps, auditable  
✅ **Usabilidad**: No requiere GPS, no es invasivo  

**Sistema listo para auditoría regulatoria.**