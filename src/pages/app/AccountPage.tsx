import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Check, Crown } from "lucide-react";
import { PLAN_FEATURES } from "@/types/database";

export default function AccountPage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { planCode } = usePlanAccess();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [company, setCompany] = useState(profile?.company_name ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      company_name: company,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar.");
    else {
      toast.success("Perfil atualizado!");
      refreshProfile();
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Gestão da Conta</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu perfil e assinatura.</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="section-label">Perfil</h2>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-card" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={profile?.email ?? ""} disabled className="bg-card opacity-60" />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" className="bg-card" />
          </div>
        </div>
        <Button variant="hero" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      {/* Plan */}
      <div className="glass-card p-6">
        <h2 className="section-label mb-4">Plano Atual</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-display text-xl font-bold capitalize">{planCode}</p>
            <p className="text-xs text-muted-foreground">{PLAN_FEATURES[planCode].badge}</p>
          </div>
        </div>
        <ul className="space-y-2 mb-6">
          {PLAN_FEATURES[planCode].features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-success" /> {f}
            </li>
          ))}
        </ul>
        {planCode !== "enterprise" && (
          <Button variant="outline" asChild>
            <Link to="/pricing">Fazer Upgrade</Link>
          </Button>
        )}
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border-destructive/30">
        <h2 className="section-label text-destructive mb-4">Zona de Perigo</h2>
        <Button variant="destructive" onClick={signOut}>Sair da Conta</Button>
      </div>
    </div>
  );
}
