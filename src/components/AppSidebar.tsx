import {
  LayoutGrid, FolderOpen, Settings, User,
  LogOut, Plus, Link2, BarChart3, MessageSquare, Palette,
} from "lucide-react";
import { AgoraIcon } from "@/components/AgoraIcon";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarBody, SidebarLink, useSidebar,
} from "@/components/ui/hover-sidebar";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const mainNav = [
  { label: "Dashboard", href: "/app", icon: <LayoutGrid className="h-5 w-5 shrink-0" /> },
  { label: "Novo chat", href: "/app/new-analysis", icon: <Plus className="h-5 w-5 shrink-0" /> },
  { label: "Análises", href: "/app/analyses", icon: <BarChart3 className="h-5 w-5 shrink-0" /> },
  { label: "Conversas", href: "/app/conversations", icon: <MessageSquare className="h-5 w-5 shrink-0" /> },
  
  { label: "Estúdio Criativo", href: "/app/creative-studio", icon: <Palette className="h-5 w-5 shrink-0" /> },
];

const accountNav = [
  { label: "Conta", href: "/app/account", icon: <User className="h-5 w-5 shrink-0" /> },
  { label: "Configurações", href: "/app/settings", icon: <Settings className="h-5 w-5 shrink-0" /> },
];

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const { isEnterprise } = usePlanAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isActive = (href: string) => {
    if (href === "/app") return currentPath === "/app";
    if (href === "/app/new-analysis") return false; // never show as active
    return currentPath.startsWith(href);
  };

  const handleNewChat = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    // Navigate with a unique key to force remount even if already on the page
    navigate(`/app/new-analysis?t=${Date.now()}`);
  };

  const enterpriseNav = isEnterprise
    ? [{ label: "Integrações", href: "/app/integrations", icon: <Link2 className="h-5 w-5 shrink-0" /> }]
    : [];

  return (
    <Sidebar>
      <SidebarBody className="justify-between gap-6">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          {/* Logo */}
          <Logo />

          {/* Main nav */}
          <div className="mt-6 flex flex-col gap-1">
            {mainNav.map((link) =>
              link.href === "/app/new-analysis" ? (
                <SidebarLink
                  key={link.href}
                  link={link}
                  active={false}
                  onClick={handleNewChat}
                  className="bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                />
              ) : (
                <SidebarLink key={link.href} link={link} active={isActive(link.href)} />
              )
            )}
          </div>

          {/* Enterprise nav */}
          {enterpriseNav.length > 0 && (
            <div className="mt-6 flex flex-col gap-1">
              {enterpriseNav.map((link) => (
                <SidebarLink key={link.href} link={link} active={isActive(link.href)} />
              ))}
            </div>
          )}

          {/* Account nav */}
          <div className="mt-6 flex flex-col gap-1">
            {accountNav.map((link) => (
              <SidebarLink key={link.href} link={link} active={isActive(link.href)} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2">
          <ProfileCard />
          <SidebarLink
            link={{
              label: "Sair",
              href: "#",
              icon: <LogOut className="h-5 w-5 shrink-0 text-muted-foreground group-hover/sidebar:text-destructive" />,
            }}
            onClick={(e) => {
              e?.preventDefault?.();
              signOut();
            }}
            className="hover:text-destructive"
          />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}

function Logo() {
  const { open, animate } = useSidebar();
  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <AgoraIcon size={32} className="shrink-0 rounded-lg" />
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.2 }}
        className="font-display text-lg font-bold tracking-tight text-foreground whitespace-pre"
      >
        Ágora
      </motion.span>
    </div>
  );
}

function ProfileCard() {
  const { open, animate } = useSidebar();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <motion.div
      animate={{
        opacity: animate ? (open ? 1 : 0) : 1,
        height: animate ? (open ? "auto" : 0) : "auto",
      }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="rounded-xl bg-accent/50 p-3">
        <p className="text-xs font-medium text-foreground truncate">
          {profile.full_name || profile.email}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
      </div>
    </motion.div>
  );
}
