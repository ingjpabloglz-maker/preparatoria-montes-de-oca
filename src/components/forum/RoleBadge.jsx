import { Badge } from "@/components/ui/badge";

const ROLE_CONFIG = {
  admin: { label: "Admin", className: "bg-red-100 text-red-700 border-red-200" },
  teacher: { label: "Profesor", className: "bg-blue-100 text-blue-700 border-blue-200" },
  student: { label: "Estudiante", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function RoleBadge({ role }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.student;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}