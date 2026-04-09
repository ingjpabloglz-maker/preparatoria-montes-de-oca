import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import RoleBadge from "./RoleBadge";
import ReportButton from "./ReportButton";
import ReactMarkdown from "react-markdown";

export default function PostCard({ post, canMarkSolution, onMarkSolution, canDelete, onDelete, canPenalize, onPenalize, threadStatus, currentUserEmail }) {
  const timeAgo = formatDistanceToNow(new Date(post.created_date), { addSuffix: true, locale: es });

  if (post.is_deleted) {
    return (
      <Card className="border border-dashed border-gray-300 bg-gray-50 opacity-60">
        <CardContent className="p-4">
          <p className="text-xs text-gray-400 italic">Respuesta eliminada por moderador — {post.deleted_by_name || post.deleted_by}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border transition-all ${post.is_solution ? "border-green-400 bg-green-50 shadow-md" : "border-gray-200"}`}>
      <CardContent className="p-4">
        {post.is_solution && (
          <div className="flex items-center gap-2 text-green-700 text-sm font-semibold mb-3 pb-3 border-b border-green-200">
            <CheckCircle2 className="w-4 h-4" />
            Respuesta solución
          </div>
        )}
        <div className="prose prose-sm max-w-none text-gray-800">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{post.author_name || post.author_email}</span>
            <RoleBadge role={post.author_role} />
            <span>{timeAgo}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {currentUserEmail && post.author_email !== currentUserEmail && (
              <ReportButton
                postId={post.id}
                reportedBy={currentUserEmail}
              />
            )}
            {canMarkSolution && !post.is_solution && threadStatus !== "closed" && (
              <Button
                variant="outline" size="sm"
                onClick={() => onMarkSolution(post.id)}
                className="text-green-600 border-green-300 hover:bg-green-50 text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Marcar solución
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { if (window.confirm('¿Eliminar esta respuesta?')) onDelete(post.id); }}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Eliminar
              </Button>
            )}
            {canPenalize && post.author_email !== currentUserEmail && (
              <Button
                variant="ghost" size="sm"
                onClick={() => onPenalize(post.author_email, post.author_name)}
                className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 text-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                Penalizar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}