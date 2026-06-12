import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Link } from 'react-router-dom';

const CATEGORIAS = [
  "Lecciones y Actividades",
  "Gamificación",
  "Pagos y Colegiaturas",
  "Exámenes",
  "Soporte"
];

const CATEGORIA_COLORS = {
  "Lecciones y Actividades": "bg-blue-100 text-blue-700",
  "Gamificación": "bg-purple-100 text-purple-700",
  "Pagos y Colegiaturas": "bg-green-100 text-green-700",
  "Exámenes": "bg-orange-100 text-orange-700",
  "Soporte": "bg-gray-100 text-gray-700",
};

const CATEGORIA_EMOJI = {
  "Lecciones y Actividades": "📚",
  "Gamificación": "🌳",
  "Pagos y Colegiaturas": "💳",
  "Exámenes": "📝",
  "Soporte": "🎧",
};

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");

  useEffect(() => {
    base44.entities.FAQ.list('orden', 100).then(data => {
      setFaqs(data);
      setLoading(false);
    });
  }, []);

  const categoriasFiltradas = categoriaActiva === "Todas"
    ? faqs
    : faqs.filter(f => f.categoria === categoriaActiva);

  const faqsAgrupadas = CATEGORIAS.reduce((acc, cat) => {
    const items = categoriasFiltradas.filter(f => f.categoria === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/app/Dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Preguntas Frecuentes</h1>
            <p className="text-sm text-gray-500">Todo lo que necesitas saber para usar la plataforma</p>
          </div>
        </div>

        {/* Filtros de categoría */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoriaActiva("Todas")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              categoriaActiva === "Todas"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            Todas
          </button>
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaActiva(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                categoriaActiva === cat
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {CATEGORIA_EMOJI[cat]} {cat}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          </div>
        ) : Object.keys(faqsAgrupadas).length === 0 ? (
          <div className="text-center py-16">
            <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No hay preguntas disponibles aún.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(faqsAgrupadas).map(([categoria, items]) => (
              <div key={categoria} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-xl">{CATEGORIA_EMOJI[categoria]}</span>
                  <h2 className="font-semibold text-gray-800">{categoria}</h2>
                  <Badge variant="outline" className="ml-auto text-xs">{items.length}</Badge>
                </div>
                <Accordion type="single" collapsible className="px-2">
                  {items.map((faq, idx) => (
                    <AccordionItem key={faq.id} value={faq.id} className="border-b last:border-0">
                      <AccordionTrigger className="px-4 text-left text-sm font-medium text-gray-800 hover:no-underline">
                        {faq.pregunta}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-sm text-gray-600 whitespace-pre-line">{faq.respuesta}</p>
                        {faq.imagen_url && (
                          <img
                            src={faq.imagen_url}
                            alt="Apoyo visual"
                            className="mt-3 rounded-xl w-full max-h-64 object-contain border border-gray-100"
                          />
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}