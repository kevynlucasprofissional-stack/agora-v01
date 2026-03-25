import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AgoraIcon } from "@/components/AgoraIcon";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-10">Última atualização: 19 de março de 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_strong]:text-foreground">
          <p>Bem-vindo à Ágora. Ao acessar ou utilizar nossa plataforma, você concorda com estes Termos de Uso. Leia-os atentamente.</p>

          <h2>1. Aceitação dos Termos</h2>
          <p>Ao criar uma conta ou utilizar qualquer funcionalidade da plataforma Ágora, você declara ter lido, compreendido e concordado com estes termos. Se você não concordar, não utilize o serviço.</p>

          <h2>2. Descrição do Serviço</h2>
          <p>A Ágora é uma plataforma de marketing científico com inteligência artificial que oferece:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Análise de campanhas de marketing por agentes especializados de IA.</li>
            <li>Geração de relatórios com scores e recomendações estratégicas.</li>
            <li>Chat com assistentes de IA para otimização de campanhas.</li>
            <li>Estúdio criativo para edição de peças publicitárias.</li>
            <li>Geração de documentos de campanha e materiais de apoio.</li>
          </ul>

          <h2>3. Cadastro e Conta</h2>
          <p>Você é responsável por manter a confidencialidade de suas credenciais de acesso. Todas as atividades realizadas em sua conta são de sua responsabilidade. Notifique-nos imediatamente sobre qualquer uso não autorizado.</p>

          <h2>4. Planos e Pagamentos</h2>
          <p>A Ágora oferece diferentes planos de assinatura (Freemium, Standard, Pro e Enterprise). Os limites de uso, funcionalidades e preços de cada plano estão descritos na <Link to="/pricing" className="text-primary hover:underline">página de preços</Link>. Reservamo-nos o direito de alterar preços com aviso prévio de 30 dias.</p>

          <h2>5. Uso Aceitável</h2>
          <p>Você concorda em não:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Utilizar o serviço para fins ilegais ou não autorizados.</li>
            <li>Tentar acessar áreas restritas do sistema ou dados de outros usuários.</li>
            <li>Enviar conteúdo malicioso, ofensivo ou que viole direitos de terceiros.</li>
            <li>Realizar engenharia reversa ou tentar extrair o código-fonte da plataforma.</li>
            <li>Sobrecarregar intencionalmente a infraestrutura do serviço.</li>
            <li>Revender ou sublicenciar o acesso à plataforma sem autorização.</li>
          </ul>

          <h2>6. Propriedade Intelectual</h2>
          <p><strong>Da plataforma:</strong> todo o software, design, textos e algoritmos da Ágora são de nossa propriedade ou licenciados para nós. Você não adquire direitos sobre eles.</p>
          <p><strong>Do usuário:</strong> você mantém a propriedade dos dados e materiais que envia à plataforma. Ao enviar conteúdo, você nos concede uma licença limitada para processá-lo conforme necessário para fornecer o serviço.</p>
          <p><strong>Conteúdo gerado:</strong> relatórios, análises e materiais criativos gerados pela plataforma podem ser utilizados livremente por você para fins comerciais.</p>

          <h2>7. Integrações de Terceiros</h2>
          <p>A plataforma pode integrar-se com serviços de terceiros, incluindo Adobe Express, modelos de IA e outros. O uso desses serviços está sujeito aos respectivos termos de cada provedor.</p>

          <h2>8. Limitação de Responsabilidade</h2>
          <p>A Ágora é fornecida "como está". Não garantimos que:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>O serviço será ininterrupto ou livre de erros.</li>
            <li>As análises e recomendações da IA produzirão resultados específicos.</li>
            <li>Os scores e métricas representam garantia de performance de mercado.</li>
          </ul>
          <p>Em nenhuma hipótese nossa responsabilidade total excederá o valor pago por você nos últimos 12 meses de assinatura.</p>

          <h2>9. Rescisão</h2>
          <p>Você pode cancelar sua conta a qualquer momento nas configurações da plataforma. Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, com notificação prévia quando possível.</p>

          <h2>10. Legislação Aplicável</h2>
          <p>Estes termos são regidos pela legislação brasileira. Qualquer disputa será resolvida no foro da comarca de São Paulo/SP.</p>

          <h2>11. Alterações nos Termos</h2>
          <p>Podemos modificar estes termos a qualquer momento. Alterações significativas serão comunicadas com pelo menos 15 dias de antecedência por e-mail ou aviso na plataforma.</p>

          <h2>12. Contato</h2>
          <p>Para dúvidas sobre estes termos: <strong>contato@agora-mkt.com</strong></p>
        </div>
      </div>

      <footer className="border-t border-border/30 py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AgoraIcon size={20} className="shrink-0 rounded" />
            <span className="font-display font-semibold text-foreground">Ágora</span>
          </div>
          <div className="flex gap-4">
            <Link to="/terms" className="text-foreground">Termos de Uso</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
