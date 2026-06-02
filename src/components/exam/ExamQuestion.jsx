import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ExamQuestion({ question, onAnswer, onFlag, disabled }) {
  const { index, question_text, type, options, user_answer, flagged } = question;

  return (
    <div className={cn(
      "bg-white rounded-2xl border-2 p-6 transition-all",
      flagged ? "border-yellow-400" : user_answer ? "border-green-300" : "border-gray-200"
    )}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-500 capitalize">{type.replace('_', ' ')}</span>
        </div>
        <button
          onClick={() => !disabled && onFlag(index)}
          className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition",
            flagged ? "bg-yellow-100 text-yellow-700" : "text-gray-400 hover:text-yellow-600"
          )}
          disabled={disabled}
        >
          <Flag className="w-3.5 h-3.5" />
          {flagged ? 'Marcada' : 'Marcar'}
        </button>
      </div>

      <p className="text-gray-800 font-medium mb-5 leading-relaxed">{question_text}</p>

      {/* Multiple Choice / True-False */}
      {(type === 'multiple_choice' || type === 'true_false') && (
        <div className="space-y-2">
          {(type === 'true_false' ? ['Verdadero', 'Falso'] : options).map((opt, i) => (
            <button
              key={i}
              onClick={() => !disabled && onAnswer(index, opt)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all",
                user_answer === opt
                  ? "border-blue-500 bg-blue-50 text-blue-800 font-semibold"
                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700",
                disabled && "cursor-not-allowed opacity-70"
              )}
              disabled={disabled}
            >
              <span className="font-bold mr-2 text-gray-400">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Fill in the blank */}
      {type === 'fill_blank' && (
        <input
          type="text"
          placeholder="Escribe tu respuesta..."
          value={user_answer || ''}
          onChange={e => !disabled && onAnswer(index, e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full border-2 rounded-xl px-4 py-3 text-sm outline-none transition-all",
            user_answer ? "border-blue-400 bg-blue-50" : "border-gray-200 focus:border-blue-400",
            disabled && "cursor-not-allowed opacity-70 bg-gray-50"
          )}
        />
      )}
    </div>
  );
}