import React from 'react';
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, CheckCircle2, Star, Zap, Info, Lightbulb, FlaskConical } from "lucide-react";

// ─── Detección de materia ─────────────────────────────────────────────────────
function detectSubjectType(subjectName = '') {
  const s = subjectName.toLowerCase();
  if (/matem|álgebra|algebra|cálculo|calculo|geometr|trigon|estadíst/.test(s)) return 'math';
  if (/física|fisica|química|quimica|biolog|ciencia/.test(s)) return 'science';
  if (/historia|filosofía|filosofia|literatura|ética|etica|sociolog|geografía/.test(s)) return 'humanities';
  if (/informát|informatic|programac|computac|tecnolog|software|hardware/.test(s)) return 'tech';
  if (/econom|contabilidad|administrac|finanz/.test(s)) return 'economics';
  return 'default';
}

// ─── Estilos por materia ──────────────────────────────────────────────────────
const SUBJECT_THEMES = {
  math: {
    accent: 'blue',
    keyPointBg: 'bg-slate-800/70 border-slate-600/40',
    keyPointTitle: 'text-cyan-300',
    keyPointContent: 'text-slate-200',
    exampleBg: 'bg-blue-900/30 border-blue-500/30',
    exampleQ: 'text-blue-200',
    exampleS: 'text-cyan-300',
    introBg: 'bg-blue-500/15 border-blue-500/30',
    introText: 'text-blue-300',
    summaryBg: 'bg-violet-500/15 border-violet-500/30',
    summaryText: 'text-violet-300',
    exampleLabel: '🔢 Ejercicio',
    useMono: true,
  },
  science: {
    accent: 'emerald',
    keyPointBg: 'bg-emerald-900/30 border-emerald-700/30',
    keyPointTitle: 'text-emerald-300',
    keyPointContent: 'text-slate-200',
    exampleBg: 'bg-teal-900/30 border-teal-500/30',
    exampleQ: 'text-teal-200',
    exampleS: 'text-emerald-300',
    introBg: 'bg-emerald-500/15 border-emerald-500/30',
    introText: 'text-emerald-300',
    summaryBg: 'bg-teal-500/15 border-teal-500/30',
    summaryText: 'text-teal-300',
    exampleLabel: '🧪 Experimento',
    useMono: false,
  },
  humanities: {
    accent: 'amber',
    keyPointBg: 'bg-amber-900/25 border-amber-700/30',
    keyPointTitle: 'text-amber-300',
    keyPointContent: 'text-slate-200',
    exampleBg: 'bg-orange-900/25 border-orange-500/30',
    exampleQ: 'text-orange-200',
    exampleS: 'text-amber-300',
    introBg: 'bg-amber-500/15 border-amber-500/30',
    introText: 'text-amber-300',
    summaryBg: 'bg-orange-500/15 border-orange-500/30',
    summaryText: 'text-orange-300',
    exampleLabel: '📜 Ejemplo histórico',
    useMono: false,
  },
  tech: {
    accent: 'indigo',
    keyPointBg: 'bg-slate-900/70 border-indigo-700/40',
    keyPointTitle: 'text-indigo-300',
    keyPointContent: 'text-slate-200',
    exampleBg: 'bg-indigo-900/30 border-indigo-500/30',
    exampleQ: 'text-indigo-200',
    exampleS: 'text-cyan-300',
    introBg: 'bg-indigo-500/15 border-indigo-500/30',
    introText: 'text-indigo-300',
    summaryBg: 'bg-slate-800/60 border-slate-600/40',
    summaryText: 'text-slate-300',
    exampleLabel: '💻 Ejemplo',
    useMono: true,
  },
  economics: {
    accent: 'yellow',
    keyPointBg: 'bg-yellow-900/20 border-yellow-700/30',
    keyPointTitle: 'text-yellow-300',
    keyPointContent: 'text-slate-200',
    exampleBg: 'bg-lime-900/25 border-lime-500/30',
    exampleQ: 'text-lime-200',
    exampleS: 'text-yellow-300',
    introBg: 'bg-yellow-500/15 border-yellow-500/30',
    introText: 'text-yellow-300',
    summaryBg: 'bg-lime-500/15 border-lime-500/30',
    summaryText: 'text-lime-300',
    exampleLabel: '💰 Caso práctico',
    useMono: false,
  },
  default: {
    accent: 'violet',
    keyPointBg: 'bg-white/8 border-white/10',
    keyPointTitle: 'text-white/95',
    keyPointContent: 'text-white/75',
    exampleBg: 'bg-emerald-500/10 border-emerald-500/25',
    exampleQ: 'text-white/85',
    exampleS: 'text-emerald-200',
    introBg: 'bg-blue-500/15 border-blue-500/30',
    introText: 'text-blue-300',
    summaryBg: 'bg-violet-500/15 border-violet-500/30',
    summaryText: 'text-violet-300',
    exampleLabel: '📌 Ejemplo',
    useMono: false,
  },
};

// ─── Iconos automáticos por key_point.title ───────────────────────────────────
function mapKeyPointIcon(title = '') {
  const t = title.toLowerCase();
  if (/suma|adición|adicionar/.test(t)) return '➕';
  if (/resta|sustracción|sustracc/.test(t)) return '➖';
  if (/multiplicac|producto/.test(t)) return '✖️';
  if (/divisi/.test(t)) return '➗';
  if (/potencia|exponente/.test(t)) return '🔼';
  if (/raíz|radical/.test(t)) return '√';
  if (/ecuaci|inecuaci/.test(t)) return '📐';
  if (/función|funcion/.test(t)) return '📈';
  if (/gráfica|grafica|diagrama/.test(t)) return '📊';
  if (/fórmula|formula|expresi/.test(t)) return '🔢';
  if (/ley|principio|teorema/.test(t)) return '⚖️';
  if (/energía|energia|fuerza|movimiento/.test(t)) return '⚡';
  if (/célula|celula|gen|adn|proteína/.test(t)) return '🧬';
  if (/reacci|quím|química|compuesto|element/.test(t)) return '⚗️';
  if (/experimento|laboratorio/.test(t)) return '🧪';
  if (/historia|cronolog|época|siglo|guerra/.test(t)) return '📜';
  if (/revoluc|independenc|movimient/.test(t)) return '🏛️';
  if (/tiempo|fecha|período|periodo/.test(t)) return '⏳';
  if (/computadora|computac|sistema|software|hardware/.test(t)) return '💻';
  if (/programac|código|codigo|algoritmo/.test(t)) return '🖥️';
  if (/econom|mercado|finanz|precio/.test(t)) return '💰';
  if (/tabla|estadística|estadistica|promedio|media/.test(t)) return '📋';
  if (/cultura|arte|música|música|literatura|poem/.test(t)) return '🎭';
  if (/geografía|geografia|territorio|región|pais/.test(t)) return '🌍';
  if (/animal|especie|evolución|evolucion/.test(t)) return '🦋';
  if (/planeta|sistema solar|astronomía|universo/.test(t)) return '🪐';
  if (/definici|concepto|qué es|que es/.test(t)) return '📖';
  if (/resumen|conclusion|conclusión/.test(t)) return '📝';
  return '📘';
}

// ─── Detección de contenido matemático/técnico ────────────────────────────────
function isMathContent(text = '') {
  return /[\+\-\×\÷\=\^\%\(\)\[\]\d]{3,}|[a-z]\s*[\+\-\=\^]\s*[a-z0-9]|\d+\s*[\+\-\×\÷\=]\s*\d/.test(text);
}

function ExampleContent({ text, useMono, colorClass }) {
  if (useMono || isMathContent(text)) {
    return (
      <span className={`font-mono text-sm ${colorClass}`}>{text}</span>
    );
  }
  return <span className={`text-sm ${colorClass}`}>{text}</span>;
}

// ─── Explicación estructurada ─────────────────────────────────────────────────
function StructuredExplanation({ explanation, subjectName }) {
  // Retrocompatibilidad: string plano
  if (typeof explanation === 'string') {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-4 text-left border border-white/10 max-w-lg w-full">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Explicación</span>
        </div>
        <p className="text-white/85 text-sm leading-relaxed whitespace-pre-line">{explanation}</p>
      </div>
    );
  }

  if (!explanation || typeof explanation !== 'object') return null;

  const type = detectSubjectType(subjectName);
  const theme = SUBJECT_THEMES[type] || SUBJECT_THEMES.default;
  const { intro, key_points = [], examples = [], summary } = explanation;

  return (
    <div className="max-w-lg w-full space-y-3 mb-4 text-left">

      {/* Intro */}
      {intro && (
        <div className={`${theme.introBg} border rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-1.5">
            <Info className="w-4 h-4 flex-shrink-0 opacity-70" />
            <span className={`text-xs font-semibold uppercase tracking-wide ${theme.introText}`}>Introducción</span>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">{intro}</p>
        </div>
      )}

      {/* Key Points */}
      {key_points.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Conceptos clave</span>
          </div>
          {key_points.map((kp, i) => {
            const icon = mapKeyPointIcon(kp.title);
            const hasMathExample = isMathContent(kp.example || '');
            return (
              <div key={i} className={`${theme.keyPointBg} border rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base leading-none">{icon}</span>
                  <p className={`text-sm font-semibold ${theme.keyPointTitle}`}>{kp.title}</p>
                </div>
                <p className={`text-sm leading-relaxed mb-2 ${theme.keyPointContent}`}>{kp.content}</p>
                {kp.example && (
                  <div className={`rounded-lg px-3 py-2 ${
                    hasMathExample || theme.useMono
                      ? 'bg-black/30 border border-white/10'
                      : 'bg-white/5 border border-white/10'
                  }`}>
                    <span className="text-xs text-white/40 font-semibold uppercase tracking-wide">Ej: </span>
                    <ExampleContent
                      text={kp.example}
                      useMono={theme.useMono}
                      colorClass={hasMathExample || theme.useMono ? 'text-white/90' : 'text-white/80'}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ejemplos prácticos */}
      {examples.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
              {theme.exampleLabel}s
            </span>
          </div>
          {examples.map((ex, i) => {
            const mathQ = isMathContent(ex.question || '');
            const mathS = isMathContent(ex.solution || '');
            return (
              <div key={i} className={`${theme.exampleBg} border rounded-xl p-4`}>
                <div className="mb-2">
                  <span className="text-xs text-white/40 font-semibold uppercase tracking-wide block mb-1">{theme.exampleLabel}</span>
                  {mathQ || theme.useMono ? (
                    <p className={`font-mono text-sm ${theme.exampleQ}`}>{ex.question}</p>
                  ) : (
                    <p className={`text-sm ${theme.exampleQ}`}>{ex.question}</p>
                  )}
                </div>
                <div className={`rounded-lg px-3 py-2 ${
                  mathS || theme.useMono ? 'bg-black/30 border border-white/10' : 'bg-white/5 border border-white/10'
                }`}>
                  <span className="text-xs text-white/40 font-semibold uppercase tracking-wide">✅ Solución: </span>
                  {mathS || theme.useMono ? (
                    <span className={`font-mono text-sm ${theme.exampleS}`}>{ex.solution}</span>
                  ) : (
                    <span className={`text-sm ${theme.exampleS}`}>{ex.solution}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen */}
      {summary && (
        <div className={`${theme.summaryBg} border rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-1.5">
            <Star className="w-4 h-4 flex-shrink-0 opacity-70" />
            <span className={`text-xs font-semibold uppercase tracking-wide ${theme.summaryText}`}>Resumen</span>
          </div>
          <p className="text-white/85 text-sm leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LessonIntro({ lesson, activitiesCount, isMiniEval, alreadyCompleted, previousScore, onStart, subjectName }) {
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

      {isMiniEval && (
        <div className="bg-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-3 border border-amber-500/30">
          ⭐ Mini Evaluación del Módulo
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">{lesson.title}</h1>

      {alreadyCompleted && previousScore !== undefined && (
        <div className="flex items-center gap-2 bg-green-500/20 text-green-300 text-sm px-4 py-2 rounded-full mb-4 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4" />
          Completada — Tu mejor puntaje: {previousScore}%
        </div>
      )}

      {/* Explicación pregenerada */}
      {lesson.explanation && !isMiniEval && (
        <StructuredExplanation explanation={lesson.explanation} subjectName={subjectName || lesson.subject_name || ''} />
      )}

      {/* Info */}
      <div className="flex items-center gap-4 text-sm text-white/50 mb-8">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-400" />
          <span>{activitiesCount} actividades</span>
        </div>
        {isMiniEval ? (
          <span>Pasa con ≥60%</span>
        ) : (
          <span>~{Math.ceil(activitiesCount * 0.5)} min</span>
        )}
      </div>

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