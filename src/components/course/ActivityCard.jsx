import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowRight, Flame } from "lucide-react";
import { useSound } from '@/contexts/SoundContext';
import { cn } from '@/lib/utils';

// ─── Normalización ────────────────────────────────────────────────────────────
function normalize(str) {
  return str?.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
}

function checkAnswer(userAnswer, activity) {
  const { correct_answer, type } = activity;

  if (type === 'true_false') {
    const ua = normalize(String(userAnswer));
    const ca = normalize(String(correct_answer));
    const trueVals = ['verdadero', 'true', 'v'];
    const falseVals = ['falso', 'false', 'f'];
    if (trueVals.includes(ua) && trueVals.includes(ca)) return true;
    if (falseVals.includes(ua) && falseVals.includes(ca)) return true;
    return ua === ca;
  }

  const ua = normalize(String(userAnswer));
  const ca = normalize(String(correct_answer));
  if (ua === ca) return true;

  // Ignorar prefijos tipo "A) " al comparar
  const stripPrefix = (s) => s.replace(/^[a-d]\)\s*/i, '').trim();
  return normalize(stripPrefix(String(userAnswer))) === normalize(stripPrefix(String(correct_answer)));
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function MultipleChoice({ options, selected, submitted, correct, onSelect }) {
  return (
    <div className="space-y-2.5">
      {options.map((option, i) => {
        const isSelected = selected === option;
        const isCorrectOption = normalize(option) === normalize(correct) ||
          normalize(option.replace(/^[a-d]\)\s*/i, '')) === normalize(correct.replace(/^[a-d]\)\s*/i, ''));
        let cls = 'w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ';
        if (!submitted) {
          cls += isSelected
            ? 'bg-blue-500/30 border-blue-400/60 text-white'
            : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10 hover:border-white/25';
        } else {
          if (isCorrectOption) cls += 'bg-green-500/25 border-green-400/60 text-green-200';
          else if (isSelected) cls += 'bg-red-500/25 border-red-400/60 text-red-200';
          else cls += 'bg-white/5 border-white/10 text-white/40';
        }
        return (
          <button key={i} className={cls} onClick={() => !submitted && onSelect(option)} disabled={submitted}>
            <span className="flex items-center gap-3">
              <span className={cn(
                'w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0',
                isSelected && !submitted ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-white/40'
              )}>
                {String.fromCharCode(65 + i)}
              </span>
              <span>{option}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseChoice({ selected, submitted, correct, onSelect }) {
  const normalizedCorrect = normalize(correct);
  const options = ['Verdadero', 'Falso'];
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const isSelected = selected === option;
        const isCorrectOption =
          (['verdadero', 'true'].includes(normalizedCorrect) && option === 'Verdadero') ||
          (['falso', 'false'].includes(normalizedCorrect) && option === 'Falso');
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

function FillBlank({ value, onChange, submitted, isCorrect }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => !submitted && onChange(e.target.value)}
      placeholder="Escribe tu respuesta..."
      disabled={submitted}
      className={cn(
        'w-full px-4 py-4 rounded-xl border text-white placeholder-white/30 bg-white/10 backdrop-blur-sm text-sm focus:outline-none transition-all',
        submitted
          ? isCorrect ? 'border-green-400/60 bg-green-500/10' : 'border-red-400/60 bg-red-500/10'
          : 'border-white/20 focus:border-white/40 focus:bg-white/15'
      )}
    />
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ActivityCard({
  activity,
  activityNumber,
  totalActivities,
  onAnswer,
  onNext,
  consecutiveCorrect = 0,
}) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [fillValue, setFillValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { playSound } = useSound();

  const typeLabel = {
    multiple_choice: 'Opción múltiple',
    true_false: 'Verdadero o falso',
    fill_blank: 'Completa el espacio',
  }[activity.type] || 'Actividad';

  const getCurrentAnswer = () => {
    if (activity.type === 'fill_blank') return fillValue.trim();
    return selectedAnswer;
  };

  const isAnswerProvided = () => {
    if (activity.type === 'fill_blank') return fillValue.trim().length > 0;
    return selectedAnswer !== null;
  };

  const handleSubmit = () => {
    if (submitted) return;
    const answer = getCurrentAnswer();
    if (!answer) return;

    const correct = checkAnswer(answer, activity);
    setIsCorrect(correct);
    setSubmitted(true);
    playSound(correct ? 'correct_answer' : 'incorrect_answer');
    onAnswer(activity.id, correct, correct ? 10 : 0, answer, 0, 1);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setFillValue('');
    setSubmitted(false);
    setIsCorrect(false);
    onNext();
  };

  if (!activity) return null;

  if (!['multiple_choice', 'true_false', 'fill_blank'].includes(activity.type)) {
    return (
      <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-4 text-red-200 text-sm">
        Tipo de actividad no reconocido: {activity.type}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{typeLabel}</span>
          {activity.difficulty && (
            <span className={cn(
              'text-xs font-medium',
              activity.difficulty === 'easy' ? 'text-green-400' :
              activity.difficulty === 'hard' ? 'text-red-400' : 'text-amber-400'
            )}>• {activity.difficulty}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {consecutiveCorrect >= 2 && (
            <span className="flex items-center gap-1 text-xs text-orange-400 font-semibold">
              <Flame className="w-3.5 h-3.5" /> {consecutiveCorrect}
            </span>
          )}
          <span className="text-xs text-white/40">{activityNumber}/{totalActivities}</span>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-5 border border-white/10">
        <p className="text-white text-base sm:text-lg font-medium leading-relaxed">{activity.question}</p>
      </div>

      {/* Answer Area */}
      <div className="mb-5">
        {activity.type === 'multiple_choice' && (
          <MultipleChoice
            options={activity.options || []}
            selected={selectedAnswer}
            submitted={submitted}
            correct={activity.correct_answer}
            onSelect={setSelectedAnswer}
          />
        )}
        {activity.type === 'true_false' && (
          <TrueFalseChoice
            selected={selectedAnswer}
            submitted={submitted}
            correct={activity.correct_answer}
            onSelect={setSelectedAnswer}
          />
        )}
        {activity.type === 'fill_blank' && (
          <FillBlank
            value={fillValue}
            onChange={setFillValue}
            submitted={submitted}
            isCorrect={isCorrect}
          />
        )}
      </div>

      {/* Feedback */}
      {submitted && (
        <div className={cn(
          'rounded-2xl p-4 mb-5 border animate-in fade-in duration-200',
          isCorrect ? 'bg-green-500/20 border-green-500/40' : 'bg-red-500/20 border-red-500/40'
        )}>
          <div className="flex items-center gap-2 mb-2">
            {isCorrect
              ? <CheckCircle2 className="w-5 h-5 text-green-400" />
              : <XCircle className="w-5 h-5 text-red-400" />
            }
            <span className={cn('font-bold text-sm', isCorrect ? 'text-green-300' : 'text-red-300')}>
              {isCorrect ? '¡Correcto! Buen trabajo.' : 'La respuesta correcta es: ' + activity.correct_answer + '. Revisa el tema e inténtalo nuevamente.'}
            </span>
          </div>
          {activity.explanation && (
            <p className="text-white/70 text-xs leading-relaxed mt-1">{activity.explanation}</p>
          )}
        </div>
      )}

      {/* Streak */}
      {submitted && isCorrect && consecutiveCorrect >= 2 && (
        <div className="flex items-center justify-center gap-2 mb-4 animate-in zoom-in duration-300">
          <span className="text-orange-400 text-sm font-bold">🔥 ¡{consecutiveCorrect} respuestas correctas seguidas!</span>
        </div>
      )}

      {/* Botones */}
      {!submitted ? (
        <Button
          onClick={handleSubmit}
          disabled={!isAnswerProvided()}
          className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Comprobar
        </Button>
      ) : (
        <Button
          onClick={handleNext}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          Continuar <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}