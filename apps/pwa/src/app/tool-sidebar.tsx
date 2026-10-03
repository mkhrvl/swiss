import {
  Braces,
  FileJson,
  Hash,
  ScanText,
  ShieldCheck,
  KeyRound,
  KeySquare,
  Dices,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@swiss/ui/components/sidebar';
import { Button } from '@swiss/ui/components/button';
import { useWorkspace } from '../state/workspace';

const toolGroups = [
  {
    label: 'Tools',
    tools: [
      { id: 'base64', label: 'Decode Base64', icon: Braces },
      { id: 'ocr', label: 'Extract text', icon: ScanText },
      { id: 'json', label: 'JSON', icon: FileJson },
    ],
  },
  {
    label: 'Identity',
    tools: [
      { id: 'identity-hash', label: 'Hash password', icon: Hash },
      { id: 'identity-verify', label: 'Verify password', icon: ShieldCheck },
    ],
  },
  {
    label: 'Bcrypt',
    tools: [
      { id: 'bcrypt-hash', label: 'Generate bcrypt hash', icon: Hash },
      { id: 'bcrypt-verify', label: 'Verify bcrypt hash', icon: ShieldCheck },
    ],
  },
  {
    label: 'Generators',
    tools: [
      { id: 'api-key', label: 'Generate API key', icon: KeyRound },
      { id: 'jwt-key', label: 'Generate JWT signing key', icon: KeySquare },
      { id: 'random-password', label: 'Generate password', icon: Dices },
    ],
  },
] as const;

export function ToolSidebar() {
  const state = useWorkspace();
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  state.setTool('base64');
                  setOpenMobile(false);
                }}
                aria-label="Swiss home"
              >
                <div className="shrink-0 pr-1 text-[29px] leading-none font-[650] tracking-[-0.08em] text-primary">
                  {'s'}
                  <span className="group-data-[collapsible=icon]:hidden">
                    wiss
                  </span>
                </div>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Tools">
          {toolGroups.map(({ label: groupLabel, tools }) => (
            <SidebarGroup key={groupLabel}>
              <SidebarGroupLabel asChild>
                <h2>{groupLabel}</h2>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {tools.map(({ id, label, icon: Icon }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        isActive={state.tool === id}
                        aria-current={state.tool === id ? 'page' : undefined}
                        aria-label={label}
                        tooltip={label}
                        onClick={() => {
                          state.setTool(id);
                          setOpenMobile(false);
                        }}
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          All tools run locally.
        </p>
        {isMobile && (
          <Button variant="outline" onClick={() => setOpenMobile(false)}>
            Close tools
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
