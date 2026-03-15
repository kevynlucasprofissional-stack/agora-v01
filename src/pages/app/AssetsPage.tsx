import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileRecord } from "@/types/database";
import { FileText, Download, Image, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function AssetsPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("files").select("*").order("created_at", { ascending: false });
      setFiles(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const getIcon = (mime: string) => {
    if (mime.startsWith("image/")) return Image;
    if (mime.includes("pdf")) return FileText;
    return File;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca de Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">Arquivos enviados, relatórios e materiais gerados.</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      ) : files.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold">Nenhum arquivo ainda</h3>
          <p className="text-sm text-muted-foreground mt-1">Envie arquivos em uma análise para vê-los aqui.</p>
          <Button variant="hero" className="mt-6" asChild>
            <Link to="/app/new-analysis">Nova Análise</Link>
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((f) => {
            const Icon = getIcon(f.mime_type);
            return (
              <div key={f.id} className="glass-card p-4 flex items-start gap-3 hover:border-primary/30 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.original_filename}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {f.file_size_bytes ? `${(f.file_size_bytes / 1024).toFixed(0)} KB` : ""} ·{" "}
                    {new Date(f.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-2 inline-block">
                    {f.kind.replace("_", " ")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
