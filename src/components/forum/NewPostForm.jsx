import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function NewPostForm({ onSubmit, isSubmitting, disabled }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim().length < 10) {
      setError("La respuesta debe tener al menos 10 caracteres.");
      return;
    }
    setError("");
    onSubmit(content.trim());
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Escribe tu respuesta... (soporta Markdown)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        disabled={disabled}
        className="resize-none"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || disabled}>
          {isSubmitting ? "Publicando..." : "Responder"}
        </Button>
      </div>
    </form>
  );
}