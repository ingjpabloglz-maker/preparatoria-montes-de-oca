import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Lock } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import RoleBadge from "@/components/forum/RoleBadge";
import ThreadStatusBadge from "@/components/forum/ThreadStatusBadge";
import PostCard from "@/components/forum/PostCard";
import NewPostForm from "@/components/forum/NewPostForm";
import { useUserEvent } from "@/hooks/useUserEvent";

export default function ForumThread() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    load();
  }, []);

  const { dispatchUserEvent } = useUserEvent(user?.email);

  // Incrementar vistas
  useEffect(() => {
    if (!id) return;
    base44.entities.ForumThread.filter({ id }).then((results) => {
      const t = results?.[0];
      if (t) base44.entities.ForumThread.update(id, { views_count: (t.views_count || 0) + 1 });
    }).catch(() => {});
  }, [id]);

  const { data: thread, isLoading: loadingThread } = useQuery({
    queryKey: ["forumThread", id],
    queryFn: async () => {
      const results = await base44.entities.ForumThread.filter({ id });
      return results?.[0] || null;
    },
    enabled: !!id,
  });

  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["forumPosts", id],
    queryFn: () => base44.entities.ForumPost.filter({ thread_id: id }, "created_date"),
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: async (content) => {
      await base44.entities.ForumPost.create({
        thread_id: id,
        content,
        author_email: user.email,
        author_name: user.full_name,
        author_role: user.role === "admin" ? "admin" : user.role === "docente" ? "docente" : "student",
        is_solution: false,
      });
      await base44.entities.ForumThread.update(id, {
        replies_count: (thread?.replies_count || 0) + 1,
        last_activity_at: new Date().toISOString(),
      });
      if (thread?.author_email && thread.author_email !== user.email) {
        base44.entities.NotificationLog.create({
          user_email: thread.author_email,
          template_id: "forum_reply",
          sent_date: new Date().toISOString(),
          status: "sent",
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts", id] });
      queryClient.invalidateQueries({ queryKey: ["forumThread", id] });
      dispatchUserEvent("forum_post_created").catch(() => {});
    },
  });

  const solutionMutation = useMutation({
    mutationFn: async (postId) => {
      const prevSolution = posts.find(p => p.is_solution);
      if (prevSolution) {
        await base44.entities.ForumPost.update(prevSolution.id, { is_solution: false });
      }
      const solutionPost = posts.find(p => p.id === postId);
      await base44.entities.ForumPost.update(postId, { is_solution: true });
      await base44.entities.ForumThread.update(id, { status: "resolved" });
      if (solutionPost?.author_email && solutionPost.author_email !== user.email) {
        base44.entities.NotificationLog.create({
          user_email: solutionPost.author_email,
          template_id: "forum_solution",
          sent_date: new Date().toISOString(),
          status: "sent",
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts", id] });
      queryClient.invalidateQueries({ queryKey: ["forumThread", id] });
      dispatchUserEvent("forum_solution_earned").catch(() => {});
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => base44.entities.ForumThread.update(id, { status: "closed" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forumThread", id] }),
  });

  const reopenMutation = useMutation({
    mutationFn: () => base44.entities.ForumThread.update(id, { status: "open" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forumThread", id] }),
  });

  const canManage = hasPermission(user, 'forum.moderate');
  const isClosed = thread?.status === "closed";

  if (loadingThread) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Hilo no encontrado.</p>
        <Link to="/Forum"><Button variant="outline">Volver al foro</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link to="/Forum" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
          Volver al foro
        </Link>

        {/* Hilo principal */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <ThreadStatusBadge status={thread.status} />
              <span className="text-xs text-gray-400">Nivel {thread.level_required}+</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-3">{thread.title}</h1>
            <div className="prose prose-sm max-w-none text-gray-700 mb-4">
              <ReactMarkdown>{thread.content}</ReactMarkdown>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{thread.author_name || thread.author_email}</span>
                <RoleBadge role={thread.author_role} />
                <span>{formatDistanceToNow(new Date(thread.created_date), { addSuffix: true, locale: es })}</span>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  {!isClosed && thread.status !== "resolved" && (
                    <Button variant="outline" size="sm" onClick={() => closeMutation.mutate()} className="text-xs text-gray-600">
                      <Lock className="w-3.5 h-3.5 mr-1" />
                      Cerrar hilo
                    </Button>
                  )}
                  {isClosed && (
                    <Button variant="outline" size="sm" onClick={() => reopenMutation.mutate()} className="text-xs text-green-600 border-green-300">
                      Reabrir
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Respuestas */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {posts.length} {posts.length === 1 ? "Respuesta" : "Respuestas"}
          </h2>
          {loadingPosts ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Todavía no hay respuestas. ¡Sé el primero!</p>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  canMarkSolution={canManage}
                  onMarkSolution={(postId) => solutionMutation.mutate(postId)}
                  threadStatus={thread.status}
                  currentUserEmail={user?.email}
                />
              ))}
            </div>
          )}
        </div>

        {/* Formulario de respuesta */}
        {!isClosed ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Tu respuesta</h3>
              <NewPostForm
                onSubmit={(content) => replyMutation.mutate(content)}
                isSubmitting={replyMutation.isPending}
                userEmail={user?.email}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            Este hilo está cerrado y no acepta más respuestas.
          </div>
        )}
      </div>
    </div>
  );
}