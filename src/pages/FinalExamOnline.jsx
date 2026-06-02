import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import ExamTimer from '@/components/exam/ExamTimer';
import ExamQuestion from '@/components/exam/ExamQuestion';
import { CheckCircle, XCircle, AlertTriangle, BookOpen, Send, Loader2 } from 'lucide-react';

const AUTOSAVE_INTERVAL_MS = 75000; // 75 segundos
const LS_KEY = (sessionId) => `feo_backup_${sessionId}`;

export default function FinalExamOnline() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const subjectId = searchParams.get('subject_id');

  const [phase, setPhase] = useState('loading'); // loading | ready | exam | submitting | results | error
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingSave, setPendingSave] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const QUESTIONS_PER_PAGE = 5;

  // ── Iniciar / recuperar sesión ──
  useEffect(() => {
    if (!subjectId) { setErrorMsg('No se especificó materia.'); setPhase('error'); return; }
    loadSession();
  }, [subjectId]);

  // Guardar en localStorage como backup de emergencia (beforeunload, offline, suspend)
  const saveToLocalStorage = useCallback((qs, sessId) => {
    if (!sessId) return;
    try {
      localStorage.setItem(LS_KEY(sessId), JSON.stringify({ questions: qs, saved_at: Date.now() }));
    } catch (_) {}
  }, []);

  // Fusionar respuestas del localStorage con las del servidor
  // Regla: latest timestamp wins — nunca sobrescribir datos más recientes del servidor
  const mergeWithLocalStorage = useCallback((serverQuestions, sessId, serverLastActivityAt) => {
    try {
      const raw = localStorage.getItem(LS_KEY(sessId));
      if (!raw) return serverQuestions;
      const backup = JSON.parse(raw);
      // Descartar backup antiguo (más de 2h)
      if (Date.now() - backup.saved_at > 2 * 60 * 60 * 1000) return serverQuestions;
      // Si el servidor tiene datos más recientes que el localStorage, el servidor gana
      const serverTs = serverLastActivityAt ? new Date(serverLastActivityAt).getTime() : 0;
      if (serverTs >= backup.saved_at) return serverQuestions;
      // localStorage es más reciente: fusionar respuestas donde el servidor no tiene nada
      const lsMap = {};
      for (const q of backup.questions) lsMap[q.activity_id] = q;
      return serverQuestions.map(sq => {
        const lsQ = lsMap[sq.activity_id];
        if (lsQ && lsQ.user_answer && !sq.user_answer) return { ...sq, user_answer: lsQ.user_answer, flagged: lsQ.flagged };
        return sq;
      });
    } catch (_) { return serverQuestions; }
  }, []);

  const loadSession = async () => {
    setPhase('loading');
    try {
      const res = await base44.functions.invoke('startFinalExamOnline', { subject_id: subjectId });
      const data = res.data;
      if (data.already_completed) {
        setResults({ already_completed: true, score: data.score, passed: data.passed });
        setPhase('results');
        return;
      }
      if (data.expired) { setErrorMsg(data.error); setPhase('error'); return; }
      setSession({ id: data.session_id, subject_name: data.subject_name, attempt_number: data.attempt_number });
      // Fusionar con backup de localStorage (maneja offline, laptop suspend, mobile background)
      const mergedQuestions = mergeWithLocalStorage(data.questions, data.session_id, data.last_activity_at);
      setQuestions(mergedQuestions);
      setExpiresAt(data.expires_at);
      setPhase(data.recovered ? 'exam' : 'ready');
    } catch (e) {
      setErrorMsg(e.response?.data?.error || 'Error al cargar el examen.');
      setPhase('error');
    }
  };

  // ── Autosave ──
  const doSave = useCallback(async (qOverride) => {
    const sess = sessionRef.current;
    const qs = qOverride || questionsRef.current;
    if (!sess || phase === 'submitting' || phase === 'results') return;
    setPendingSave(true);
    try {
      const updates = qs.map(q => ({ activity_id: q.activity_id, user_answer: q.user_answer, flagged: q.flagged }));
      await base44.functions.invoke('saveFinalExamProgress', { session_id: sess.id, updates });
    } catch (_) { /* autosave silencioso */ } finally {
      setPendingSave(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'exam') return;
    const interval = setInterval(() => doSave(), AUTOSAVE_INTERVAL_MS);
    const sess = sessionRef.current;
    const onBlur = () => doSave();

    // sendBeacon + localStorage para máxima fiabilidad al cerrar pestaña
    const onBeforeUnload = () => {
      const qs = questionsRef.current;
      const s = sessionRef.current;
      if (!s) return;
      // Guardar en localStorage como respaldo instantáneo
      saveToLocalStorage(qs, s.id);
    };

    // visibilitychange: cubre mobile background + laptop suspend
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const qs = questionsRef.current;
        const s = sessionRef.current;
        if (s) saveToLocalStorage(qs, s.id);
        doSave();
      }
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [phase, doSave]);

  const handleAnswer = useCallback((index, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], user_answer: value };
      // Guardar en localStorage en cada respuesta (previene pérdida en offline/suspend)
      const s = sessionRef.current;
      if (s) saveToLocalStorage(updated, s.id);
      return updated;
    });
  }, [saveToLocalStorage]);

  const handleFlag = useCallback((index) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], flagged: !updated[index].flagged };
      return updated;
    });
  }, []);

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !confirmSubmit) { setConfirmSubmit(true); return; }
    setPhase('submitting');
    try {
      const qs = questionsRef.current;
      const final_answers = qs.map(q => ({ activity_id: q.activity_id, user_answer: q.user_answer }));
      const res = await base44.functions.invoke('submitFinalExamOnline', { session_id: session.id, final_answers });
      setResults(res.data);
      setResults(res.data);
      setPhase('results');
      // Limpiar backup de localStorage al completar exitosamente
      const s = sessionRef.current;
      if (s) { try { localStorage.removeItem(LS_KEY(s.id)); } catch (_) {} }
    } catch (e) {
      setErrorMsg(e.response?.data?.error || 'Error al enviar el examen.');
      setPhase('error');
    }
  };

  const answeredCount = questions.filter(q => q.user_answer).length;
  const flaggedCount = questions.filter(q => q.flagged).length;
  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = questions.slice(currentPage * QUESTIONS_PER_PAGE, (currentPage + 1) * QUESTIONS_PER_PAGE);

  // ── PHASES ──
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-gray-600">Preparando tu examen...</p>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border-2 border-red-200 p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-800">Ocurrió un problema</h2>
        <p className="text-gray-600">{errorMsg}</p>
        <Button onClick={() => navigate(-1)} variant="outline">Regresar</Button>
      </div>
    </div>
  );

  if (phase === 'ready') return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Examen Final</h1>
          <p className="text-gray-500 mt-1">{session?.subject_name}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-700">
          <div className="flex justify-between"><span>Preguntas</span><span className="font-bold">{questions.length}</span></div>
          <div className="flex justify-between"><span>Tiempo disponible</span><span className="font-bold">60 minutos</span></div>
          <div className="flex justify-between"><span>Calificación mínima</span><span className="font-bold">70 / 100</span></div>
          <div className="flex justify-between"><span>Autocalificable</span><span className="font-bold text-green-600">Sí</span></div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          ⚠️ Una vez iniciado el examen el temporizador no se detiene. Asegúrate de tener una conexión estable.
        </div>
        <Button className="w-full" onClick={() => setPhase('exam')}>
          Iniciar Examen
        </Button>
      </div>
    </div>
  );

  if (phase === 'results' || (phase === 'submitting' && results)) {
    const r = results || {};
    if (r.already_completed) return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center space-y-4">
          <h2 className="text-xl font-bold">Ya presentaste este examen</h2>
          <p className="text-gray-600">Calificación: <span className="font-bold text-blue-700">{r.score?.toFixed(1)}</span></p>
          <p className={r.passed ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{r.passed ? '✅ Aprobado' : '❌ No aprobado'}</p>
          <Button onClick={() => navigate(-1)}>Regresar</Button>
        </div>
      </div>
    );
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Resumen */}
          <div className={`rounded-2xl p-8 text-center text-white ${r.passed ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
            {r.passed ? <CheckCircle className="w-16 h-16 mx-auto mb-3" /> : <XCircle className="w-16 h-16 mx-auto mb-3" />}
            <h1 className="text-3xl font-bold">{r.passed ? '¡Aprobado!' : 'No aprobado'}</h1>
            <p className="text-5xl font-black mt-2">{r.score?.toFixed(1)}<span className="text-2xl">/100</span></p>
            <p className="text-sm opacity-80 mt-1">{r.correct_count} correctas · {r.incorrect_count} incorrectas · {Math.floor((r.duration_seconds || 0) / 60)} min usados</p>
            {r.is_late && <p className="text-xs bg-white/20 rounded px-2 py-1 mt-2 inline-block">Entregado después del tiempo límite</p>}
          </div>
          {/* Revisión por pregunta */}
          {Array.isArray(r.questions_with_results) && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-800">Revisión de respuestas</h2>
              {r.questions_with_results.map((q, i) => (
                <div key={i} className={`bg-white rounded-xl border-2 p-4 ${q.is_correct ? 'border-green-300' : 'border-red-300'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-gray-500">{q.index + 1}.</span>
                    {q.is_correct ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    <span className="text-sm text-gray-700">{q.question_text}</span>
                  </div>
                  <div className="ml-6 text-sm space-y-1">
                    <p><span className="text-gray-500">Tu respuesta:</span> <span className={q.is_correct ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{q.user_answer || '(sin responder)'}</span></p>
                    {!q.is_correct && <p><span className="text-gray-500">Respuesta correcta:</span> <span className="text-green-700 font-medium">{q.correct_answer}</span></p>}
                    {q.explanation && <p className="text-gray-500 italic text-xs mt-1">{q.explanation}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button onClick={() => navigate(-1)} variant="outline" className="w-full">Regresar al curso</Button>
        </div>
      </div>
    );
  }

  // ── EXAMEN ACTIVO ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header sticky */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-bold text-gray-800 truncate text-sm">{session?.subject_name}</p>
            <p className="text-xs text-gray-500">{answeredCount}/{questions.length} respondidas {flaggedCount > 0 && `· ${flaggedCount} marcadas`} {pendingSave && '· Guardando...'}</p>
          </div>
          <ExamTimer expiresAt={expiresAt} onExpire={() => handleSubmit(true)} />
          <Button
            size="sm"
            onClick={() => handleSubmit(false)}
            disabled={phase === 'submitting'}
            className="shrink-0"
          >
            {phase === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" />Entregar</>}
          </Button>
        </div>
        {confirmSubmit && (
          <div className="bg-yellow-50 border-t border-yellow-200 px-4 py-3 flex items-center justify-between gap-4 max-w-4xl mx-auto">
            <p className="text-sm text-yellow-800 font-medium">
              Tienes {questions.length - answeredCount} preguntas sin responder. ¿Seguro que deseas entregar?
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setConfirmSubmit(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => handleSubmit(true)}>Sí, entregar</Button>
            </div>
          </div>
        )}
      </div>

      {/* Preguntas */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {pageQuestions.map(q => (
          <ExamQuestion
            key={q.activity_id}
            question={q}
            onAnswer={handleAnswer}
            onFlag={handleFlag}
            disabled={phase === 'submitting'}
          />
        ))}

        {/* Paginación */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" disabled={currentPage === 0} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo(0, 0); }}>
            ← Anterior
          </Button>
          <div className="flex gap-1 flex-wrap justify-center">
            {Array.from({ length: totalPages }).map((_, i) => {
              const start = i * QUESTIONS_PER_PAGE;
              const end = start + QUESTIONS_PER_PAGE;
              const pageAnswered = questions.slice(start, end).filter(q => q.user_answer).length;
              const pageFlagged = questions.slice(start, end).some(q => q.flagged);
              return (
                <button key={i} onClick={() => { setCurrentPage(i); window.scrollTo(0, 0); }}
                  className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all
                    ${i === currentPage ? 'border-blue-500 bg-blue-500 text-white' :
                    pageFlagged ? 'border-yellow-400 bg-yellow-50 text-yellow-700' :
                    pageAnswered === QUESTIONS_PER_PAGE ? 'border-green-400 bg-green-50 text-green-700' :
                    'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <Button variant="outline" disabled={currentPage === totalPages - 1} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo(0, 0); }}>
            Siguiente →
          </Button>
        </div>
      </div>
    </div>
  );
}