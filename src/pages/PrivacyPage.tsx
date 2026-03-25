import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AgoraIcon } from "@/components/AgoraIcon";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <AgoraIcon size={32} className="shrink-0 rounded-lg" />
            <span className="font-display text-xl font-bold">Ágora</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
          </Button>
        </div>
      </nav>

      <div className="container max-w-3xl py-16 px-4">
        <h1 className="text-4xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-10">Última atualização: 19 de março de 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_strong]:text-foreground">
          <p>A Ágora ("nós", "nosso") opera a plataforma de marketing científico com inteligência artificial disponível em agora-mkt-ai.lovable.app. Esta política descreve como coletamos, usamos e protegemos suas informações.</p>

          <h2>1. Informações que Coletamos</h2>
          <p><strong>Dados de cadastro:</strong> nome, e-mail, empresa e cargo fornecidos no registro.</p>
          <p><strong>Dados de uso:</strong> campanhas analisadas, relatórios gerados, interações com o chat de IA e histórico de conversas.</p>
          <p><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e páginas visitadas, coletados automaticamente para melhoria do serviço.</p>
          <p><strong>Arquivos enviados:</strong> imagens, documentos e materiais de campanha enviados para análise ou edição no estúdio criativo.</p>

          <h2>2. Como Usamos Suas Informações</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fornecer, manter e melhorar nossos serviços de análise de campanhas.</li>
            <li>Processar suas campanhas através de nossos agentes de IA especializados.</li>
            <li>Gerar relatórios, scores e recomendações estratégicas.</li>
            <li>Enviar comunicações sobre sua conta e atualizações do serviço.</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>

          <h2>3. Compartilhamento com Terceiros</h2>
          <p>Utilizamos serviços de terceiros para operar a plataforma:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Modelos de IA:</strong> dados de campanhas são processados por modelos de linguagem para gerar análises. Os dados não são usados para treinar modelos.</li>
            <li><strong>Adobe Express:</strong> ao usar o estúdio criativo, imagens podem ser processadas pelo Adobe Express Embed SDK conforme os <a href="https://www.adobe.com/br/privacy.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">termos de privacidade da Adobe</a>.</li>
            <li><strong>Infraestrutura:</strong> utilizamos provedores de nuvem para hospedagem, banco de dados e armazenamento de arquivos.</li>
          </ul>
          <p>Não vendemos seus dados pessoais a terceiros.</p>

          <h2>4. Cookies e Tecnologias de Rastreamento</h2>
          <p>Utilizamos cookies essenciais para autenticação e manutenção da sessão. O Adobe Express Embed SDK pode utilizar cookies próprios conforme sua política de privacidade.</p>

          <h2>5. Segurança dos Dados</h2>
          <p>Implementamos medidas técnicas e organizacionais para proteger suas informações, incluindo criptografia em trânsito (TLS), controle de acesso baseado em funções e políticas de segurança em nível de linha no banco de dados.</p>

          <h2>6. Seus Direitos (LGPD)</h2>
          <p>Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Acessar seus dados pessoais armazenados.</li>
            <li>Solicitar correção de dados incompletos ou incorretos.</li>
            <li>Solicitar a exclusão de seus dados pessoais.</li>
            <li>Revogar consentimento a qualquer momento.</li>
            <li>Solicitar portabilidade dos dados.</li>
          </ul>

          <h2>7. Retenção de Dados</h2>
          <p>Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão da conta, seus dados serão removidos em até 30 dias, exceto quando a retenção for necessária por obrigação legal.</p>

          <h2>8. Alterações nesta Política</h2>
          <p>Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas por e-mail ou aviso na plataforma.</p>

          <h2>9. Contato</h2>
          <p>Para dúvidas sobre privacidade, entre em contato pelo e-mail: <strong>privacidade@agora-mkt.com</strong></p>
        </div>
      </div>

      <footer className="border-t border-border/30 py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AgoraIcon size={20} className="shrink-0 rounded" />
            <span className="font-display font-semibold text-foreground">Ágora</span>
          </div>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">Termos de Uso</Link>
            <Link to="/privacy" className="text-foreground">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
