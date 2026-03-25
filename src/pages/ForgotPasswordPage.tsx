import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { AgoraIcon } from "@/components/AgoraIcon";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        <Link to="/login" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para login
        </Link>
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <AgoraIcon size={40} className="shrink-0 rounded-xl" />
            <span className="font-display text-2xl font-bold">Recuperar Senha</span>
          </div>
          {sent ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Link de recuperação enviado para <strong className="text-foreground">{email}</strong>.</p>
              <p className="mt-2 text-sm text-muted-foreground">Verifique sua caixa de entrada.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Link de Recuperação"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
