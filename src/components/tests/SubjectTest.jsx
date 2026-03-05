import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const sampleQuestions = [
  {
    id: 1,
    question: "Pregunta de evaluación 1",
    options: ["Opción A", "Opción B", "Opción C", "Opción D"],
    correct: 0
  },
  {
    id: 2,
    question: "Pregunta de evaluación 2",
    options: ["Opción A", "Opción B", "Opción C", "Opción D"],
    correct: 1
  },
  {
    id: 3,
    question: "Pregunta de evaluación 3",
    options: ["Opción A", "Opción B", "Opción C", "Opción D"],
    correct: 2
  }
];

export default function SubjectTest({ subject, questions = sampleQuestions, onComplete, onExit }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const handleAnswer = (value) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: parseInt(value) }));
  };

  const nextQuestion = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      let correct = 0;
      questions.forEach((q, idx) => {
        if (answers[idx] === q.correct) correct++;
      });
      const finalScore = Math.round((correct / questions.length) * 100);
      const passed = finalScore >= 70;
      setScore(finalScore);
      await onComplete?.(finalScore, passed);
      setShowResults(true);
    }
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const passed = score >= 70;

  if (showResults) {
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
          <Badge variant="outline">{subject?.name} — Prueba</Badge>
          <Badge variant="secondary">{currentQuestion + 1} de {questions.length}</Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6">{currentQ.question}</h3>
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
            >
              <RadioGroupItem value={idx.toString()} id={`option-${idx}`} />
              <Label htmlFor={`option-${idx}`} className="cursor-pointer flex-1">{option}</Label>
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