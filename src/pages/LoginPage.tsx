import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"login" | "signup">(searchParams.get("tab") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/app");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate("/app");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/3 left-1/3 h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md px-6">
        <Link to="/" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold">Ágora</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl bg-muted p-1 mb-8">
            <button onClick={() => setTab("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Entrar
            </button>
            <button onClick={() => setTab("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Criar Conta
            </button>
          </div>

          <form onSubmit={tab === "login" ? handleLogin : handleSignup} className="space-y-4">
            {tab === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {tab === "login" && (
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
                )}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? "Carregando..." : tab === "login" ? "Entrar" : "Criar Conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
