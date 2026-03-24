import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import CheatWarningMessage from "./CheatWarningMessage";

export default function NewThreadForm({ onSubmit, onCancel, userLevel, isSubmitting, userEmail }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [levelRequired, setLevelRequired] = useState(String(userLevel || 1));
  const [error, setError] = useState("");
  const [cheatWarning, setCheatWarning] = useState(null);
  const [moderating, setModerating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (title.trim().length < 10) {
      setError("El título debe tener al menos 10 caracteres.");
      return;
    }
    if (content.trim().length < 10) {
      setError("El contenido debe tener al menos 10 caracteres.");
      return;
    }
    setError("");
    setCheatWarning(null);
    setModerating(true);

    const fullText = `${title.trim()} ${content.trim()}`;
    const res = await base44.functions.invoke("moderateForumContent", {
      content: fullText,
      user_email: userEmail,
    });

    setModerating(false);
    const result = res.data;

    if (result?.is_cheating && result?.confidence >= 0.7) {
      setCheatWarning(result.reason);
      return;
    }

    onSubmit({ title: title.trim(), content: content.trim(), level_required: parseInt(levelRequired) });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Nuevo hilo</CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="¿Cuál es tu pregunta o tema?"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setCheatWarning(null); }}
              maxLength={120}
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">{title.length}/120</p>
          </div>
          <div>
            <Label htmlFor="content">Descripción</Label>
            <Textarea
              id="content"
              placeholder="Explica con detalle tu pregunta o tema... (soporta Markdown)"
              value={content}
              onChange={(e) => { setContent(e.target.value); setCheatWarning(null); }}
              rows={5}
              className="mt-1 resize-none"
            />
          </div>
          <div>
            <Label>Nivel mínimo para ver este hilo</Label>
            <Select value={levelRequired} onValueChange={setLevelRequired}>
              <SelectTrigger className="mt-1 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6].filter(l => l <= (userLevel || 6)).map(l => (
                  <SelectItem key={l} value={String(l)}>Nivel {l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {cheatWarning && <CheatWarningMessage reason={cheatWarning} />}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || moderating}>
              {moderating ? "Verificando..." : isSubmitting ? "Publicando..." : "Publicar hilo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}