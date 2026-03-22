import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Swords, Star, Droplets, ArrowLeft, Loader2, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSound } from '@/contexts/SoundContext';
import confetti from 'canvas-confetti';

export default function SurpriseExam() {
  const { playSound } = useSound();
  const [phase, setPhase] = useState('loading'); // loading | ready | question | results | error
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [fillValue, setFillValue] = useState('');
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadExam();
  }, []);

  const loadExam = async () => {
    setPhase('loading');
    const res = await base44.functions.invoke('generateSurpriseExam', {});
    if (res.data?.error === 'already_done_today') {
      setErrorMsg('Ya completaste el desafío de hoy. ¡Vuelve mañana!');
      setPhase('error');
    } else if (res.data?.error === 'no_completed_lessons') {
      setErrorMsg('Necesitas completar al menos una lección antes de poder hacer el desafío.');
      setPhase('error');
    } else if (res.data?.questions) {
      setQuestions(res.data.questions);
      setPhase('ready');
    } else {
      setErrorMsg('No se pudo cargar el examen. Intenta más tarde.');
      setPhase('error');
    }
  };

  const handleSubmit = () => {
    if (submitted) return;
    let answer = selectedAnswer;
    if (questions[currentIdx]?.type === 'fill_blank' || questions[currentIdx]?.type === 'solve') {
      answer = fillValue.trim();
    }
    if (!answer) return;

    // Guardamos la respuesta
    const updatedAnswers = [...answers, { question_id: questions[currentIdx].id, answer }];
    setAnswers(updatedAnswers);
    setSubmitted(true);
  };

  const handleNext = async () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setSubmitted(false);
      setIsCorrect(false);
      setFillValue('');
    } else {
      // Enviar examen
      setPhase('loading');
      const question_ids = answers.map(a => a.question_id);
      const answerValues = answers.map(a => a.answer);
      const res = await base44.functions.invoke('submitSurpriseExam', {
        question_ids,
        answers: answerValues,
      });
      if (res.data) {
        setResults(res.data);
        setPhase('results');
        if (res.data.score >= 80) {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          playSound('achievement_unlocked');
        }
      }
    }
  };

  const q = questions[currentIdx];
  const progressPct = questions.length > 0 ? Math.round((currentIdx / questions.length) * 100) : 0;

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 to-blue-900">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Preparando tu desafío...</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 to-blue-900 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Swords className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-700 font-medium">{errorMsg}</p>
            <Link to="/Rewards">
              <Button className="mt-6 w-full">Volver a Recompensas</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 to-blue-900 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mx-auto mb-6">
              <Swords className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Desafío Diario!</h2>
            <p className="text-gray-500 mb-6">
              {questions.length} preguntas basadas en tu aprendizaje previo.
              ¡Demuestra lo que sabes!
            </p>
            <div className="flex justify-center gap-6 mb-8 text-sm text-gray-600">
              <div className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" /> XP bonus</div>
              <div className="flex items-center gap-1"><Droplets className="w-4 h-4 text-blue-500" /> Tokens de agua</div>
            </div>
            <Button
              onClick={() => setPhase('question')}
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold"
            >
              ¡Comenzar!
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'results' && results) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 to-blue-900 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl font-bold text-white ${results.score >= 80 ? 'bg-green-500' : results.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}>
              {results.score}%
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {results.score >= 80 ? '¡Excelente!' : results.score >= 50 ? '¡Buen intento!' : 'Sigue practicando'}
            </h2>
            <p className="text-gray-500 mb-6">
              {results.correct_count} de {results.total} respuestas correctas
            </p>
            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">+{results.xp_earned}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 justify-center"><Zap className="w-3 h-3" />XP ganados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">+{results.water_earned}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 justify-center"><Droplets className="w-3 h-3" />Tokens de agua</p>
              </div>
            </div>
            <Link to="/Rewards">
              <Button className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold">
                Ver mis recompensas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fase question
  if (phase === 'question' && q) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-900 via-blue-950 to-slate-900 text-white">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-white/10 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <Link to="/Rewards" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1">
              <Progress value={progressPct} className="h-2 bg-white/20" />
            </div>
            <span className="text-xs text-white/60">{currentIdx + 1}/{questions.length}</span>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 sm:p-6 pt-8">
          {/* Pregunta */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-5 border border-white/10">
            <p className="text-white text-base sm:text-lg font-medium leading-relaxed">{q.question}</p>
          </div>

          {/* Opciones */}
          <div className="mb-5 space-y-2.5">
            {q.type === 'multiple_choice' && (q.options || []).map((opt, i) => (
              <button
                key={i}
                disabled={submitted}
                onClick={() => !submitted && setSelectedAnswer(opt)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
                  !submitted
                    ? selectedAnswer === opt ? 'bg-blue-500/30 border-blue-400/60 text-white' : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                {opt}
              </button>
            ))}
            {q.type === 'true_false' && ['Verdadero', 'Falso'].map((opt) => (
              <button
                key={opt}
                disabled={submitted}
                onClick={() => !submitted && setSelectedAnswer(opt)}
                className={`w-full py-4 rounded-2xl border text-sm font-bold transition-all ${
                  !submitted
                    ? selectedAnswer === opt
                      ? opt === 'Verdadero' ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200' : 'bg-rose-500/30 border-rose-400/60 text-rose-200'
                      : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                {opt === 'Verdadero' ? '✅ Verdadero' : '❌ Falso'}
              </button>
            ))}
            {(q.type === 'fill_blank' || q.type === 'solve') && (
              <input
                type="text"
                value={fillValue}
                onChange={(e) => !submitted && setFillValue(e.target.value)}
                disabled={submitted}
                placeholder="Escribe tu respuesta..."
                className="w-full px-4 py-4 rounded-xl border border-white/20 text-white placeholder-white/30 bg-white/10 focus:outline-none"
              />
            )}
          </div>

          {/* Botón */}
          {!submitted ? (
            <Button
              onClick={handleSubmit}
              disabled={!selectedAnswer && !fillValue.trim()}
              className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-bold rounded-xl"
            >
              Comprobar
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="w-full h-12 bg-gradient-to-r from-violet-500 to-blue-600 text-white font-bold rounded-xl"
            >
              {currentIdx < questions.length - 1 ? 'Siguiente →' : 'Ver resultados'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}