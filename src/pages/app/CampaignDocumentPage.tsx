import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Download, FileText, Send, Loader2, Sparkles, FileDown, Palette,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/streamChat";

// Fallback improvements if analysis has no AI data
const FALLBACK_IMPROVEMENTS = [
  "Reescrever proposta de valor para comunicar em 3 segundos",
  "Substituir métricas de vaidade por KPIs reais (CAC Payback Period)",
  "Reduzir fricção no funil de conversão (checkout de 4 para 2 passos)",
  "Alinhar tom de voz com a geração do público-alvo",
  "Aplicar aversão à perda no criativo principal",
  "Migrar budget para canais com maior afinidade geracional",
  "Implementar prova social quantificável na dobra 1",
  "Adicionar garantia visível e depoimentos",
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function CampaignDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisRequest | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1: Review improvements
  const [selectedImprovements, setSelectedImprovements] = useState<string[]>(FALLBACK_IMPROVEMENTS);
  const [step, setStep] = useState<"review" | "generating" | "document">("review");

  // Document
  const [document, setDocument] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savedOutputId, setSavedOutputId] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<string>("");

  // Load analysis + check for existing campaign
  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      const [analysisRes, outputRes] = await Promise.all([
        supabase.from("analysis_requests").select("*").eq("id", id).single(),
        supabase
          .from("generated_outputs")
          .select("*")
          .eq("analysis_request_id", id)
          .eq("output_type", "campaign")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const analysisData = analysisRes.data;
      setAnalysis(analysisData);

      // Load real improvements from analysis if available
      if (analysisData?.normalized_payload) {
        const payload = analysisData.normalized_payload as Record<string, any>;
        const realImprovements = payload?.improvements as string[] | undefined;
        if (realImprovements && realImprovements.length > 0) {
          setSelectedImprovements(realImprovements);
        }
      }

      // If a campaign was previously saved, restore it
      if (outputRes.data?.content_markdown) {
        setDocument(outputRes.data.content_markdown);
        documentRef.current = outputRes.data.content_markdown;
        setSavedOutputId(outputRes.data.id);
        setStep("document");
      }

      setLoading(false);
    };
    loadData();
  }, [id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleToggleImprovement = (imp: string) => {
    setSelectedImprovements((prev) =>
      prev.includes(imp) ? prev.filter((i) => i !== imp) : [...prev, imp]
    );
  };

  // Save or update campaign in the database
  const saveCampaignToDb = useCallback(async (markdown: string) => {
    if (!id) return;
    try {
      if (savedOutputId) {
        // Update existing
        await supabase
          .from("generated_outputs")
          .update({ content_markdown: markdown })
          .eq("id", savedOutputId);
      } else {
        // Insert new
        const { data } = await supabase
          .from("generated_outputs")
          .insert({
            analysis_request_id: id,
            output_type: "campaign",
            title: "Campanha Melhorada",
            content_markdown: markdown,
          })
          .select("id")
          .single();
        if (data) setSavedOutputId(data.id);
      }
    } catch (e) {
      console.error("Error saving campaign:", e);
    }
  }, [id, savedOutputId]);

  const handleGenerate = useCallback(async () => {
    if (!analysis || selectedImprovements.length === 0) {
      toast.error("Selecione pelo menos uma melhoria.");
      return;
    }
    setStep("generating");
    setGenerating(true);
    setDocument("");
    documentRef.current = "";

    try {
      await streamChat({
        messages: [],
        functionName: "generate-campaign",
        extraBody: {
          analysisData: {
            title: analysis.title,
            raw_prompt: analysis.raw_prompt,
            score_overall: analysis.score_overall,
            score_sociobehavioral: analysis.score_sociobehavioral,
            score_offer: analysis.score_offer,
            score_performance: analysis.score_performance,
            industry: analysis.industry,
            primary_channel: analysis.primary_channel,
            declared_target_audience: analysis.declared_target_audience,
            region: analysis.region,
          },
          improvements: selectedImprovements,
        },
        onDelta: (chunk) => {
          documentRef.current += chunk;
          setDocument(documentRef.current);
        },
        onDone: async () => {
          setGenerating(false);
          setStep("document");
          // Save the generated campaign to the database
          await saveCampaignToDb(documentRef.current);
          toast.success("Campanha salva automaticamente!");
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar campanha.");
      setGenerating(false);
      setStep("review");
    }
  }, [analysis, selectedImprovements, saveCampaignToDb]);

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    let assistantContent = "";

    try {
      await streamChat({
        messages: newMessages,
        functionName: "campaign-chat",
        extraBody: { currentDocument: documentRef.current },
        onDelta: (chunk) => {
          assistantContent += chunk;
          documentRef.current = assistantContent;
          setDocument(assistantContent);
        },
        onDone: async () => {
          setChatMessages((prev) => [...prev, { role: "assistant", content: "✅ Documento atualizado com sucesso!" }]);
          setChatLoading(false);
          // Save updated campaign to the database
          await saveCampaignToDb(documentRef.current);
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao editar documento.");
      setChatLoading(false);
    }
  }, [chatInput, chatMessages, chatLoading, saveCampaignToDb]);

  const handleDownloadMarkdown = () => {
    const blob = new Blob([document], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `campanha-${analysis?.title || "melhorada"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups para exportar."); return; }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Campanha - ${analysis?.title || "Melhorada"}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
          h1 { font-size: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
          h2 { font-size: 20px; margin-top: 32px; color: #333; }
          h3 { font-size: 16px; margin-top: 24px; }
          table { border-collapse: collapse; width: 100%; margin: 16px 0; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f5f5f5; }
          code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
          blockquote { border-left: 3px solid #ccc; margin: 16px 0; padding: 8px 16px; color: #666; }
          ul, ol { padding-left: 24px; }
          li { margin: 4px 0; }
        </style>
      </head><body id="content"></body></html>
    `);
    const html = document
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^- (.*$)/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
    printWindow.document.getElementById("content")!.innerHTML = html;
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleOpenCanva = () => {
    // Open Canva with pre-filled content context
    const campaignTitle = analysis?.title || "Campanha Melhorada";
    const canvaUrl = `https://www.canva.com/design?create&type=TAB7AVEOUWQ&text=${encodeURIComponent(campaignTitle)}`;
    window.open(canvaUrl, "_blank");
    toast.info("Abrindo o Canva. Use o conteúdo da campanha como referência para criar seus designs.");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  if (!analysis) return <div className="text-center py-20 text-muted-foreground">Análise não encontrada.</div>;

  // Step 1: Review improvements
  if (step === "review") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to={`/app/analysis/${id}/report`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao relatório
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Gerar Campanha Melhorada</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selecione as melhorias que deseja aplicar na nova versão da campanha.
          </p>
        </div>
        <div className="glass-card p-6 space-y-4">
          <h3 className="section-label">Apontamentos de Melhoria</h3>
          {selectedImprovements.map((imp) => (
            <label key={imp} className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={selectedImprovements.includes(imp)}
                onCheckedChange={() => handleToggleImprovement(imp)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">{imp}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="hero" onClick={handleGenerate} disabled={selectedImprovements.length === 0}>
            <Sparkles className="h-4 w-4 mr-2" /> Gerar Campanha ({selectedImprovements.length} melhorias)
          </Button>
        </div>
      </div>
    );
  }

  // Step 2 & 3: Generating / Document view
  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Document Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <Link to={`/app/analysis/${id}/report`} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <FileText className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Campanha Melhorada</h2>
              <p className="text-xs text-muted-foreground">{analysis.title || "Documento gerado por IA"}</p>
            </div>
          </div>
          {step === "document" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
                <Send className="h-4 w-4 mr-2" /> {showChat ? "Fechar Chat" : "Editar via Chat"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                <Download className="h-4 w-4 mr-2" /> Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenCanva}
                className="border-[hsl(var(--accent))] text-accent hover:bg-accent/10"
              >
                <Palette className="h-4 w-4 mr-2" /> Criar no Canva
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto py-6 pr-2">
          {generating && !document && (
            <div className="flex items-center justify-center h-40 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Gerando campanha melhorada...</span>
            </div>
          )}
          {document && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 md:p-8">
              <div className="prose prose-invert prose-sm max-w-none 
                prose-headings:font-display prose-headings:text-foreground
                prose-h1:text-xl prose-h1:border-b prose-h1:border-border/50 prose-h1:pb-3
                prose-h2:text-lg prose-h2:mt-8
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-li:text-muted-foreground
                prose-strong:text-foreground
                prose-th:text-foreground prose-td:text-muted-foreground
                prose-table:border-border prose-th:border-border prose-td:border-border
                prose-blockquote:border-primary/50 prose-blockquote:text-muted-foreground">
                <ReactMarkdown>{document}</ReactMarkdown>
              </div>
              {generating && (
                <div className="flex items-center gap-2 mt-4 text-muted-foreground text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" /> Gerando...
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && step === "document" && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-96 flex flex-col border-l border-border/50 pl-6 shrink-0"
        >
          <div className="pb-4 border-b border-border/50 shrink-0">
            <h3 className="font-semibold text-sm">Editor por Chat</h3>
            <p className="text-xs text-muted-foreground">Peça alterações e a IA reescreve o documento.</p>
          </div>

          <div className="flex-1 overflow-auto py-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">
                  Exemplos: "Mude o tom para mais informal", "Adicione uma seção sobre remarketing",
                  "Reescreva os CTAs com mais urgência"
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "glass-card"
                }`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="glass-card px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Editando documento...
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="shrink-0 flex gap-2 pt-4 border-t border-border/50">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Peça uma alteração..."
              className="bg-card text-sm"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
            />
            <Button variant="hero" size="icon" onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
