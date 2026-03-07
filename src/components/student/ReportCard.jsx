import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, GraduationCap } from "lucide-react";

/**
 * Convierte un porcentaje (0-100) a calificación decimal con redondeo a .0 o .5
 * Mínimo: 5.0 (para porcentajes < 50%)
 * Lógica de redondeo por bloque de 10:
 *   X0–X3 → X.0
 *   X4–X6 → X.5
 *   X7–X9 → (X+1).0
 */
export function percentToGrade(percent) {
  if (percent == null) return null;
  const p = Math.min(100, Math.max(0, percent));

  // Mínimo absoluto
  if (p < 50) return 5.0;

  const base = Math.floor(p / 10); // dígito de las decenas
  const rem = p % 10;              // residuo

  let grade;
  if (rem <= 3) {
    grade = base + 0.0;
  } else if (rem <= 6) {
    grade = base + 0.5;
  } else {
    grade = base + 1.0;
  }

  // Aplicar mínimo 5.0 por si acaso
  grade = Math.max(5.0, grade);
  // Cap en 10.0
  grade = Math.min(10.0, grade);

  return grade;
}

export function gradeLabel(grade) {
  if (grade == null) return '—';
  return grade.toFixed(1);
}

export default function ReportCard({ subjects, subjectProgress, currentLevel }) {
  // Agrupar materias por nivel
  const levelNumbers = [...new Set(subjects.map(s => s.level))].sort((a, b) => a - b);

  const getLevelRows = (levelNum) => {
    const levelSubjs = subjects.filter(s => s.level === levelNum);
    return levelSubjs.map((subj) => {
      const sp = subjectProgress.find(p => p.subject_id === subj.id);
      const rawGrade = sp?.final_grade ?? null;
      const grade = rawGrade != null ? percentToGrade(rawGrade) : null;
      const passed = sp?.test_passed || false;
      return { subj, grade, passed, attempted: (sp?.test_attempts || 0) > 0 };
    });
  };

  const getLevelAverage = (rows) => {
    const graded = rows.filter(r => r.grade != null);
    if (graded.length === 0) return null;
    const sum = graded.reduce((acc, r) => acc + r.grade, 0);
    // Promedio de calificaciones ya redondeadas, luego redondear el promedio también
    const raw = sum / graded.length;
    // Redondear el promedio a .0 o .5
    return Math.round(raw * 2) / 2;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-blue-600" />
          Boleta de Calificaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {levelNumbers.map((levelNum) => {
          const rows = getLevelRows(levelNum);
          const avg = getLevelAverage(rows);
          const isCurrentLvl = levelNum === currentLevel;
          const allPassed = rows.length > 0 && rows.every(r => r.passed);

          return (
            <div key={levelNum} className="rounded-xl border overflow-hidden">
              {/* Header del nivel */}
              <div className={`flex items-center justify-between px-4 py-3 ${
                isCurrentLvl ? 'bg-blue-600 text-white' :
                allPassed ? 'bg-green-600 text-white' :
                'bg-gray-100 text-gray-700'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Nivel {levelNum}</span>
                  {isCurrentLvl && (
                    <Badge className="bg-white/20 text-white border-0 text-xs">Actual</Badge>
                  )}
                  {allPassed && !isCurrentLvl && (
                    <Badge className="bg-white/20 text-white border-0 text-xs">Completado</Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-75">Promedio del nivel</p>
                  <p className={`text-xl font-bold ${avg != null && avg >= 7 ? '' : avg != null ? 'text-red-200' : 'opacity-50'}`}>
                    {avg != null ? avg.toFixed(1) : '—'}
                  </p>
                </div>
              </div>

              {/* Filas de materias */}
              <div className="divide-y">
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-400 px-4 py-3">Sin materias configuradas</p>
                ) : (
                  rows.map(({ subj, grade, passed, attempted }) => (
                    <div key={subj.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {passed
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        }
                        <p className="text-sm font-medium text-gray-800 truncate">{subj.name}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {grade != null ? (
                          <>
                            <span className={`text-lg font-bold tabular-nums ${
                              grade >= 7 ? 'text-green-700' : 'text-red-500'
                            }`}>
                              {grade.toFixed(1)}
                            </span>
                            <Badge className={`text-xs ${
                              passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {passed ? 'Aprobada' : 'No Aprobada'}
                            </Badge>
                          </>
                        ) : attempted ? (
                          <span className="text-sm text-gray-400">Sin calificación</span>
                        ) : (
                          <span className="text-sm text-gray-300">Pendiente</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}