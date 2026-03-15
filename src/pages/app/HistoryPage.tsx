import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ChevronRight, MessageSquare, BarChart3, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Conversation = {
  id: string;
  title: string | null;
  context_type: string;
  analysis_request_id: string | null;
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
};

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [analysesRes, convsRes] = await Promise.all([
        supabase
          .from("analysis_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("conversations")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);

      setAnalyses(analysesRes.data ?? []);
      const convs = convsRes.data ?? [];

      // Fetch last message and count for each conversation
      if (convs.length > 0) {
        const convsWithMeta = await Promise.all(
          convs.map(async (c) => {
            const { data: msgs } = await supabase
              .from("chat_messages")
              .select("content")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1);

            const { count } = await supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", c.id);

            return {
              ...c,
              last_message: msgs?.[0]?.content || null,
              message_count: count || 0,
            } as Conversation;
          })
        );
        setConversations(convsWithMeta);
      }

      setLoading(false);
    };
    fetchAll();
  }, []);

  const filteredAnalyses = analyses.filter((a) =>
    (a.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.raw_prompt || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredConversations = conversations.filter((c) =>
    (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.last_message || "").toLowerCase().includes(search.toLowerCase())
  );

  const statusMap: Record<string, { label: string; className: string }> = {
    draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
    processing: { label: "Processando", className: "bg-warning/20 text-warning" },
    completed: { label: "Concluída", className: "bg-success/20 text-success" },
    failed: { label: "Falhou", className: "bg-destructive/20 text-destructive" },
    awaiting_clarification: { label: "Aguardando", className: "bg-warning/20 text-warning" },
    archived: { label: "Arquivada", className: "bg-muted text-muted-foreground" },
  };

  const contextTypeMap: Record<string, string> = {
    intake: "Chat de Análise",
    strategist: "Estrategista-Chefe",
    campaign: "Editor de Campanha",
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir conversa.");
    } else {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Conversa excluída.");
    }
  };

  const getConversationLink = (c: Conversation) => {
    if (c.context_type === "intake") return `/app/new-analysis?c=${c.id}`;
    if (c.context_type === "strategist" && c.analysis_request_id)
      return `/app/analysis/${c.analysis_request_id}/chat`;
    if (c.context_type === "campaign" && c.analysis_request_id)
      return `/app/analysis/${c.analysis_request_id}/campaign`;
    return `/app/new-analysis?c=${c.id}`;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Histórico</h1>
        <Button variant="hero" size="sm" asChild>
          <Link to="/app/new-analysis"><Plus className="h-4 w-4 mr-2" /> Nova Análise</Link>
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
          className="pl-10 bg-card" />
      </div>

      <Tabs defaultValue="conversations" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Conversas
          </TabsTrigger>
          <TabsTrigger value="analyses" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Análises
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          {loading ? (
            <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma conversa encontrada.</p>
              <p className="text-xs text-muted-foreground mt-1">Inicie uma nova análise para começar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((c) => (
                <Link
                  key={c.id}
                  to={getConversationLink(c)}
                  className="glass-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors block"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.title || "Conversa sem título"}</p>
                    {c.last_message && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                        {c.last_message.replace("##READY##", "").slice(0, 100)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(c.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {contextTypeMap[c.context_type] || c.context_type}
                      {c.message_count ? ` · ${c.message_count} msgs` : ""}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(c.id, e)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir conversa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analyses">
          {loading ? (
            <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-muted-foreground">Nenhuma análise encontrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAnalyses.map((a) => (
                <Link key={a.id} to={a.status === "completed" ? `/app/analysis/${a.id}/report` : "#"}
                  className="glass-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors block">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.title || "Análise sem título"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      {a.industry && ` · ${a.industry}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusMap[a.status]?.className}`}>
                    {statusMap[a.status]?.label}
                  </span>
                  {a.score_overall != null && (
                    <span className="text-xl font-display font-bold text-primary text-tabular min-w-[40px] text-right">
                      {Number(a.score_overall).toFixed(0)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
