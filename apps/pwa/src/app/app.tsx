import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@swiss/ui/components/sidebar';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@swiss/ui/components/alert';
import { ToolSidebar } from './tool-sidebar';
import { Button } from '@swiss/ui/components/button';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Base64 } from '../features/base64';
import { Ocr } from '../features/ocr';
import { IdentityPasswords } from '../features/identity-passwords';
import { SecretGenerators } from '../features/secret-generators';
import { BcryptPasswords } from '../features/bcrypt-passwords';
import { useWorkspace } from '../state/workspace';
import { JsonTools } from '../features/json';
export function App() {
  const state = useWorkspace();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  let toolContent;
  if (state.tool === 'base64') {
    toolContent = <Base64 />;
  } else if (state.tool === 'json') {
    toolContent = <JsonTools />;
  } else if (state.tool === 'ocr') {
    toolContent = <Ocr />;
  } else if (state.tool === 'bcrypt-hash' || state.tool === 'bcrypt-verify') {
    toolContent = (
      <BcryptPasswords
        operation={state.tool === 'bcrypt-hash' ? 'hash' : 'verify'}
      />
    );
  } else if (
    state.tool === 'api-key' ||
    state.tool === 'jwt-key' ||
    state.tool === 'random-password'
  ) {
    toolContent = <SecretGenerators kind={state.tool} />;
  } else {
    const operation = state.tool === 'identity-hash' ? 'hash' : 'verify';
    toolContent = <IdentityPasswords operation={operation} />;
  }
  return (
    <SidebarProvider>
      <ToolSidebar />
      <SidebarInset className="min-w-0">
        <header className="workspace-header">
          <SidebarTrigger />
        </header>
        <div className="workspace-content" data-tool={state.tool}>
          {needRefresh && (
            <Alert className="mb-6">
              <AlertTitle>Update available</AlertTitle>
              <AlertDescription>
                An update is ready. Reloading clears your current workspace.
                <Button
                  variant="outline"
                  disabled={
                    state.busy ||
                    state.identity.hashBusy ||
                    state.identity.verifyBusy ||
                    Boolean(state.bcrypt.busy)
                  }
                  onClick={() => void updateServiceWorker(true)}
                >
                  Reload to update
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {toolContent}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
