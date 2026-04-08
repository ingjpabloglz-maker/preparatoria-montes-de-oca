import { useEffect, useRef } from 'react';

/**
 * Hook para registrar cuándo el alumno realmente inicia el examen final presencial
 * 
 * Uso en SubjectTest.jsx:
 * const examStartTime = usePresentialExamStart(type === 'final_exam' && sessionToken);
 * 
 * Luego pasar `exam_started_at: examStartTime` a submitEvaluation
 */
export function usePresentialExamStart(shouldTrack = false) {
  const examStartTimeRef = useRef(null);

  useEffect(() => {
    if (shouldTrack && !examStartTimeRef.current) {
      // Registrar el momento exacto en que el examen se inicia
      examStartTimeRef.current = new Date().toISOString();
      console.log('[PRESENTIAL_EXAM] Started at:', examStartTimeRef.current);
    }
  }, [shouldTrack]);

  return examStartTimeRef.current;
}