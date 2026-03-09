import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, CheckCircle2, Star, Zap, Info, Loader2 } from "lucide-react";
import MathText from '../math/MathText';

// Ayudas visuales por tema de la lección
const VISUAL_HINTS = {
  // Conjuntos numéricos
  'conjuntos': {
    type: 'diagram',
    content: '⊂ ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ',
    detail: 'Naturales ⊂ Enteros ⊂ Racionales ⊂ Reales'
  },
  'recta numérica': {
    type: 'number_line',
    numbers: [-3, -2, -1, 0, 1, 2, 3]
  },
  'valor absoluto': {
    type: 'formula',
    formulas: ['|5| = 5', '|-5| = 5', '|0| = 0']
  },
  // Operaciones
  'suma y resta de enteros': {
    type: 'rule',
    rules: ['(+) + (+) = +', '(−) + (−) = −', '(+) + (−) = signo del mayor']
  },
  'multiplicación y división': {
    type: 'rule',
    rules: ['(+) × (+) = +', '(−) × (−) = +', '(+) × (−) = −']
  },
  'fracciones: suma': {
    type: 'formula',
    formulas: ['a/b + c/d = (ad + bc) / bd', 'Busca el MCM de los denominadores']
  },
  'fracciones: multiplicación': {
    type: 'formula',
    formulas: ['a/b × c/d = ac / bd', 'a/b ÷ c/d = a/b × d/c']
  },
  // Potencias
  'potencias': {
    type: 'formula',
    formulas: ['aⁿ = a × a × ... (n veces)', 'a⁰ = 1', 'a¹ = a']
  },
  'leyes de los exponentes': {
    type: 'formula',
    formulas: ['aᵐ × aⁿ = aᵐ⁺ⁿ', 'aᵐ ÷ aⁿ = aᵐ⁻ⁿ', '(aᵐ)ⁿ = aᵐⁿ']
  },
  'raíces': {
    type: 'formula',
    formulas: ['√a = a^(1/2)', '³√a = a^(1/3)', '√a × √b = √(ab)']
  },
  // Álgebra
  'variable': {
    type: 'example',
    examples: ['3x → coef: 3, literal: x', '-5y² → coef: -5, literal: y²', '7 → término independiente']
  },
  'términos semejantes': {
    type: 'example',
    examples: ['3x + 5x = 8x  ✓ (semejantes)', '3x + 5x² ≠ 8x³  ✗', 'Solo se combinan si la parte literal es igual']
  },
  'simplificar expresiones': {
    type: 'formula',
    formulas: ['Distributiva: a(b+c) = ab + ac', '3x + 2y - x = 2x + 2y']
  },
  'polinomio': {
    type: 'example',
    examples: ['Monomio: 5x³', 'Binomio: x² + 3', 'Trinomio: 2x² - x + 1']
  },
  'suma y resta de polinomios': {
    type: 'formula',
    formulas: ['Agrupa términos semejantes', '(3x² + 2x) + (x² - 5x) = 4x² - 3x']
  },
  'multiplicación de polinomios': {
    type: 'formula',
    formulas: ['FOIL: (a+b)(c+d) = ac + ad + bc + bd', '(x+2)(x+3) = x² + 5x + 6']
  },
  'productos notables': {
    type: 'formula',
    formulas: ['(a+b)² = a² + 2ab + b²', '(a-b)² = a² - 2ab + b²', '(a+b)(a-b) = a² - b²']
  },
  'factor común': {
    type: 'formula',
    formulas: ['6x² + 9x = 3x(2x + 3)', 'Busca el MCD de todos los términos']
  },
  'factorización de trinomios': {
    type: 'formula',
    formulas: ['x² + bx + c = (x + p)(x + q)', 'donde p × q = c  y  p + q = b']
  },
  // Ecuaciones
  'ecuación lineal': {
    type: 'steps',
    steps: ['ax + b = c', '→ ax = c - b', '→ x = (c-b)/a']
  },
  'resolviendo ecuaciones': {
    type: 'steps',
    steps: ['1. Elimina paréntesis', '2. Agrupa x de un lado', '3. Agrupa constantes del otro', '4. Despeja x']
  },
  'ecuación cuadrática': {
    type: 'formula',
    formulas: ['ax² + bx + c = 0', 'Δ = b² - 4ac', 'Δ>0: dos soluciones, Δ=0: una, Δ<0: ninguna']
  },
  'factorización': {
    type: 'steps',
    steps: ['x² + 5x + 6 = 0', '→ (x + 2)(x + 3) = 0', '→ x = -2  o  x = -3']
  },
  'fórmula general': {
    type: 'formula',
    formulas: ['x = (−b ± √(b²−4ac)) / 2a']
  },
  'sistemas de ecuaciones': {
    type: 'example',
    examples: ['x + y = 5  →  (ec. 1)', '2x - y = 4  →  (ec. 2)', 'Solución: (x, y) satisface ambas']
  },
  'sustitución': {
    type: 'steps',
    steps: ['1. Despeja x de ec.1', '2. Sustituye en ec.2', '3. Resuelve para y', '4. Halla x']
  },
  'eliminación': {
    type: 'steps',
    steps: ['1. Ajusta coeficientes', '2. Suma o resta las ecuaciones', '3. Resuelve la variable', '4. Sustituye para hallar la otra']
  },
  // Funciones
  'función': {
    type: 'diagram',
    content: 'f: X → Y',
    detail: 'A cada x le corresponde exactamente un f(x)'
  },
  'dominio y rango': {
    type: 'example',
    examples: ['Dominio = conjunto de entradas (x)', 'Rango = conjunto de salidas f(x)', 'f(x)=√x → dominio: x ≥ 0']
  },
  'evaluación de funciones': {
    type: 'formula',
    formulas: ['f(a) → sustituye x = a', 'f(x) = x² + 1 → f(3) = 9 + 1 = 10']
  },
  'función lineal': {
    type: 'formula',
    formulas: ['f(x) = mx + b', 'm = pendiente (inclinación)', 'b = intercepto en y']
  },
  'pendiente': {
    type: 'formula',
    formulas: ['m = (y₂ - y₁) / (x₂ - x₁)', 'm > 0: crece, m < 0: decrece', 'm = 0: horizontal']
  },
  'parábola': {
    type: 'formula',
    formulas: ['f(x) = ax² + bx + c', 'a > 0: abre ↑ (mínimo)', 'a < 0: abre ↓ (máximo)', 'Vértice: x = -b/2a']
  },
};

function getVisualHint(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const [key, hint] of Object.entries(VISUAL_HINTS)) {
    if (lower.includes(key)) return hint;
  }
  return null;
}

function VisualHint({ hint }) {
  if (!hint) return null;

  if (hint.type === 'number_line') {
    return (
      <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-white/10 w-full max-w-lg">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">Recta numérica</span>
        </div>
        <div className="relative overflow-x-auto">
          <div className="flex items-center justify-center gap-0 min-w-max mx-auto">
            <div className="w-6 h-0.5 bg-white/40" />
            {hint.numbers.map((n, i) => (
              <React.Fragment key={n}>
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-3 bg-white/60 mb-1" />
                  <span className={`text-xs font-bold ${n === 0 ? 'text-yellow-400' : n < 0 ? 'text-red-400' : 'text-green-400'}`}>{n}</span>
                </div>
                {i < hint.numbers.length - 1 && <div className="w-7 h-0.5 bg-white/40" />}
              </React.Fragment>
            ))}
            <div className="w-6 h-0.5 bg-white/40" />
            <span className="text-white/60 ml-1 text-sm">→</span>
          </div>
        </div>
      </div>
    );
  }

  if (hint.type === 'formula') {
    return (
      <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-white/10 w-full max-w-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">Fórmulas clave</span>
        </div>
        <div className="space-y-1.5">
          {hint.formulas.map((f, i) => (
            <div key={i} className="bg-white/5 rounded-lg px-3 py-2 font-mono text-sm text-white/90 border border-white/10">
              {f}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hint.type === 'rule') {
    return (
      <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-white/10 w-full max-w-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">Regla de signos</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {hint.rules.map((r, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-sm font-medium border ${
              r.includes('= +') ? 'bg-green-500/15 border-green-500/30 text-green-300' :
              r.includes('= −') || r.includes('= -') ? 'bg-red-500/15 border-red-500/30 text-red-300' :
              'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}>
              {r}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hint.type === 'example') {
    return (
      <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-white/10 w-full max-w-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">Ejemplos</span>
        </div>
        <div className="space-y-1.5">
          {hint.examples.map((e, i) => (
            <div key={i} className="bg-white/5 rounded-lg px-3 py-2 text-sm text-white/85 border border-white/10 font-mono">
              {e}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hint.type === 'steps') {
    return (
      <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-white/10 w-full max-w-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">Paso a paso</span>
        </div>
        <div className="space-y-1.5">
          {hint.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
              <span className="text-sm text-white/85 font-mono">{s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hint.type === 'diagram') {
    return (
      <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-white/10 w-full max-w-lg text-center">
        <div className="text-2xl font-bold text-white/90 mb-1 font-mono tracking-wider">{hint.content}</div>
        {hint.detail && <p className="text-xs text-white/50">{hint.detail}</p>}
      </div>
    );
  }

  return null;
}

export default function LessonIntro({ lesson, activitiesCount, isMiniEval, alreadyCompleted, previousScore, onStart }) {
  const visualHint = getVisualHint(lesson?.title);
  const [enrichedExplanation, setEnrichedExplanation] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  useEffect(() => {
    if (!lesson?.explanation || isMiniEval) return;

    // Si ya existe una explicación cacheada en la entidad, usarla directamente
    if (lesson.ai_explanation) {
      setEnrichedExplanation(lesson.ai_explanation);
      return;
    }

    // Si no existe, generarla con IA y guardarla en la entidad para todos los usuarios
    setLoadingExplanation(true);
    base44.integrations.Core.InvokeLLM({
      prompt: `Eres un tutor de matemáticas de preparatoria. La siguiente es la explicación corta de una lección llamada "${lesson.title}": "${lesson.explanation}". 
Amplía esta explicación en 3-4 oraciones claras y didácticas para un estudiante de preparatoria. Incluye un ejemplo concreto si aplica. 
Responde SOLO con el texto de la explicación ampliada, sin títulos ni listas.`
    }).then(result => {
      setEnrichedExplanation(result);
      // Guardar en la entidad para que otros usuarios no tengan que regenerarla
      base44.entities.CourseLesson.update(lesson.id, { ai_explanation: result });
    }).finally(() => {
      setLoadingExplanation(false);
    });
  }, [lesson?.id]);

  return (
    <div className="flex flex-col items-center text-center py-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Icon */}
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
        isMiniEval 
          ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
          : 'bg-gradient-to-br from-blue-500 to-violet-600'
      }`}>
        {isMiniEval
          ? <ClipboardList className="w-10 h-10 text-white" />
          : <BookOpen className="w-10 h-10 text-white" />
        }
      </div>

      {/* Badge */}
      {isMiniEval && (
        <div className="bg-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-3 border border-amber-500/30">
          ⭐ Mini Evaluación del Módulo
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">{lesson.title}</h1>

      {/* Already completed badge */}
      {alreadyCompleted && previousScore !== undefined && (
        <div className="flex items-center gap-2 bg-green-500/20 text-green-300 text-sm px-4 py-2 rounded-full mb-4 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4" />
          Completada — Tu mejor puntaje: {previousScore}%
        </div>
      )}

      {/* Explanation */}
      {lesson.explanation && (
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-4 text-left border border-white/10 max-w-lg w-full">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Explicación</span>
          </div>
          {loadingExplanation ? (
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Preparando explicación...</span>
            </div>
          ) : (
            <p className="text-white/85 text-sm leading-relaxed">
              {enrichedExplanation || lesson.explanation}
            </p>
          )}
        </div>
      )}

      {/* Visual Hint */}
      {visualHint && !isMiniEval && <VisualHint hint={visualHint} />}

      {/* Info Row */}
      <div className="flex items-center gap-4 text-sm text-white/50 mb-8">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-400" />
          <span>{activitiesCount} actividades</span>
        </div>
        {isMiniEval ? (
          <div className="flex items-center gap-1.5">
            <span>Pasa con ≥80%</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span>~{Math.ceil(activitiesCount * 0.5)} min</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <Button
        onClick={onStart}
        size="lg"
        className={`w-full max-w-sm h-14 text-base font-bold rounded-2xl shadow-lg transition-transform hover:scale-[1.02] ${
          isMiniEval
            ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0'
            : 'bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white border-0'
        }`}
      >
        {alreadyCompleted ? '🔄 Repetir lección' : '🚀 Comenzar'}
      </Button>
    </div>
  );
}