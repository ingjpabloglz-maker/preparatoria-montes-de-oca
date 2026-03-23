import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Send, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_QUESTIONS = 8;

export default function AiTutorChat({ lesson, userEmail }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (open && lesson?.id && userEmail) {
      loadOrCreateSession();
    }
  }, [open, lesson?.id, userEmail]);

  const loadOrCreateSession = async () => {
    const existing = await base44.entities.AiTutorSession.filter({
      user_email: userEmail,
      lesson_id: lesson.id,
    });
    if (existing.length > 0) {
      setSessionId(existing[0].id);
      setQuestionsUsed(existing[0].questions_used ?? 0);
    } else {
      const created = await base44.entities.AiTutorSession.create({
        user_email: userEmail,
        lesson_id: lesson.id,
        questions_used: 0,
        max_questions: MAX_QUESTIONS,
        last_interaction: new Date().toISOString(),
      });
      setSessionId(created.id);
      setQuestionsUsed(0);
    }

    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `¡Hola! Soy tu tutor para esta lección: **${lesson.title}**. Puedes hacerme hasta ${MAX_QUESTIONS} preguntas. ¿En qué te puedo ayudar? 😊`,
      }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (questionsUsed >= MAX_QUESTIONS) return;

    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const newUsed = questionsUsed + 1;
    setQuestionsUsed(newUsed);

    if (sessionId) {
      base44.entities.AiTutorSession.update(sessionId, {
        questions_used: newUsed,
        last_interaction: new Date().toISOString(),
      });
    }

    const lessonContext = lesson.explanation || lesson.ai_explanation || '';
    const prompt = `Eres un tutor amable y paciente de preparatoria.

Solo puedes ayudar con esta lección: "${lesson.title}"

Contexto de la lección:
${lessonContext}

Si el alumno pregunta algo fuera del tema, responde amablemente que solo puedes ayudar con esta lección.

Responde de forma clara, breve y educativa (máximo 3-4 oraciones).

Pregunta del alumno: ${userMsg.content}`;

    const resp = await base44.integrations.Core.InvokeLLM({ prompt });

    setMessages(prev => [...prev, { role: 'assistant', content: resp }]);
    setLoading(false);
  };

  const remaining = MAX_QUESTIONS - questionsUsed;

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center",
          "bg-gradient-to-br from-violet-600 to-blue-600 text-white",
          "hover:scale-105 transition-transform",
          open && "hidden"
        )}
      >
        <Bot className="w-7 h-7" />
      </button>

      {/* Chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
             style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-white">
              <Bot className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm leading-tight">Tutor IA</p>
                <p className="text-xs text-white/70 leading-tight">
                  {remaining > 0 ? `Te quedan ${remaining} preguntas` : 'Límite alcanzado'}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  msg.role === 'user'
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t flex-shrink-0">
            {remaining <= 0 ? (
              <p className="text-center text-xs text-gray-400 py-1">
                Has alcanzado el límite de preguntas para esta lección.
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Escribe tu pregunta..."
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}