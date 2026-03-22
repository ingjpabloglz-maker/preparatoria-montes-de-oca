import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import MathText from '../math/MathText';
import { useSound } from '@/contexts/SoundContext';

export default function ActivityCard({ activity, activityNumber, totalActivities, onAnswer, onNext }) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [fillValue, setFillValue] = useState('');
  const { playSound } = useSound();

  const handleSubmit = () => {
    if (submitted) return;
    let answer = selectedAnswer;
    if (activity.type === 'fill_blank' || activity.type === 'solve') {
      answer = fillValue.trim();
    }
    if (!answer) return;

    const correct = checkAnswer(answer, activity.correct_answer, activity.type);
    setIsCorrect(correct);
    setSubmitted(true);
    onAnswer(activity.id, correct, activity.points || 10);
    playSound(correct ? 'correct_answer' : 'incorrect_answer');
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setSubmitted(false);
    setIsCorrect(false);
    setFillValue('');
    onNext();
  };

  const typeLabel = {
    multiple_choice: 'Opción múltiple',
    true_false: 'Verdadero o falso',
    fill_blank: 'Completa el espacio',
    solve: 'Resuelve',
    match: 'Relaciona',
    order_steps: 'Ordena los pasos',
  }[activity.type] || 'Actividad';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Type Label */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{typeLabel}</span>
        <span className="text-xs text-white/40">{activityNumber} de {totalActivities}</span>
      </div>

      {/* Question */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-5 border border-white/10">
        <p className="text-white text-base sm:text-lg font-medium leading-relaxed">
          <MathText text={activity.question} />
        </p>
      </div>

      {/* Answer Area */}
      <div className="mb-5">
        {(activity.type === 'multiple_choice') && (
          <MultipleChoice
            options={activity.options || []}
            selected={selectedAnswer}
            submitted={submitted}
            correct={activity.correct_answer}
            onSelect={setSelectedAnswer}
          />
        )}
        {(activity.type === 'true_false') && (
          <TrueFalseChoice
            selected={selectedAnswer}
            submitted={submitted}
            correct={activity.correct_answer}
            onSelect={setSelectedAnswer}
          />
        )}
        {(activity.type === 'fill_blank' || activity.type === 'solve') && (
          <FillBlank
            value={fillValue}
            onChange={setFillValue}
            submitted={submitted}
            correct={isCorrect}
          />
        )}
      </div>

      {/* Feedback */}
      {submitted && (
        <div className={`rounded-2xl p-4 mb-5 border animate-in fade-in duration-200 ${
          isCorrect
            ? 'bg-green-500/20 border-green-500/40'
            : 'bg-red-500/20 border-red-500/40'
        }`}>
          <div className="flex items-center gap-2 mb-1.5">
            {isCorrect
              ? <CheckCircle2 className="w-5 h-5 text-green-400" />
              : <XCircle className="w-5 h-5 text-red-400" />
            }
            <span className={`font-bold text-sm ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
              {isCorrect ? '¡Correcto!' : 'Incorrecto'}
            </span>
            {!isCorrect && (
              <span className="text-white/60 text-xs ml-1">
                Respuesta: <span className="text-white/90 font-medium"><MathText text={activity.correct_answer} /></span>
              </span>
            )}
          </div>
          {activity.explanation && (
            <p className="text-white/70 text-xs leading-relaxed"><MathText text={activity.explanation} /></p>
          )}
        </div>
      )}

      {/* Action Button */}
      {!submitted ? (
        <Button
          onClick={handleSubmit}
          disabled={!selectedAnswer && !fillValue.trim()}
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

function MultipleChoice({ options, selected, submitted, correct, onSelect }) {
  return (
    <div className="space-y-2.5">
      {options.map((option, i) => {
        const isSelected = selected === option;
        const isCorrectOption = option === correct || option.replace(/^[a-d]\)\s*/i, '') === correct.replace(/^[a-d]\)\s*/i, '');
        let btnClass = 'w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ';

        if (!submitted) {
          btnClass += isSelected
            ? 'bg-blue-500/30 border-blue-400/60 text-white'
            : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10 hover:border-white/25';
        } else {
          if (isCorrectOption) {
            btnClass += 'bg-green-500/25 border-green-400/60 text-green-200';
          } else if (isSelected && !isCorrectOption) {
            btnClass += 'bg-red-500/25 border-red-400/60 text-red-200';
          } else {
            btnClass += 'bg-white/5 border-white/10 text-white/40';
          }
        }

        return (
          <button key={i} className={btnClass} onClick={() => !submitted && onSelect(option)} disabled={submitted}>
            <span className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isSelected && !submitted ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-white/40'
              }`}>
                {String.fromCharCode(65 + i)}
              </span>
              <MathText text={option} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseChoice({ selected, submitted, correct, onSelect }) {
  const options = ['Verdadero', 'Falso'];
  const normalizedCorrect = correct?.toLowerCase();

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const isSelected = selected === option;
        const optionValue = option.toLowerCase();
        const isCorrectOption =
          normalizedCorrect === optionValue ||
          normalizedCorrect === 'verdadero' && option === 'Verdadero' ||
          normalizedCorrect === 'falso' && option === 'Falso' ||
          (normalizedCorrect === 'true' && option === 'Verdadero') ||
          (normalizedCorrect === 'false' && option === 'Falso');

        let btnClass = 'py-5 rounded-2xl border text-sm font-bold transition-all ';
        if (!submitted) {
          btnClass += isSelected
            ? option === 'Verdadero'
              ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200'
              : 'bg-rose-500/30 border-rose-400/60 text-rose-200'
            : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10';
        } else {
          if (isCorrectOption) btnClass += 'bg-green-500/25 border-green-400/60 text-green-200';
          else if (isSelected) btnClass += 'bg-red-500/25 border-red-400/60 text-red-200';
          else btnClass += 'bg-white/5 border-white/10 text-white/40';
        }

        return (
          <button key={option} className={btnClass} onClick={() => !submitted && onSelect(option)} disabled={submitted}>
            {option === 'Verdadero' ? '✅ Verdadero' : '❌ Falso'}
          </button>
        );
      })}
    </div>
  );
}

function FillBlank({ value, onChange, submitted, correct }) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => !submitted && onChange(e.target.value)}
        placeholder="Escribe tu respuesta..."
        disabled={submitted}
        className={`w-full px-4 py-4 rounded-xl border text-white placeholder-white/30 bg-white/10 backdrop-blur-sm text-sm focus:outline-none transition-all ${
          submitted
            ? correct
              ? 'border-green-400/60 bg-green-500/10'
              : 'border-red-400/60 bg-red-500/10'
            : 'border-white/20 focus:border-white/40 focus:bg-white/15'
        }`}
      />
    </div>
  );
}

function checkAnswer(userAnswer, correctAnswer, type) {
  const normalize = (str) => str?.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

  const ua = normalize(userAnswer);
  const ca = normalize(correctAnswer);

  if (ua === ca) return true;

  // Para opción múltiple: la opción puede incluir "a) texto" o solo "texto"
  const extractText = (s) => s.replace(/^[a-d]\)\s*/i, '').trim();
  if (normalize(extractText(userAnswer)) === normalize(extractText(correctAnswer))) return true;

  // Para V/F: múltiples formas
  if (type === 'true_false') {
    const trueValues = ['verdadero', 'true', 'v', 'si', 'sí'];
    const falseValues = ['falso', 'false', 'f', 'no'];
    const userIsTrue = trueValues.includes(ua);
    const userIsFalse = falseValues.includes(ua);
    const correctIsTrue = trueValues.includes(ca);
    const correctIsFalse = falseValues.includes(ca);
    if (userIsTrue && correctIsTrue) return true;
    if (userIsFalse && correctIsFalse) return true;
  }

  return false;
}