import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, BookOpen, ShieldCheck, Award, ChevronRight,
  MapPin, Mail, Phone, Clock, Users, CheckCircle2, Star,
  Laptop, TrendingUp, Calendar, FlaskConical, Globe, Cpu,
  BookMarked, Leaf, Calculator, Menu, X, Facebook } from
"lucide-react";

const LOGO_URL = "https://media.base44.com/images/public/69a88a8bf5baf0edfc4ac0c5/e80acaed0_logoactualizado.jpg";

const SUBJECTS = [
{ name: "Álgebra", icon: Calculator, color: "text-blue-600 border-blue-100" },
{ name: "Física", icon: FlaskConical, color: "text-purple-600 border-purple-100" },
{ name: "Literatura", icon: BookMarked, color: "text-amber-600 border-amber-100" },
{ name: "Biología", icon: Leaf, color: "text-green-600 border-green-100" },
{ name: "Ecología", icon: Globe, color: "text-teal-600 border-teal-100" },
{ name: "Informática", icon: Cpu, color: "text-slate-600 border-slate-200" }];


const STATS = [
{ value: "+15", label: "Años de experiencia", icon: Star },
{ value: "RVOE", label: "Reconocimiento SEP", icon: ShieldCheck },
{ value: "Comunidad", label: "Estudiantes activos", icon: Users },
{ value: "24/7", label: "Acceso a la plataforma", icon: Clock }];


const STEPS = [
{
  num: "01",
  title: "Crea tu cuenta",
  desc: "Regístrate con tu correo electrónico y completa tu perfil académico en minutos.",
  icon: Users,
  color: "bg-blue-500"
},
{
  num: "02",
  title: "Completa lecciones interactivas",
  desc: "Aprende a tu ritmo con contenido estructurado por módulos y actividades dinámicas.",
  icon: BookOpen,
  color: "bg-purple-500"
},
{
  num: "03",
  title: "Presenta evaluaciones",
  desc: "Acredita cada materia con exámenes en línea validados por docentes certificados.",
  icon: CheckCircle2,
  color: "bg-green-500"
}];


const WHY_US = [
{
  icon: Calendar,
  title: "Flexibilidad total",
  desc: "Estudia cuando y donde quieras. Diseñado para adaptarse a tu horario y ritmo de vida.",
  color: "bg-blue-100 text-blue-600"
},
{
  icon: Laptop,
  title: "Plataforma moderna",
  desc: "Tecnología educativa actualizada con seguimiento de progreso, foro académico y más.",
  color: "bg-purple-100 text-purple-600"
},
{
  icon: TrendingUp,
  title: "Seguimiento académico",
  desc: "Reportes de avance, estadísticas de estudio y comunicación directa con docentes.",
  color: "bg-green-100 text-green-600"
}];


export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">

      {/* ─── NAVBAR ─── */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src="https://media.base44.com/images/public/69a88a8bf5baf0edfc4ac0c5/43d9d88f6_logo_actualizado_-_Copy.jpg"

            alt="Preparatoria Montes de Oca"
            className="h-10 w-10 rounded-full object-cover border-2 border-slate-100"
            loading="lazy" />
            
            <span className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              Preparatoria<br className="hidden sm:block" />
              <span className="text-blue-600">Montes de Oca</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#como-funciona" className="hover:text-blue-600 transition-colors">¿Cómo funciona?</a>
            <a href="#materias" className="hover:text-blue-600 transition-colors">Materias</a>
            <a href="#nosotros" className="hover:text-blue-600 transition-colors">Por qué elegirnos</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-slate-700 hover:text-blue-600">
                Iniciar Sesión
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5">
                Registrarse
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}>
            
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen &&
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
            <a href="#como-funciona" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-600 py-2 hover:text-blue-600">¿Cómo funciona?</a>
            <a href="#materias" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-600 py-2 hover:text-blue-600">Materias</a>
            <a href="#nosotros" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-600 py-2 hover:text-blue-600">Por qué elegirnos</a>
            <div className="flex gap-3 pt-2">
              <Link to="/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">Iniciar Sesión</Button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">Registrarse</Button>
              </Link>
            </div>
          </div>
        }
      </header>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        {/* Decoración de fondo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:py-28 py-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Texto izquierda */}
            <div className="space-y-7">
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 px-3 py-1 text-xs font-medium hidden">
                🎓 Bachillerato con validez oficial SEP
              </Badge>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
                Tu bachillerato,<br />
                <span className="text-blue-400">a tu propio</span>{" "}
                <span className="text-amber-400">ritmo!</span>
              </h1>

              <p className="text-slate-300 text-lg leading-relaxed max-w-lg">Plataforma educativa oficial. Estudia en línea con reconocimiento SEP y acompañamiento docente real.

              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register">
                  <Button className="h-12 px-8 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl gap-2 shadow-lg shadow-blue-500/30 transition-all hover:shadow-blue-400/40">
                    Comenzar gratis <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="h-12 px-8 border-slate-600 text-slate-200 hover:bg-slate-800 rounded-xl transition-all hidden">
                    Ya tengo cuenta
                  </Button>
                </Link>
              </div>

              <p className="text-xs text-slate-500">✓ En línea · ✓ Acceso inmediato 24/7 · ✓ Soporte académico incluido

              </p>
            </div>

            {/* Mockup derecha */}
            <div className="hidden lg:flex justify-center items-center">
              <div className="relative">
                {/* Glow */}
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-3xl" />
                <div className="relative bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-2xl w-80 space-y-4">
                  {/* Top bar */}
                  <div className="flex items-center gap-2 border-b border-slate-700 pb-4">
                    <img src={LOGO_URL} alt="Logo" className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                    <div>
                      <p className="text-xs font-semibold text-white">Mi Progreso</p>
                      <p className="text-xs text-slate-400">Nivel 2 · Semestre activo</p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">Activo</span>
                    </div>
                  </div>
                  {/* Progreso materias */}
                  {[
                  { name: "Álgebra", pct: 82, color: "bg-blue-500" },
                  { name: "Literatura", pct: 65, color: "bg-purple-500" },
                  { name: "Física", pct: 45, color: "bg-amber-500" }].
                  map((s) =>
                  <div key={s.name} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>{s.name}</span>
                        <span>{s.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  )}
                  {/* Stats mini */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700">
                    <div className="text-center">
                      <p className="text-base font-bold text-amber-400">12🔥</p>
                      <p className="text-xs text-slate-400">Racha</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-blue-400">340</p>
                      <p className="text-xs text-slate-400">XP</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-green-400">3/6</p>
                      <p className="text-xs text-slate-400">Niveles</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="bg-slate-50 border-b border-slate-100 py-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((s) =>
            <div key={s.label} className="flex flex-col items-center text-center rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow px-1 py-1 bg-[hsl(var(--background))]">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">{s.label}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── VALIDEZ SEP ─── */}
      <section className="bg-white py-2">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-100 rounded-2xl px-8 text-center sm:text-left py-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg">Bachillerato con Reconocimiento Oficial</p>
              <p className="text-sm text-slate-500 mt-0.5">
                RVOE: <span className="font-semibold text-blue-600">28PBH0301U</span> · Secretaría de Educación de Tamaulipas
              </p>
            </div>
            <Badge className="sm:ml-auto bg-green-100 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1 flex-shrink-0">
              ✓ Validez oficial
            </Badge>
          </div>
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section id="como-funciona" className="bg-white py-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Proceso simple</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">¿Cómo funciona?</h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto">Tres pasos para comenzar tu bachillerato en línea con validez oficial.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Línea conectora (solo desktop) */}
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200 z-0" />
            {STEPS.map((step, i) =>
            <div key={i} className="relative z-10 flex flex-col items-center text-center rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-[hsl(var(--input))] px-8 py-2">
                <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mb-5 shadow-lg`}>
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <span className="text-4xl font-black absolute top-4 right-6 select-none text-[hsl(var(--foreground))]">{step.num}</span>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── MATERIAS ─── */}
      <section id="materias" className="bg-slate-50 py-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Plan de estudios</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Materias del bachillerato</h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto">Contenido académico actualizado, estructurado en 6 semestres con evaluaciones oficiales.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {SUBJECTS.map((subject) =>
            <div
              key={subject.name}
              className={`flex flex-col items-center text-center rounded-2xl border px-5 py-3 ${subject.color} bg-white hover:shadow-md transition-all hover:-translate-y-1`}>
              
                <div className={`w-12 h-12 ${subject.color} rounded-xl flex items-center justify-center mb-3`}>
                  <subject.icon className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">{subject.name}</p>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">Y muchas materias más a lo largo de los 6 niveles del plan de estudios oficial.</p>
        </div>
      </section>

      {/* ─── POR QUÉ ELEGIRNOS ─── */}
      <section id="nosotros" className="bg-white py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Ventajas</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">¿Por qué elegirnos?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {WHY_US.map((item, i) =>
            <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 hover:shadow-md transition-all hover:-translate-y-1 px-8 py-6">
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-5`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-center py-1">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold">¿Listo para comenzar?</h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            Únete a cientos de estudiantes que ya obtienen su bachillerato con validez oficial SEP desde cualquier lugar de Tamaulipas.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/register">
              <Button className="h-12 px-10 bg-white text-blue-600 hover:bg-blue-50 font-bold rounded-xl shadow-lg transition-all">
                Crear mi cuenta ahora
              </Button>
            </Link>
            <Link to="/login">
              

              
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">

            {/* Marca */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center gap-3">
                <img src="https://media.base44.com/images/public/69a88a8bf5baf0edfc4ac0c5/471edcf30_logo_actualizado_-_Copy.jpg" alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 border-slate-700" loading="lazy" />
                <div>
                  <p className="font-bold text-white text-sm leading-tight">Preparatoria</p>
                  <p className="font-bold text-white text-sm leading-tight">Montes de Oca</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                Institución educativa con más de 15 años formando bachilleres en Tamaulipas con modalidad flexible y reconocimiento oficial SEP.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href="https://www.facebook.com/profile.php?id=61563803096106"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-slate-800 hover:bg-blue-600 border border-slate-700 rounded-lg flex items-center justify-center transition-colors">
                  
                  <Facebook className="w-4 h-4 text-slate-300" />
                </a>
              </div>
            </div>

            {/* Plataforma */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wide">Plataforma</h4>
              <div className="space-y-2.5 text-sm">
                <div><Link to="/register" className="hover:text-white transition-colors">Crear cuenta</Link></div>
                <div><Link to="/login" className="hover:text-white transition-colors">Iniciar sesión</Link></div>
                <div><a href="#como-funciona" className="hover:text-white transition-colors">¿Cómo funciona?</a></div>
                <div><a href="#materias" className="hover:text-white transition-colors">Materias</a></div>
              </div>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wide">Legal</h4>
              <div className="space-y-2.5 text-sm">
                <div><Link to="/privacy-policy" className="hover:text-white transition-colors">Política de Privacidad</Link></div>
                <div><Link to="/terms" className="hover:text-white transition-colors">Términos de Servicio</Link></div>
                <div>
                  <span className="text-slate-500 text-xs">RVOE: </span>
                  <span className="text-slate-300 text-xs font-semibold">28PBH0301U</span>
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wide">Contacto</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <a href="mailto:preparatoriamontesdeoca@gmail.com" className="hover:text-white transition-colors break-all">
                    preparatoriamontesdeoca@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="space-y-1">
                    <a href="tel:+18999224365" className="hover:text-white transition-colors block">(899) 922 43 65</a>
                    <a href="tel:+18994549288" className="hover:text-white transition-colors block">(899) 454 92 88</a>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    Porfirio Díaz #535, Zona Centro<br />
                    C.P. 88500, Reynosa, Tamaulipas
                  </span>
                </div>
              </div>
            </div>

          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Preparatoria Montes de Oca · Todos los derechos reservados
            </p>
            <p className="text-xs text-slate-600">
              Reynosa, Tamaulipas, México · RVOE 28PBH0301U
            </p>
          </div>
        </div>
      </footer>

    </div>);

}