import React from 'react';
import { createPageUrl } from '@/utils';
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Lock, BookOpen, ClipboardList, PlayCircle, Circle } from "lucide-react";

export default function ModulePath({
  module, moduleIndex, lessons, lessonProgressList,
  isUnlocked, isLessonUnlocked, color
}) {
  const regularLessons = lessons.filter(l => !l.is_mini_eval);
  const miniEval = lessons.find(l => l.is_mini_eval);

  const completedLessons = regularLessons.filter(l =>
    lessonProgressList.find(lp => lp.lesson_id === l.id && lp.completed)
  ).length;

  const miniEvalProgress = miniEval
    ? lessonProgressList.find(lp => lp.lesson_id === miniEval.id)
    : null;

  const moduleProgress = regularLessons.length > 0
    ? Math.round((completedLessons / regularLessons.length) * 100)
    : 0;

  const isModuleComplete = miniEvalProgress?.passed === true;

  return (
    <div className={`rounded-xl border ${isUnlocked ? 'border-slate-200 bg-slate-50/50' : 'border-slate-100 bg-slate-50/30 opacity-60'} overflow-hidden`}>
      {/* Module Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        {isModuleComplete ? (
          <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
        ) : !isUnlocked ? (
          <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          </div>
        ) : (
          <div className={`w-7 h-7 ${color.bg} rounded-full flex items-center justify-center flex-shrink-0 opacity-80`}>
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-700 truncate">{module.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Progress value={moduleProgress} className="h-1 flex-1 max-w-24" />
            <span className="text-xs text-gray-400">{completedLessons}/{regularLessons.length} lecciones</span>
          </div>
        </div>
      </div>

      {/* Lessons */}
      {isUnlocked && (
        <div className="px-3 pb-3 space-y-1.5">
          {lessons.map((lesson, lessonIndex) => {
            const lessonProgress = lessonProgressList.find(lp => lp.lesson_id === lesson.id);
            const isCompleted = lessonProgress?.completed === true;
            const isPassed = lessonProgress?.passed === true;
            const lessonUnlocked = isLessonUnlocked(lesson, lessonIndex, lessons);

            return (
              <LessonButton
                key={lesson.id}
                lesson={lesson}
                isCompleted={isCompleted}
                isPassed={isPassed}
                isUnlocked={lessonUnlocked}
                color={color}
                score={lessonProgress?.score}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function LessonButton({ lesson, isCompleted, isPassed, isUnlocked, color, score }) {
  const isMiniEval = lesson.is_mini_eval;

  const handleClick = () => {
    if (!isUnlocked) return;
    window.location.href = createPageUrl(`Lesson?id=${lesson.id}`);
  };

  const getStatusIcon = () => {
    if (isCompleted || isPassed) return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
    if (!isUnlocked) return <Lock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />;
    if (isMiniEval) return <ClipboardList className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    return <PlayCircle className={`w-4 h-4 ${color.text} flex-shrink-0`} />;
  };

  const getBgClass = () => {
    if (!isUnlocked) return 'bg-white border border-slate-100 opacity-50 cursor-not-allowed';
    if (isCompleted || isPassed) return 'bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors';
    if (isMiniEval) return 'bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors';
    return `bg-white border ${color.border} cursor-pointer hover:${color.light} transition-colors`;
  };

  return (
    <button
      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 ${getBgClass()}`}
      onClick={handleClick}
      disabled={!isUnlocked}
    >
      {getStatusIcon()}
      <span className={`flex-1 text-sm font-medium ${isUnlocked ? 'text-gray-700' : 'text-slate-400'} truncate`}>
        {isMiniEval ? '📝 ' : ''}{lesson.title}
      </span>
      {(isCompleted || isPassed) && score !== undefined && (
        <span className="text-xs font-semibold text-green-600 flex-shrink-0">{score}%</span>
      )}
      {isMiniEval && !isCompleted && isUnlocked && (
        <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Evaluación</span>
      )}
    </button>
  );
}