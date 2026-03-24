import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, MessageCircle } from "lucide-react";
import ThreadCard from "@/components/forum/ThreadCard";
import NewThreadForm from "@/components/forum/NewThreadForm";
import { useUserEvent } from "@/hooks/useUserEvent";
import { useEffect as _ue } from "react";

export default function Forum() {
  const [user, setUser] = useState(null);
  const [userProgress, setUserProgress] = useState(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("recent");
  const queryClient = useQueryClient();
  const { fireEvent } = useUserEvent();

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me();
      setUser(u);
      const prog = await base44.entities.UserProgress.filter({ user_email: u.email });
      setUserProgress(prog?.[0] || null);
    };
    load();
  }, []);

  const userLevel = userProgress?.current_level || 1;

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["forumThreads"],
    queryFn: () => base44.entities.ForumThread.list("-last_activity_at"),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async ({ title, content, level_required }) => {
      const now = new Date().toISOString();
      return base44.entities.ForumThread.create({
        title,
        content,
        author_email: user.email,
        author_name: user.full_name,
        author_role: user.role === "admin" ? "admin" : (user.role === "teacher" ? "teacher" : "student"),
        level_required,
        status: "open",
        views_count: 0,
        replies_count: 0,
        last_activity_at: now,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumThreads"] });
      setShowNewThread(false);
      fireEvent("forum_thread_created");
    },
  });

  // Filtrar por nivel y búsqueda
  const filtered = threads
    .filter(t => t.level_required <= userLevel)
    .filter(t => {
      if (!search) return true;
      return (
        t.title?.toLowerCase().includes(search.toLowerCase()) ||
        t.content?.toLowerCase().includes(search.toLowerCase())
      );
    })
    .filter(t => {
      if (filter === "unanswered") return (t.replies_count || 0) === 0;
      if (filter === "resolved") return t.status === "resolved";
      return true; // recent: all
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-blue-600" />
              Foro de la Comunidad
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Pregunta, responde y aprende con tus compañeros</p>
          </div>
          {!showNewThread && (
            <Button onClick={() => setShowNewThread(true)} className="self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo hilo
            </Button>
          )}
        </div>

        {/* New Thread Form */}
        {showNewThread && (
          <NewThreadForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowNewThread(false)}
            userLevel={userLevel}
            isSubmitting={createMutation.isPending}
          />
        )}

        {/* Filters */}
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

        {/* Thread List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
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
}