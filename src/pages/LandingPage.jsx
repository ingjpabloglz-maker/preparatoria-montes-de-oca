import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, ShieldCheck, Award, ChevronRight, MapPin, Mail, Phone } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar Pública */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">Montes de Oca</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Iniciar Sesión</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white hidden">Registrarse</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center py-20 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-8">
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 px-3 py-1 text-xs border-0 hidden">
            Plataforma Educativa Oficial
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight leading-none">Tu Preparatoria, a tu propio ritmo!

          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">Accede a un plan de estudios completo, actividades dinámicas y evaluaciones oficiales validadas por docentes certificados.
Funcionamos con el reconocimiento de la SEP, bajo el Registro de validez oficial 28PBH0301U
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/login">
              <Button className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl gap-2">
                Ingresar a la Plataforma <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="outline" className="w-full sm:w-auto h-12 px-8 font-medium rounded-xl hidden">
                Crear Cuenta Nueva
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="py-16 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 space-y-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Plan de Estudios Flex</h3>
            <p className="text-sm text-gray-600">Material didáctico estructurado en módulos interactivos para facilitar tu aprendizaje a tu propio ritmo.</p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 space-y-4">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Seguimiento Académico</h3>
            <p className="text-sm text-gray-600">Visualiza tu avance por materia, mantén una racha de estudio diaria y alcanza tus metas semanales.</p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 space-y-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Validez y Seguridad</h3>
            <p className="text-sm text-gray-600">Evaluaciones con revisión docente, tokens presenciales y expedientes exportables alineados a normativas oficiales.</p>
          </div>
        </div>
      </section>

      {/* Footer Público con información institucional */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Marca */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-white" />
                <span className="font-bold text-white text-lg">Preparatoria Montes de Oca</span>
              </div>
              <p className="text-sm leading-relaxed px-3">Desde hace más de 16 años nuestra finalidad como es impartir a los alumnos enseñanza a nivel Medio Superior para contribuir al desarrollo de México por medio de la preparación integral de sus estudiantes, capacitándolos a continuar con estudios profesionales y de calidad, orientados a su vocación.</p>
            </div>

            {/* Contacto */}
            <div className="space-y-3">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wide">Contacto</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <a href="mailto:info@prepamontesdeoca.com" className="hover:text-white transition-colors">
                    info@prepamontesdeoca.com
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>Tamaulipas, México</span>
                </div>
              </div>
            </div>

            {/* Legal */}
            <div className="space-y-3">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wide">Legal</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <Link to="/privacy-policy" className="hover:text-white transition-colors block">Política de Privacidad</Link>
                </div>
                <div>
                  <Link to="/terms" className="hover:text-white transition-colors block">Términos de Servicio</Link>
                </div>
                <div>
                  <Link to="/login" className="hover:text-white transition-colors block">Iniciar Sesión</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Preparatoria Montes de Oca · Todos los derechos reservados · Tamaulipas, México
          </div>
        </div>
      </footer>
    </div>);

}