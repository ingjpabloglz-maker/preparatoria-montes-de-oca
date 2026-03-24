import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, MessageCircle } from "lucide-react";

const STATUS_CONFIG = {
  open: { label: "Abierto", icon: MessageCircle, className: "bg-green-100 text-green-700 border-green-200" },
  resolved: { label: "Resuelto", icon: CheckCircle2, className: "bg-blue-100 text-blue-700 border-blue-200" },
  closed: { label: "Cerrado", icon: Lock, className: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default function ThreadStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-xs flex items-center gap-1 ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}