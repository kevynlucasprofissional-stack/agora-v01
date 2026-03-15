import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, MessageSquare, Trash2 } from "lucide-react";
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

const contextTypeMap: Record<string, string> = {
  intake: "Chat de Análise",
  strategist: "Estrategista-Chefe",
  campaign: "Editor de Campanha",
  "report-chat": "Chat do Relatório",
};

export default function ConversationHistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Only fetch conversations that do NOT have an analysis_request_id
      // (once a conversation becomes an analysis, it belongs to the analysis results)
      const { data: convs } = await supabase
        .from("conversations")
        .select("*")
        .is("analysis_request_id", null)
        .order("updated_at", { ascending: false });

      const list = convs ?? [];

      if (list.length > 0) {
        const convsWithMeta = await Promise.all(
          list.map(async (c) => {
            const [lastMsgRes, firstUserMsgRes, countRes] = await Promise.all([
              supabase
                .from("chat_messages")
                .select("content")
                .eq("conversation_id", c.id)
                .order("created_at", { ascending: false })
                .limit(1),
              supabase
                .from("chat_messages")
                .select("content")
                .eq("conversation_id", c.id)
                .eq("role", "user")
                .order("created_at", { ascending: true })
                .limit(1),
              supabase
                .from("chat_messages")
                .select("id", { count: "exact", head: true })
                .eq("conversation_id", c.id),
            ]);

            const firstUserMsg = firstUserMsgRes.data?.[0]?.content;
            const effectiveTitle =
              !c.title || c.title === "Nova Análise"
                ? firstUserMsg?.replace(/📎.*$/, "").trim().slice(0, 80) || c.title
                : c.title;

            return {
              ...c,
              title: effectiveTitle,
              last_message: lastMsgRes.data?.[0]?.content || null,
              message_count: countRes.count || 0,
            } as Conversation;
          })
        );
        setConversations(convsWithMeta);
      }

      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = conversations.filter(
    (c) =>
      (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.last_message || "").toLowerCase().includes(search.toLowerCase())
  );

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
    return `/app/new-analysis?c=${c.id}`;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Histórico de Conversas</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conversas..."
          className="pl-10 bg-card"
        />
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma conversa encontrada.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Conversas que se tornaram análises aparecem em "Resultados das Análises".
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
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
                  {new Date(c.updated_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
    </div>
  );
}
