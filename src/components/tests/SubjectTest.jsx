import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowRight, Trophy, XCircle, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import RichContentRenderer from '../common/RichContentRenderer';
import PresentialTokenModal from './PresentialTokenModal';

function shuffleAndPick(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function normalizeAnswer(str) {
  return str?.toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function SubjectTest({ subject, onComplete, onExit }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [textAnswer, setTextAnswer] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [pendingTeacherReview, setPendingTeacherReview] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(true); // Pide token antes de empezar
  const [sessionToken, setSessionToken] = useState(null);

  useEffect(() => {
    const loadQuestions = async () => {
      if (!subject?.id) return;
      setLoading(true);
      // Obtener mini-evaluaciones de la materia
      const miniEvals = await base44.entities.CourseLesson.filter({
        subject_id: subject.id,
        is_mini_eval: true
      });

      if (miniEvals.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Obtener actividades de todas las mini-evaluaciones en paralelo
      const activityArrays = await Promise.all(
        miniEvals.map(lesson =>
          base44.entities.CourseActivity.filter({ lesson_id: lesson.id })
        )
      );

      // Filtrar solo opción múltiple y verdadero/falso (con opciones)
      const allActivities = activityArrays
        .flat()
        .filter(a => a.options && a.options.length > 0);

      // Seleccionar entre 15 y 20 preguntas aleatoriamente
      const targetCount = Math.min(allActivities.length, 18);
      const selected = shuffleAndPick(allActivities, targetCount);

      // Formatear para el componente
      const formatted = selected.map(a => {
        const correctIdx = a.options.indexOf(a.correct_answer);
        return {
          id: a.id,
          question: a.question,
          options: a.options,
          correct: correctIdx >= 0 ? correctIdx : 0,
          correct_answer: a.correct_answer,
          explanation: a.explanation,
          type: a.type,
        };
      });

      setQuestions(formatted);
      setLoading(false);
    };

    loadQuestions();
  }, [subject?.id]);

  const handleAnswer = (value) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: parseInt(value) }));
  };

  const nextQuestion = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setTextAnswer('');
    } else {
      let correct = 0;
      const answersPayload = questions.map((q, idx) => ({
        question_id: q.id,
        user_answer: q.options[answers[idx]] ?? '',
      }));
      questions.forEach((q, idx) => {
        if (answers[idx] === q.correct) correct++;
      });
      const finalScore = Math.round((correct / questions.length) * 100);
      const passed = finalScore >= 70;
      setScore(finalScore);
      // Pasar answers y session_token al padre para que haga el submit real al backend
      const result = await onComplete?.(finalScore, passed, sessionToken, answersPayload);
      // Si el backend indica que está pendiente de revisión docente
      if (result?.pending_teacher_review) {
        setPendingTeacherReview(true);
      }
      setShowResults(true);
    }
  };

  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;
  const passed = score >= 70;

  // Modal de token presencial (siempre primero para examen final)
  if (showTokenModal && !sessionToken) {
    return (
      <PresentialTokenModal
        subjectId={subject?.id}
        onValidated={(token) => {
          setSessionToken(token);
          setShowTokenModal(false);
        }}
        onCancel={onExit}
      />
    );
  }

  if (loading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-12 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-500">Preparando tu prueba...</p>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">No hay preguntas disponibles para esta prueba aún.</p>
          <Button className="mt-4" onClick={onExit}>Volver</Button>
        </CardContent>
      </Card>
    );
  }

  if (showResults) {
    // Estado: examen final pendiente de revisión docente
    if (pendingTeacherReview) {
      return (
        <Card className="max-w-2xl mx-auto border-yellow-200">
          <CardContent className="p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-12 h-12 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-yellow-700">Examen Enviado</h2>
            <p className="text-gray-600 mb-6">
              Tu examen final ha sido recibido y está <strong>pendiente de revisión por un docente</strong>.
              Recibirás retroalimentación una vez que sea evaluado.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6">
              <p className="text-4xl font-bold text-yellow-700 mb-2">{score}%</p>
              <Badge className="bg-yellow-200 text-yellow-800">🟡 En revisión</Badge>
              <p className="text-xs text-yellow-600 mt-3">
                El avance a la siguiente materia se desbloqueará cuando el docente apruebe tu examen.
              </p>
            </div>
            <Button onClick={onExit} variant="outline">Volver a la Materia</Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6",
            passed ? "bg-green-100" : "bg-red-100"
          )}>
            {passed
              ? <Trophy className="w-12 h-12 text-green-600" />
              : <XCircle className="w-12 h-12 text-red-600" />
            }
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {passed ? "¡Materia Aprobada!" : "No Aprobada"}
          </h2>
          <p className="text-gray-500 mb-6">
            {passed
              ? "Has aprobado la prueba exitosamente."
              : "Necesitas al menos 70% para aprobar."}
          </p>
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <p className="text-5xl font-bold text-gray-900 mb-2">{score}%</p>
            <Badge className={passed ? "bg-green-500" : "bg-red-400"}>
              {passed ? "Aprobado" : "No Aprobado"}
            </Badge>
          </div>
          <Button onClick={onExit}>Volver a la Materia</Button>
        </CardContent>
      </Card>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline">{subject?.name} — Prueba Final</Badge>
          <Badge variant="secondary">{currentQuestion + 1} de {questions.length}</Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6 prose prose-sm max-w-none [&_p]:my-0"><RichContentRenderer content={currentQ.question} inline /></h3>
        <RadioGroup
          value={answers[currentQuestion]?.toString()}
          onValueChange={handleAnswer}
          className="space-y-3"
        >
          {currentQ.options.map((option, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                answers[currentQuestion] === idx
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
              onClick={() => handleAnswer(idx.toString())}
            >
              <RadioGroupItem value={idx.toString()} id={`option-${idx}`} />
              <Label htmlFor={`option-${idx}`} className="cursor-pointer flex-1 prose prose-sm max-w-none [&_p]:my-0"><RichContentRenderer content={option} inline /></Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
      <CardFooter className="justify-end p-6 pt-0">
        <Button
          onClick={nextQuestion}
          disabled={answers[currentQuestion] === undefined}
          className="gap-2"
        >
          {currentQuestion < questions.length - 1 ? (
            <><span>Siguiente</span><ArrowRight className="w-4 h-4" /></>
          ) : "Finalizar Prueba"}
        </Button>
      </CardFooter>
    </Card>
  );
}