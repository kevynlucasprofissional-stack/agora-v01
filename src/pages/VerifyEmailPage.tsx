import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";
import { AgoraIcon } from "@/components/AgoraIcon";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });
    setLoading(false);

    if (error) {
      if (error.message.includes("expired")) {
        toast.error("Código expirado. Solicite um novo.");
      } else if (error.message.includes("invalid") || error.message.includes("Invalid")) {
        toast.error("Código inválido. Verifique e tente novamente.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    setVerified(true);
    toast.success("E-mail verificado com sucesso!");
    setTimeout(() => navigate("/app"), 1500);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) {
      toast.error("Erro ao reenviar. Tente novamente.");
      setResendCooldown(0);
    } else {
      toast.success("Novo código enviado!");
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">E-mail não informado.</p>
          <Link to="/login" className="text-primary hover:underline text-sm">Voltar ao login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/3 left-1/3 h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md px-6">
        <Link to="/login" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Link>

        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <AgoraIcon size={40} className="shrink-0 rounded-xl" />
            <span className="font-display text-2xl font-bold">Ágora</span>
          </div>

          {verified ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium">E-mail verificado!</p>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-center">Verifique seu e-mail</h2>
                <p className="text-sm text-muted-foreground text-center">
                  Enviamos um código de 6 dígitos para{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <div className="flex justify-center mb-6">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                variant="hero"
                className="w-full mb-4"
                onClick={handleVerify}
                disabled={otp.length !== 6 || loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar
              </Button>

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Reenviar em ${resendCooldown}s`
                    : "Reenviar código"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
