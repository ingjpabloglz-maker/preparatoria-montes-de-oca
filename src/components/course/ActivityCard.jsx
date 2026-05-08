import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowRight, Lightbulb, Sparkles, Loader2, Flame, Zap, Clock } from "lucide-react";
import { useSound } from '@/contexts/SoundContext';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// Convierte delimitadores LaTeX \(...\) y \[...\] a $...$ y $$...$$
// y envuelve expresiones LaTeX sueltas sin delimitadores
function ensureMathDelimiters(text) {
  if (!text) return '';
  let str = String(text);
  // \[ ... \] → $$ ... $$
  str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
  // \( ... \) → $ ... $
  str = str.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);
  // Si ya tiene delimitadores $, listo
  if (str.includes('$')) return str;
  // Si contiene comandos LaTeX sueltos, envolver todo
  if (/\\(frac|sqrt|sum|int|prod|lim|infty|cdot|times|div|pm|leq|geq|neq|alpha|beta|gamma|delta|pi|theta|lambda|mu|sigma|omega|vec|hat|bar|dot|ddot|overline|underline|text|mathbb|mathrm|left|right|binom|log|sin|cos|tan|ln|exp)\b/.test(str)) {
    return `$${str}$`;
  }
  return str;
}

function MdMath({ children, className = '' }) {
  const content = ensureMathDelimiters(children);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: ({ children }) => <span>{children}</span> }}
      className={className}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── NORMALIZACIÓN ────────────────────────────────────────────────────────────
function normalize(str) {
  return str?.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
}

// Divide una cadena por comas o espacios múltiples y normaliza cada token
function splitTokens(str) {
  return normalize(str).split(/[\s,]+/).filter(Boolean).sort();
}

function checkAnswer(userAnswer, activity) {
  const { correct_answer, accepted_answers = [], type, tolerance = 0 } = activity;

  if (type === 'multiple_select') {
    try {
      const correct = JSON.parse(correct_answer);
      const user = Array.isArray(userAnswer) ? userAnswer : JSON.parse(userAnswer);
      return JSON.stringify([...correct].sort()) === JSON.stringify([...user].sort());
    } catch { return false; }
  }

  if (type === 'order_steps' || type === 'drag_drop') {
    try {
      const correct = JSON.parse(correct_answer);
      const user = Array.isArray(userAnswer) ? userAnswer : JSON.parse(userAnswer);
      return JSON.stringify(correct) === JSON.stringify(user);
    } catch { return false; }
  }

  const ua = normalize(String(userAnswer));
  const ca = normalize(correct_answer);
  if (ua === ca) return true;

  const extractText = (s) => s.replace(/^[a-d]\)\s*/i, '').trim();
  if (normalize(extractText(String(userAnswer))) === normalize(extractText(correct_answer))) return true;

  if (type === 'true_false') {
    const trueVals = ['verdadero', 'true', 'v'];
    const falseVals = ['falso', 'false', 'f'];
    if (trueVals.includes(ua) && trueVals.includes(ca)) return true;
    if (falseVals.includes(ua) && falseVals.includes(ca)) return true;
  }

  if (tolerance > 0) {
    const uNum = parseFloat(ua.replace(',', '.'));
    const cNum = parseFloat(ca.replace(',', '.'));
    if (!isNaN(uNum) && !isNaN(cNum)) return Math.abs(uNum - cNum) <= tolerance;
  }

  // Para fill_blank/solve con múltiples valores: comparar conjuntos sin importar orden
  if (type === 'fill_blank' || type === 'solve') {
    const allValid = [correct_answer, ...accepted_answers];
    for (const valid of allValid) {
      if (JSON.stringify(splitTokens(String(userAnswer))) === JSON.stringify(splitTokens(valid))) return true;
    }
  }

  const allValid = [correct_answer, ...accepted_answers].map(a => normalize(a));
  return allValid.includes(ua);
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function MultipleChoice({ options, selected, submitted, correct, onSelect }) {
  return (
    <div className="space-y-2.5">
      {options.map((option, i) => {
        const isSelected = selected === option;
        const isCorrectOption = normalize(option) === normalize(correct) ||
          normalize(option.replace(/^[a-d]\)\s*/i, '')) === normalize(correct.replace(/^[a-d]\)\s*/i, ''));
        let cls = 'w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ';
        if (!submitted) {
          cls += isSelected ? 'bg-blue-500/30 border-blue-400/60 text-white' : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10 hover:border-white/25';
        } else {
          if (isCorrectOption) cls += 'bg-green-500/25 border-green-400/60 text-green-200';
          else if (isSelected) cls += 'bg-red-500/25 border-red-400/60 text-red-200';
          else cls += 'bg-white/5 border-white/10 text-white/40';
        }
        return (
          <button key={i} className={cls} onClick={() => !submitted && onSelect(option)} disabled={submitted}>
            <span className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected && !submitted ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-white/40'}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="prose prose-sm prose-invert max-w-none [&_.katex]:text-inherit [&_p]:my-0">
                <MdMath>{option}</MdMath>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MultipleSelect({ options, selected = [], submitted, correctRaw, onToggle }) {
  let correctArr = [];
  try { correctArr = JSON.parse(correctRaw); } catch { correctArr = [correctRaw]; }
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-white/40 mb-1">Selecciona todas las correctas</p>
      {options.map((option, i) => {
        const isSelected = selected.includes(option);
        const isCorrectOption = correctArr.some(c => normalize(c) === normalize(option));
        let cls = 'w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-3 ';
        if (!submitted) {
          cls += isSelected ? 'bg-violet-500/30 border-violet-400/60 text-white' : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10';
        } else {
          if (isCorrectOption && isSelected) cls += 'bg-green-500/25 border-green-400/60 text-green-200';
          else if (isCorrectOption && !isSelected) cls += 'bg-green-500/10 border-green-400/30 text-green-300/60';
          else if (isSelected && !isCorrectOption) cls += 'bg-red-500/25 border-red-400/60 text-red-200';
          else cls += 'bg-white/5 border-white/10 text-white/40';
        }
        return (
          <button key={i} className={cls} onClick={() => !submitted && onToggle(option)} disabled={submitted}>
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-white/30'}`}>
              {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
            </span>
            <MdMath>{option}</MdMath>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseChoice({ selected, submitted, correct, onSelect }) {
  const normalizedCorrect = correct?.toLowerCase();
  const options = ['Verdadero', 'Falso'];
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const isSelected = selected === option;
        const isCorrectOption =
          (normalizedCorrect === 'verdadero' || normalizedCorrect === 'true') && option === 'Verdadero' ||
          (normalizedCorrect === 'falso' || normalizedCorrect === 'false') && option === 'Falso';
        let cls = 'py-5 rounded-2xl border text-sm font-bold transition-all ';
        if (!submitted) {
          cls += isSelected
            ? option === 'Verdadero' ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200' : 'bg-rose-500/30 border-rose-400/60 text-rose-200'
            : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10';
        } else {
          if (isCorrectOption) cls += 'bg-green-500/25 border-green-400/60 text-green-200';
          else if (isSelected) cls += 'bg-red-500/25 border-red-400/60 text-red-200';
          else cls += 'bg-white/5 border-white/10 text-white/40';
        }
        return (
          <button key={option} className={cls} onClick={() => !submitted && onSelect(option)} disabled={submitted}>
            {option === 'Verdadero' ? '✅ Verdadero' : '❌ Falso'}
          </button>
        );
      })}
    </div>
  );
}

function FillBlank({ value, onChange, submitted, correct }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => !submitted && onChange(e.target.value)}
      placeholder="Escribe tu respuesta..."
      disabled={submitted}
      className={`w-full px-4 py-4 rounded-xl border text-white placeholder-white/30 bg-white/10 backdrop-blur-sm text-sm focus:outline-none transition-all ${
        submitted
          ? correct ? 'border-green-400/60 bg-green-500/10' : 'border-red-400/60 bg-red-500/10'
          : 'border-white/20 focus:border-white/40 focus:bg-white/15'
      }`}
    />
  );
}

function OrderSteps({ items, order, submitted, onReorder }) {
  const handleMoveUp = (i) => {
    if (i === 0 || submitted) return;
    const newOrder = [...order];
    [newOrder[i - 1], newOrder[i]] = [newOrder[i], newOrder[i - 1]];
    onReorder(newOrder);
  };
  const handleMoveDown = (i) => {
    if (i === order.length - 1 || submitted) return;
    const newOrder = [...order];
    [newOrder[i], newOrder[i + 1]] = [newOrder[i + 1], newOrder[i]];
    onReorder(newOrder);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/40 mb-1">Ordena los pasos usando ↑ ↓</p>
      {order.map((item, i) => (
        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${submitted ? 'border-white/10 bg-white/5' : 'border-white/20 bg-white/8'}`}>
          <span className="w-6 h-6 rounded-full bg-blue-500/30 text-blue-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
          <span className="flex-1 text-white/85"><MdMath>{item}</MdMath></span>
          {!submitted && (
            <div className="flex flex-col gap-0.5">
              <button onClick={() => handleMoveUp(i)} className="text-white/40 hover:text-white text-xs px-1">↑</button>
              <button onClick={() => handleMoveDown(i)} className="text-white/40 hover:text-white text-xs px-1">↓</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DragDrop({ dragItems, dropTargets, mapping, submitted, correctRaw, onMap }) {
  let correctMapping = {};
  try { correctMapping = JSON.parse(correctRaw); } catch {}
  const unmapped = dragItems.filter(item => !Object.values(mapping).includes(item));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 p-3 bg-white/5 rounded-xl border border-white/10 min-h-[48px]">
        <p className="w-full text-xs text-white/40 mb-1">Haz clic para asignar:</p>
        {unmapped.map((item, i) => (
          <button key={i}
            className="px-3 py-1.5 bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs rounded-lg hover:bg-blue-500/30 transition-all"
            onClick={() => {
              const emptyTarget = dropTargets.find(t => !mapping[t]);
              if (emptyTarget) onMap({ ...mapping, [emptyTarget]: item });
            }}
          >{item}</button>
        ))}
        {unmapped.length === 0 && <span className="text-white/30 text-xs">Todos asignados</span>}
      </div>
      <div className="space-y-2">
        {dropTargets.map((target, i) => {
          const assigned = mapping[target];
          const isCorrect = submitted && assigned && normalize(assigned) === normalize(correctMapping[target] || '');
          const isWrong = submitted && assigned && !isCorrect;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-white/50 flex-shrink-0 w-24 text-right">{target}:</span>
              <div className={`flex-1 min-h-[38px] px-3 py-2 rounded-lg border text-sm flex items-center justify-between ${
                isCorrect ? 'bg-green-500/20 border-green-400/50 text-green-200' :
                isWrong ? 'bg-red-500/20 border-red-400/50 text-red-200' :
                assigned ? 'bg-violet-500/20 border-violet-400/40 text-white' :
                'bg-white/5 border-white/15 text-white/30 border-dashed'
              }`}>
                <span>{assigned || 'Sin asignar'}</span>
                {assigned && !submitted && (
                  <button onClick={() => { const m = {...mapping}; delete m[target]; onMap(m); }} className="text-white/40 hover:text-white ml-2 text-xs">×</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepByStep({ steps, stepAnswers, submitted, onAnswer }) {
  const currentStep = stepAnswers.length;
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const isActive = i === currentStep && !submitted;
        const isDoneStep = i < currentStep || submitted;
        const userAns = stepAnswers[i] || '';
        const isCorrectStep = normalize(userAns) === normalize(step.answer);
        return (
          <div key={i} className={`rounded-xl border p-3 transition-all ${
            isActive ? 'border-blue-400/60 bg-blue-500/10' :
            isDoneStep ? (isCorrectStep ? 'border-green-400/40 bg-green-500/8' : 'border-red-400/40 bg-red-500/8') :
            'border-white/10 bg-white/3 opacity-40'
          }`}>
            <p className="text-xs text-white/50 mb-2">Paso {i + 1}: <MdMath>{step.instruction}</MdMath></p>
            {isActive && <StepInput step={step} onSubmitStep={(ans) => onAnswer(i, ans)} />}
            {isDoneStep && (
              <div className="flex items-center gap-2 text-sm">
                {isCorrectStep
                  ? <><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-green-300">{userAns}</span></>
                  : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-red-300">{userAns}</span><span className="text-white/40 ml-2">→ {step.answer}</span></>
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepInput({ step, onSubmitStep }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-2">
      <input type="text" value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && val.trim() && onSubmitStep(val.trim())}
        placeholder={step.hint || 'Tu respuesta...'}
        className="flex-1 px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-400/60"
        autoFocus
      />
      <Button size="sm" onClick={() => val.trim() && onSubmitStep(val.trim())} className="bg-blue-500 text-white text-xs px-3">OK</Button>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
function ActivityDataError({ type, message }) {
  return (
    <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-4 text-red-200 text-sm">
      <strong>Error en actividad ({type}):</strong> {message}
    </div>
  );
}

export default function ActivityCard({
  activity,
  activityNumber,
  totalActivities,
  onAnswer,
  onNext,
  consecutiveCorrect = 0,
  userEmail,
}) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [multiSelected, setMultiSelected] = useState([]);
  const [fillValue, setFillValue] = useState('');
  const [orderItems, setOrderItems] = useState(() => {
    if (activity.type === 'order_steps' || activity.type === 'drag_drop') {
      return [...(activity.options || [])].sort(() => Math.random() - 0.5);
    }
    return [];
  });
  const [dragMapping, setDragMapping] = useState({});
  const [stepAnswers, setStepAnswers] = useState([]);

  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [explanationLevel, setExplanationLevel] = useState('basic');
  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [timeBonus, setTimeBonus] = useState(0);
  const [startTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    console.log('Activity loaded:', activity);
  }, [activity]);

  const { playSound } = useSound();
  const hints = activity.hints || [];
  const hasHint = hints.length > 0;
  const hintPenalty = activity.hint_penalty ?? 2; // puntos que se descuentan por usar pista

  // Timer
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [submitted, startTime]);

  const getCurrentAnswer = () => {
    if (activity.type === 'multiple_select') return JSON.stringify(multiSelected);
    if (activity.type === 'order_steps') return JSON.stringify(orderItems);
    if (activity.type === 'drag_drop') return JSON.stringify(dragMapping);
    if (activity.type === 'step_by_step') return JSON.stringify(stepAnswers);
    if (activity.type === 'fill_blank' || activity.type === 'solve') return activity.options?.length > 0 ? selectedAnswer : fillValue.trim();
    return selectedAnswer;
  };

  const isAnswerProvided = () => {
    if (activity.type === 'multiple_select') return multiSelected.length > 0;
    if (activity.type === 'order_steps') return orderItems.length > 0;
    if (activity.type === 'drag_drop') return Object.keys(dragMapping).length === (activity.drop_targets?.length || 0);
    if (activity.type === 'step_by_step') return stepAnswers.length === (activity.steps?.length || 0);
    if (activity.type === 'fill_blank' || activity.type === 'solve') return activity.options?.length > 0 ? selectedAnswer !== null : fillValue.trim().length > 0;
    return selectedAnswer !== null;
  };

  const calcPoints = (correct, timeSpent) => {
    if (!correct) return 0;
    const base = activity.points || 10;
    let pts = base;
    if (hintUsed) pts = Math.max(0, pts - hintPenalty);
    if (aiUsed) pts = Math.max(0, pts - 2);
    // Bonus de tiempo
    let bonus = 0;
    if (activity.time_limit_seconds) {
      if (timeSpent < activity.time_limit_seconds * 0.5) bonus = 5;
      else if (timeSpent < activity.time_limit_seconds * 0.75) bonus = 2;
    }
    setTimeBonus(bonus);
    return pts + bonus;
  };

  const handleSubmit = () => {
    if (submitted) return;
    const answer = getCurrentAnswer();
    if (!answer && answer !== false) return;

    const correct = checkAnswer(answer, activity);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const points = calcPoints(correct, timeSpent);

    setIsCorrect(correct);
    setSubmitted(true);
    playSound(correct ? 'correct_answer' : 'incorrect_answer');
    onAnswer(activity.id, correct, points, answer, timeSpent, 1);
  };

  const handleStepAnswer = (stepIndex, answer) => {
    const newStepAnswers = [...stepAnswers, answer];
    setStepAnswers(newStepAnswers);
    if (newStepAnswers.length === (activity.steps?.length || 0)) {
      const allCorrect = activity.steps.every((step, i) => normalize(newStepAnswers[i]) === normalize(step.answer));
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const points = calcPoints(allCorrect, timeSpent);
      setIsCorrect(allCorrect);
      setSubmitted(true);
      playSound(allCorrect ? 'correct_answer' : 'incorrect_answer');
      onAnswer(activity.id, allCorrect, points, JSON.stringify(newStepAnswers), timeSpent, 1);
    }
  };

  const handleUseHint = () => {
    setShowHint(true);
    setHintUsed(true);
  };

  const handleAskAI = async () => {
    if (!submitted) return; // solo disponible después de responder
    setAiUsed(true);
    if (aiLoading || aiResponse) { setShowAiExplanation(true); return; }
    setAiLoading(true);
    setShowAiExplanation(true);
    const answer = getCurrentAnswer();
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un tutor amable de preparatoria. Un estudiante respondió una pregunta y necesita ayuda.

Pregunta: "${activity.question}"
Respuesta del estudiante: "${answer}"
Respuesta correcta: "${activity.correct_answer}"

Explica en 2-3 oraciones cortas, de forma clara y empática, por qué su respuesta fue incorrecta y cómo llegar a la correcta. Si hay conceptos matemáticos, usa LaTeX. Sé directo y no uses listas.`,
      });
      setAiResponse(typeof res === 'string' ? res : res?.explanation || res);
    } catch {
      setAiResponse('No pude generar una explicación en este momento. Revisa la explicación de abajo.');
    }
    setAiLoading(false);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setMultiSelected([]);
    setFillValue('');
    setSubmitted(false);
    setIsCorrect(false);
    setShowHint(false);
    setHintUsed(false);
    setAiUsed(false);
    setAiResponse(null);
    setShowAiExplanation(false);
    setTimeBonus(0);
    setStepAnswers([]);
    onNext();
  };

  const getIncorrectFeedback = () => {
    if (!activity.incorrect_feedback) return null;
    const answer = getCurrentAnswer();
    return activity.incorrect_feedback[answer] || activity.incorrect_feedback['default'] || null;
  };

  const getCurrentExplanation = () => {
    const levels = activity.explanation_levels;
    if (!levels) return activity.explanation;
    return levels[explanationLevel] || activity.explanation;
  };

  const typeLabel = {
    multiple_choice: 'Opción múltiple',
    true_false: 'Verdadero o falso',
    fill_blank: 'Completa el espacio',
    solve: 'Resuelve',
    match: 'Relaciona',
    order_steps: 'Ordena los pasos',
    multiple_select: 'Selección múltiple',
    drag_drop: 'Arrastra y asigna',
    step_by_step: 'Paso a paso',
  }[activity.type] || 'Actividad';

  const difficultyColor = { easy: 'text-green-400', medium: 'text-amber-400', hard: 'text-red-400' }[activity.difficulty] || 'text-white/40';

  if (!activity) return <div className="text-white/50 text-sm p-4">No hay datos de actividad.</div>;

  // Validaciones por tipo
  if (activity.type === 'drag_drop' && (!activity.drag_items?.length || !activity.drop_targets?.length)) {
    return <ActivityDataError type="drag_drop" message="Faltan drag_items o drop_targets. Regenera las actividades." />;
  }
  if (activity.type === 'step_by_step' && (!activity.steps?.length)) {
    return <ActivityDataError type="step_by_step" message="Faltan los pasos (steps). Regenera las actividades." />;
  }
  if (!['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'].includes(activity.type)) {
    return <ActivityDataError type={activity.type} message={`Tipo "${activity.type}" no reconocido.`} />;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{typeLabel}</span>
          {activity.difficulty && (
            <span className={`text-xs font-medium ${difficultyColor}`}>• {activity.difficulty}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {consecutiveCorrect >= 2 && (
            <span className="flex items-center gap-1 text-xs text-orange-400 font-semibold">
              <Flame className="w-3.5 h-3.5" /> {consecutiveCorrect}
            </span>
          )}
          {!submitted && activity.time_limit_seconds && (
            <span className={`flex items-center gap-1 text-xs font-mono ${elapsedSeconds > activity.time_limit_seconds * 0.75 ? 'text-red-400' : 'text-white/40'}`}>
              <Clock className="w-3 h-3" /> {elapsedSeconds}s
            </span>
          )}
          <span className="text-xs text-white/40">{activityNumber}/{totalActivities}</span>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-5 border border-white/10">
        <div className="text-white text-base sm:text-lg font-medium leading-relaxed prose prose-sm prose-invert max-w-none [&_.katex]:text-white [&_p]:my-0">
          <MdMath>{activity.question}</MdMath>
        </div>
        {activity.visual_url && (
          <img src={activity.visual_url} alt="Imagen de la actividad" loading="lazy"
            className="w-full rounded-xl mt-3 border border-white/10 object-contain max-h-56" />
        )}
      </div>

      {/* Hint (antes de responder) */}
      {!submitted && showHint && hints[0] && (
        <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl p-3 mb-4 flex items-start gap-2 animate-in fade-in duration-200">
          <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-amber-200 text-sm">{hints[0]}</span>
            {hintPenalty > 0 && (
              <span className="block text-amber-400/60 text-xs mt-0.5">−{hintPenalty} pts si aciertas</span>
            )}
          </div>
        </div>
      )}

      {/* Answer Area */}
      <div className="mb-5">
        {activity.type === 'multiple_choice' && (
          <MultipleChoice options={activity.options || []} selected={selectedAnswer} submitted={submitted} correct={activity.correct_answer} onSelect={setSelectedAnswer} />
        )}
        {activity.type === 'multiple_select' && (
          <MultipleSelect options={activity.options || []} selected={multiSelected} submitted={submitted} correctRaw={activity.correct_answer}
            onToggle={(opt) => setMultiSelected(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])} />
        )}
        {activity.type === 'true_false' && (
          <TrueFalseChoice selected={selectedAnswer} submitted={submitted} correct={activity.correct_answer} onSelect={setSelectedAnswer} />
        )}
        {(activity.type === 'fill_blank' || activity.type === 'solve') && (
          activity.options?.length > 0
            ? <MultipleChoice options={activity.options} selected={selectedAnswer} submitted={submitted} correct={activity.correct_answer} onSelect={setSelectedAnswer} />
            : <FillBlank value={fillValue} onChange={setFillValue} submitted={submitted} correct={isCorrect} />
        )}
        {activity.type === 'order_steps' && (
          <OrderSteps items={activity.options || []} order={orderItems} submitted={submitted} onReorder={setOrderItems} />
        )}
        {activity.type === 'drag_drop' && (
          <DragDrop dragItems={activity.drag_items || activity.options || []} dropTargets={activity.drop_targets || []}
            mapping={dragMapping} submitted={submitted} correctRaw={activity.correct_answer} onMap={setDragMapping} />
        )}
        {activity.type === 'step_by_step' && (
          <StepByStep steps={activity.steps || []} stepAnswers={stepAnswers} submitted={submitted} onAnswer={handleStepAnswer} />
        )}
      </div>

      {/* Feedback obligatorio tras responder */}
      {submitted && (
        <div className={`rounded-2xl p-4 mb-5 border animate-in fade-in duration-200 ${
          isCorrect ? 'bg-green-500/20 border-green-500/40' : 'bg-red-500/20 border-red-500/40'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {isCorrect
              ? <CheckCircle2 className="w-5 h-5 text-green-400" />
              : <XCircle className="w-5 h-5 text-red-400" />
            }
            <span className={`font-bold text-sm ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
              {isCorrect ? '¡Correcto!' : 'Incorrecto'}
            </span>
            {isCorrect && timeBonus > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-yellow-300 font-semibold">
                <Zap className="w-3 h-3" /> +{timeBonus} bonus
              </span>
            )}
            {isCorrect && hintUsed && (
              <span className="ml-auto flex items-center gap-1 text-xs text-amber-400/70">
                −{hintPenalty} (pista usada)
              </span>
            )}
            {!isCorrect && (
              <span className="text-white/60 text-xs ml-auto inline-flex items-center gap-1">
                Resp: <span className="text-white/90 font-medium"><MdMath>{activity.correct_answer}</MdMath></span>
              </span>
            )}
          </div>

          {/* Feedback específico por respuesta incorrecta */}
          {!isCorrect && getIncorrectFeedback() && (
            <p className="text-sm text-red-200/80 mb-2">{getIncorrectFeedback()}</p>
          )}

          {/* Explicación siempre visible */}
          {(activity.explanation || activity.explanation_levels) && (
            <div className="mt-2">
              {activity.explanation_levels && (
                <div className="flex gap-1.5 mb-2">
                  {['basic', 'detailed', 'example'].map(level => (
                    <button key={level} onClick={() => setExplanationLevel(level)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-all ${explanationLevel === level ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-white/15 text-white/50 hover:bg-white/10'}`}>
                      {level === 'basic' ? 'Básico' : level === 'detailed' ? 'Detallado' : 'Ejemplo'}
                    </button>
                  ))}
                </div>
              )}
              <div className="text-white/75 text-xs leading-relaxed prose prose-sm prose-invert max-w-none [&_.katex]:text-white/90 [&_p]:my-0.5">
                <MdMath>{getCurrentExplanation()}</MdMath>
              </div>
            </div>
          )}

          {/* Botón IA — solo después de responder */}
          <div className="mt-3">
            <button onClick={handleAskAI}
              className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition-colors">
              <Sparkles className="w-3.5 h-3.5" />
              {showAiExplanation ? 'Explicación IA' : 'Explícame con IA'}
            </button>
            {showAiExplanation && (
              <div className="mt-2 p-3 bg-violet-500/10 border border-violet-400/25 rounded-xl">
                {aiLoading
                  ? <div className="flex items-center gap-2 text-violet-300 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Generando...</div>
                  : <div className="text-violet-200 text-xs leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:my-0.5 [&_.katex]:text-violet-100"><MdMath>{aiResponse}</MdMath></div>
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streak visual */}
      {submitted && isCorrect && consecutiveCorrect >= 2 && (
        <div className="flex items-center justify-center gap-2 mb-4 animate-in zoom-in duration-300">
          <span className="text-orange-400 text-sm font-bold">🔥 ¡{consecutiveCorrect} respuestas correctas seguidas!</span>
        </div>
      )}

      {/* Botones de acción */}
      {activity.type !== 'step_by_step' && (
        !submitted ? (
          <div className="space-y-2">
            <Button
              onClick={handleSubmit}
              disabled={!isAnswerProvided()}
              className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Comprobar
            </Button>
            {hasHint && !showHint && (
              <button onClick={handleUseHint}
                className="w-full text-xs text-white/40 hover:text-white/60 flex items-center justify-center gap-1 py-2 transition-colors">
                <Lightbulb className="w-3.5 h-3.5" /> Ver pista {hintPenalty > 0 ? `(−${hintPenalty} pts)` : ''}
              </button>
            )}
          </div>
        ) : (
          <Button
            onClick={handleNext}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            Continuar <ArrowRight className="w-4 h-4" />
          </Button>
        )
      )}

      {activity.type === 'step_by_step' && submitted && (
        <Button
          onClick={handleNext}
          className="w-full h-12 mt-4 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          Continuar <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}