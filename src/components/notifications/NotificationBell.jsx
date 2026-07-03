import React, { useState, useEffect, useRef } from 'react';
import { Bell, Info, AlertTriangle, Megaphone, CheckCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const TYPE_ICONS = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
  alert: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
  announcement: { icon: Megaphone, color: 'text-purple-500', bg: 'bg-purple-50' },
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  // Cargar notificaciones no leídas
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const items = await base44.entities.UserNotification.filter(
          { user_email: user.email },
          '-created_date',
          20
        );
        if (cancelled) return;
        setNotifications(items || []);
        setUnreadCount((items || []).filter(n => !n.is_read).length);
      } catch (_) {}
      if (!cancelled) setLoading(false);
    };

    fetchNotifications();

    // Suscripción realtime
    const unsubscribe = base44.entities.UserNotification.subscribe((event) => {
      if (event.type === 'create') {
        setNotifications(prev => [event.data, ...prev].slice(0, 30));
        if (!event.data.is_read) setUnreadCount(c => c + 1);
      } else if (event.type === 'update') {
        setNotifications(prev => prev.map(n => n.id === event.data.id ? event.data : n));
        setUnreadCount(c => Math.max(0, c - 1));
      } else if (event.type === 'delete') {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [user?.email]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markAsRead = async (notification) => {
    if (notification.is_read) {
      if (notification.link) window.location.href = notification.link;
      return;
    }
    try {
      await base44.entities.UserNotification.update(notification.id, { is_read: true });
      if (notification.link) window.location.href = notification.link;
    } catch (_) {}
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    try {
      await base44.entities.UserNotification.bulkUpdate(
        unread.map(n => ({ id: n.id, is_read: true }))
      );
    } catch (_) {}
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors",
                      !n.is_read && "bg-blue-50/40"
                    )}
                  >
                    <div className={cn("flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center", cfg.bg)}>
                      <Icon className={cn("w-4 h-4", cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug", !n.is_read ? "font-semibold text-gray-900" : "font-medium text-gray-600")}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.created_date), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}