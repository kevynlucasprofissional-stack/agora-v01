

## Plano: Responsividade Mobile + UX do Comparador

### Problemas identificados

1. **Menu mobile não fecha ao clicar em link** — `SidebarLink` navega mas não chama `setOpen(false)`
2. **Logo mobile inconsistente** — O header mobile usa um `<div>` com letra "Á" em vez do `AgoraIcon` SVG oficial
3. **Chat desalinhado** — O container tem `max-w-4xl mx-auto` mas o `h-[calc(100vh-4rem)]` não compensa o header mobile de 56px (h-14) corretamente; padding excessivo em mobile
4. **Cards de sugestão e mensagens não responsivos** — `max-w-[85%]` pode ser pequeno em mobile; padding e tamanhos de fonte não adaptados

### Alterações

#### 1. `src/components/ui/hover-sidebar.tsx`
- Importar `useNavigate` ou passar `setOpen` ao `SidebarLink`
- No `SidebarLink`, ao clicar em mobile, chamar `setOpen(false)` para fechar o menu automaticamente
- Substituir o logo "Á" no header mobile pelo componente `AgoraIcon` real

#### 2. `src/pages/app/CampaignComparatorPage.tsx`
- Ajustar altura do container: `h-[calc(100vh-3.5rem)]` em mobile (header h-14) vs desktop
- Reduzir padding em mobile: `px-2 md:px-4` no chat e input areas
- Mensagens: `max-w-[95%] md:max-w-[85%]`
- Cards de sugestão: `grid-cols-1` em mobile (já está, mas verificar gaps)
- Header da página: reduzir font-size em mobile

#### 3. `src/components/AppLayout.tsx`
- Ajustar padding do `main`: `p-2 md:p-6` para dar mais espaço em mobile

### Detalhes técnicos

- No `SidebarLink`, acessar o contexto `useSidebar()` para obter `setOpen` e chamar `setOpen(false)` no `onClick` quando em mobile (detectar via `window.innerWidth < 768` ou simplesmente sempre fechar)
- No `MobileSidebar`, substituir `<div className="flex h-8 w-8 ..."><span>Á</span></div>` por `<AgoraIcon size={32} className="shrink-0 rounded-lg" />`

