import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CheatWarningMessage from "./CheatWarningMessage";

export default function NewPostForm({ onSubmit, isSubmitting, disabled, userEmail }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [cheatWarning, setCheatWarning] = useState(null);
  const [moderating, setModerating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (content.trim().length < 10) {
      setError("La respuesta debe tener al menos 10 caracteres.");
      return;
    }
    setError("");
    setCheatWarning(null);
    setModerating(true);

    const res = await base44.functions.invoke("moderateForumContent", {
      content: content.trim(),
      user_email: userEmail,
    });

    setModerating(false);
    const result = res.data;

    if (result?.is_cheating && result?.confidence >= 0.7) {
      setCheatWarning(result.reason);
      return;
    }

    onSubmit(content.trim());
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Escribe tu respuesta... (soporta Markdown)"
        value={content}
        onChange={(e) => { setContent(e.target.value); setCheatWarning(null); }}
        rows={4}
        disabled={disabled}
        className="resize-none"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {cheatWarning && <CheatWarningMessage reason={cheatWarning} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || disabled || moderating}>
          {moderating ? "Verificando..." : isSubmitting ? "Publicando..." : "Responder"}
        </Button>
      </div>
    </form>
  );
}