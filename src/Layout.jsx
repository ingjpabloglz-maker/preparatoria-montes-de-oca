import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  GraduationCap, 
  User, 
  LogOut, 
  Settings,
  LayoutDashboard,
  ChevronDown,
  Menu,
  X,
  Users,
  FileText,
  BarChart2,
  MessageCircle,
  Shield,
  ClipboardCheck
} from "lucide-react";
import { hasPermission } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import GamificationHUD from "@/components/gamification/GamificationHUD";
import AchievementToast from "@/components/gamification/AchievementToast";
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isDocente = user?.role === 'docente';
  const isAdminPage = ['AdminDashboard', 'ManageFolios', 'ManageSubjects', 'StudentDetail'].includes(currentPageName);
  const isImmersivePage = ['Lesson'].includes(currentPageName);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Achievement Toast monitor (solo estudiantes) */}
      {user && user.role !== 'admin' && user.role !== 'docente' && (
        <AchievementToast userEmail={user.email} />
      )}
      {/* Header */}
      <header className={`bg-white border-b sticky top-0 z-50 ${isImmersivePage ? 'hidden' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link 
              to={isAdmin ? createPageUrl('AdminDashboard') : isDocente ? '/TeacherDashboard' : createPageUrl('Dashboard')} 
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900 hidden sm:block">
                Preparatoria
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {!isAdmin && !isDocente && (
                <>
                  <Link to={createPageUrl('Dashboard')}>
                    <Button 
                      variant={currentPageName === 'Dashboard' ? 'secondary' : 'ghost'}
                      size="sm"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Mi Progreso
                    </Button>
                  </Link>
                  <Link to="/Rewards">
                    <Button
                      variant={currentPageName === 'Rewards' ? 'secondary' : 'ghost'}
                      size="sm"
                    >
                      <span className="mr-1.5">🏆</span>
                      Recompensas
                    </Button>
                  </Link>
                  <Link to="/Forum">
                    <Button
                      variant={currentPageName === 'Forum' || currentPageName === 'ForumThread' ? 'secondary' : 'ghost'}
                      size="sm"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Foro
                    </Button>
                  </Link>
                </>
              )}

              {/* Nav docente */}
              {isDocente && (
                <>
                  <Link to="/TeacherDashboard">
                    <Button
                      variant={currentPageName === 'TeacherDashboard' ? 'secondary' : 'ghost'}
                      size="sm"
                    >
                      <ClipboardCheck className="w-4 h-4 mr-2" />
                      Panel Docente
                    </Button>
                  </Link>
                  <Link to="/Forum">
                    <Button
                      variant={currentPageName === 'Forum' || currentPageName === 'ForumThread' ? 'secondary' : 'ghost'}
                      size="sm"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Foro
                    </Button>
                  </Link>
                </>
              )}
              
              {isAdmin && (
                <>
                  <Link to={createPageUrl('AdminDashboard')}>
                    <Button 
                      variant={isAdminPage ? 'secondary' : 'ghost'}
                      size="sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Administración
                    </Button>
                  </Link>
                  <Link to={createPageUrl('ManageStudents')}>
                    <Button 
                      variant="ghost"
                      size="sm"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Gestión de Alumnos
                    </Button>
                  </Link>
                  <Link to={createPageUrl('ManageAdmins')}>
                    <Button 
                      variant="ghost"
                      size="sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Administradores
                    </Button>
                  </Link>
                  <Link to="/AuditDashboard">
                    <Button
                      variant={currentPageName === 'AuditDashboard' ? 'secondary' : 'ghost'}
                      size="sm"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Auditoría
                    </Button>
                  </Link>
                </>
              )}
            </nav>

            {/* Gamification HUD (solo estudiantes) */}
            {user && user.role !== 'admin' && user.role !== 'docente' && (
              <GamificationHUD userEmail={user.email} />
            )}

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="hidden sm:block max-w-[120px] truncate">
                        {user.full_name?.split(' ')[0] || 'Usuario'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="font-medium truncate">{user.full_name}</p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {user.role === 'admin' ? 'Administrador' : user.role === 'docente' ? 'Docente' : 'Estudiante'}
                      </Badge>
                    </div>
                    <DropdownMenuItem
                      onClick={() => window.location.href = createPageUrl('Profile')}
                      className="cursor-pointer"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Editar Perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => base44.auth.logout()}
                      className="text-red-600 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Mobile Menu Button */}
              <Button 
                variant="ghost" 
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white p-4 space-y-2">
            {!isAdmin && (
              <Link 
                to={createPageUrl('Dashboard')}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="ghost" className="w-full justify-start">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Mi Progreso
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link 
                to={createPageUrl('AdminDashboard')}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="ghost" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Administración
                </Button>
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <main>
        {children}
      </main>
    </div>
  );
}