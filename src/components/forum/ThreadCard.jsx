import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Eye, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import RoleBadge from "./RoleBadge";
import ThreadStatusBadge from "./ThreadStatusBadge";

export default function ThreadCard({ thread }) {
  const timeAgo = thread.last_activity_at
    ? formatDistanceToNow(new Date(thread.last_activity_at), { addSuffix: true, locale: es })
    : formatDistanceToNow(new Date(thread.created_date), { addSuffix: true, locale: es });

  return (
    <Link to={`/Forum/thread/${thread.id}`}>
      <Card className="border hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <ThreadStatusBadge status={thread.status} />
                <span className="text-xs text-gray-400">Nivel {thread.level_required}+</span>
              </div>
              <h3 className="font-semibold text-gray-900 truncate">{thread.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2 mt-1">{thread.content}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{thread.author_name || thread.author_email}</span>
              <RoleBadge role={thread.author_role} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                {thread.replies_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {thread.views_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {timeAgo}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}