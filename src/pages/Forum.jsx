import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import LevelAccessGuard from "@/components/common/LevelAccessGuard";
import { hasPermission } from "@/lib/permissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, MessageCircle, ShieldOff } from "lucide-react";
import ThreadCard from "@/components/forum/ThreadCard";
import NewThreadForm from "@/components/forum/NewThreadForm";
import { useUserEvent } from "@/hooks/useUserEvent";

export default function Forum() {
  const [user, setUser] = useState(null);
  const [userLevel, setUserLevel] = useState(1);
  const [showNewThread, setShowNewThread] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("recent");
  const [penalty, setPenalty] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me();
      setUser(u);
      const [prog, penalties] = await Promise.all([
        base44.entities.UserProgress.filter({ user_email: u.email }),
        base44.entities.ForumPenalty.filter({ user_email: u.email }),
      ]);
      setUserLevel(prog?.[0]?.current_level || 1);
      const p = penalties?.[0];
      if (p?.banned_until && new Date(p.banned_until) > new Date()) {
        setPenalty(p);
      }
    };
    load();
  }, []);

  const { dispatchUserEvent } = useUserEvent(user?.email);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["forumThreads"],
    queryFn: () => base44.entities.ForumThread.list("-last_activity_at"),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async ({ title, content, level_required }) => {
      return base44.entities.ForumThread.create({
        title,
        content,
        author_email: user.email,
        author_name: user.full_name,
        author_role: user.role === "admin" ? "admin" : user.role === "teacher" ? "teacher" : "student",
        level_required,
        status: "open",
        views_count: 0,
        replies_count: 0,
        last_activity_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumThreads"] });
      setShowNewThread(false);
      dispatchUserEvent("forum_thread_created").catch(() => {});
    },
  });

  const isPrivileged = user?.role === 'admin' || user?.role === 'docente';

  const filtered = threads
    .filter(t => isPrivileged || (t.level_required || 1) <= userLevel)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.title?.toLowerCase().includes(q) || t.content?.toLowerCase().includes(q);
    })
    .filter(t => {
      if (filter === "unanswered") return (t.replies_count || 0) === 0;
      if (filter === "resolved") return t.status === "resolved";
      return true;
    });

  const forumContent = (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-blue-600" />
              Foro de la Comunidad
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Pregunta, responde y aprende con tus compañeros</p>
          </div>
          {!showNewThread && !penalty && (
            <Button onClick={() => setShowNewThread(true)} className="self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo hilo
            </Button>
          )}
        </div>

        {penalty && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
            <ShieldOff className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Acceso al foro suspendido temporalmente</p>
              <p className="text-sm text-red-600 mt-1">
                No puedes publicar hasta el <strong>{new Date(penalty.banned_until).toLocaleDateString('es-MX', { dateStyle: 'long' })}</strong>.
              </p>
              <p className="text-xs text-red-500 mt-1">Razón: {penalty.last_incident_reason}</p>
            </div>
          </div>
        )}

        {showNewThread && !penalty && (
          <NewThreadForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowNewThread(false)}
            userLevel={userLevel}
            isSubmitting={createMutation.isPending}
            userEmail={user?.email}
          />
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar en el foro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="recent">Recientes</TabsTrigger>
              <TabsTrigger value="unanswered">Sin respuesta</TabsTrigger>
              <TabsTrigger value="resolved">Resueltos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay hilos aquí todavía</p>
            <p className="text-sm mt-1">¡Sé el primero en publicar!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(thread => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Docentes tienen acceso directo al foro sin LevelAccessGuard (no son alumnos)
  if (hasPermission(user, 'forum.access') && user?.role !== 'user') {
    return forumContent;
  }

  return <LevelAccessGuard>{forumContent}</LevelAccessGuard>;
}