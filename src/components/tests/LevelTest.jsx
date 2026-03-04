import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Trophy,
  RotateCcw,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

// Preguntas de ejemplo - en producción vendrían de la base de datos
const sampleQuestions = [
  {
    id: 1,
    question: "Esta es una pregunta de ejemplo para la prueba",
    options: ["Opción A", "Opción B", "Opción C", "Opción D"],
    correct: 0
  },
  {
    id: 2,
    question: "Segunda pregunta de ejemplo",
    options: ["Respuesta 1", "Respuesta 2", "Respuesta 3", "Respuesta 4"],
    correct: 1
  },
  {
    id: 3,
    question: "Tercera pregunta de evaluación",
    options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
    correct: 2
  }
];

export default function LevelTest({ 
  level, 
  testNumber, 
  questions = sampleQuestions,
  onComplete 
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const handleAnswer = (value) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion]: parseInt(value)
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Calcular resultado
      let correct = 0;
      questions.forEach((q, idx) => {
        if (answers[idx] === q.correct) correct++;
      });
      const finalScore = Math.round((correct / questions.length) * 100);
      setScore(finalScore);
      setShowResults(true);
      // Guardar resultado
      onComplete?.(finalScore, finalScore >= 70);
    }
  };

  const resetTest = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setScore(0);
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
            {passed ? (
              <Trophy className="w-12 h-12 text-green-600" />
            ) : (
              <XCircle className="w-12 h-12 text-red-600" />
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2">
            {passed ? "¡Felicidades!" : "Sigue Practicando"}
          </h2>
          
          <p className="text-gray-500 mb-6">
            {passed 
              ? "Has aprobado esta prueba exitosamente" 
              : "Necesitas al menos 70% para aprobar"
            }
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <p className="text-5xl font-bold text-gray-900 mb-2">{score}%</p>
            <Badge variant={passed ? "default" : "secondary"} className={passed ? "bg-green-500" : ""}>
              {passed ? "Aprobado" : "No Aprobado"}
            </Badge>
          </div>

          {!passed && (
            <Button onClick={resetTest} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Intentar de Nuevo
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline">
            Nivel {level} - Prueba {testNumber}
          </Badge>
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            {currentQuestion + 1} de {questions.length}
          </Badge>
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
              <Label htmlFor={`option-${idx}`} className="cursor-pointer flex-1">
                {option}
              </Label>
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
            <>
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            "Finalizar Prueba"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}