import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@swiss/ui/components/sidebar';
import { Alert, AlertDescription } from '@swiss/ui/components/alert';
import { ToolSidebar } from './tool-sidebar';
import { Button } from '@swiss/ui/components/button';
import { useEffect, useEffectEvent, useState } from 'react';
import { browser } from 'wxt/browser';
import { Base64 } from './features/base64';
import { Ocr } from './features/ocr';
import { IdentityPasswords } from './features/identity-passwords';
import { SecretGenerators } from './features/secret-generators';
import { BcryptPasswords } from './features/bcrypt-passwords';
import { useWorkspace } from './state/workspace';
import { subscribeToInput } from './platform/input';
import type { WorkspaceInput } from './platform/messages';
export function App() {
  const state = useWorkspace();
  const [notice, setNotice] = useState('');
  const isSidebar = location.pathname.endsWith('/sidepanel.html');
  async function consume(input: WorkspaceInput) {
    state.setTool(input.tool);
    if (input.tool === 'base64') state.setBase64(input.text);
    else if (input.tool === 'identity-hash')
      state.identity.changeHashPassword(input.password);
    else if (input.tool === 'identity-verify') {
      state.identity.changeVerifyPassword(input.password);
      state.identity.changeStoredHash(input.hash);
    } else if (input.tool === 'bcrypt-hash') {
      state.bcrypt.changeHashPassword(input.password);
      state.bcrypt.changeCost(input.cost);
    } else if (input.tool === 'bcrypt-verify') {
      state.bcrypt.changeVerifyPassword(input.password);
      state.bcrypt.changeStoredHash(input.hash);
    } else if (input.tool === 'api-key')
      state.generators.api.change(input.options);
    else if (input.tool === 'jwt-key')
      state.generators.jwt.change(input.options);
    else if (input.tool === 'random-password')
      state.generators.password.change(input.options);
    else
      await state.selectImage(
        await (await fetch(input.dataUrl)).blob(),
        'Visible page capture',
      );
  }
  const consumeTransferredInput = useEffectEvent(
    (input: WorkspaceInput) => void consume(input),
  );
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;
    void subscribeToInput(consumeTransferredInput)
      .then((value) => {
        if (disposed) value();
        else cleanup = value;
      })
      .catch(() =>
        setNotice('Input transfer is unavailable. Paste or upload instead.'),
      );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  async function openTab() {
    let input: WorkspaceInput | undefined;
    if (state.tool === 'base64' && state.base64)
      input = { tool: 'base64', text: state.base64 };
    if (state.tool === 'ocr' && state.image) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(state.image!.blob);
      });
      input = { tool: 'ocr', dataUrl };
    }
    if (state.tool === 'identity-hash')
      input = { tool: state.tool, password: state.identity.hashPassword };
    if (state.tool === 'identity-verify')
      input = {
        tool: state.tool,
        password: state.identity.verifyPassword,
        hash: state.identity.storedHash,
      };
    if (state.tool === 'api-key')
      input = { tool: state.tool, options: state.generators.api.options };
    if (state.tool === 'bcrypt-hash')
      input = {
        tool: state.tool,
        password: state.bcrypt.hashPassword,
        cost: state.bcrypt.cost,
      };
    if (state.tool === 'bcrypt-verify')
      input = {
        tool: state.tool,
        password: state.bcrypt.verifyPassword,
        hash: state.bcrypt.storedHash,
      };
    if (state.tool === 'jwt-key')
      input = { tool: state.tool, options: state.generators.jwt.options };
    if (state.tool === 'random-password')
      input = { tool: state.tool, options: state.generators.password.options };
    await browser.runtime.sendMessage({ kind: 'open-tab', input });
  }
  async function capture() {
    try {
      const windowId = (await browser.windows.getCurrent()).id;
      const input: WorkspaceInput = await browser.runtime.sendMessage({
        kind: 'capture',
        windowId,
      });
      await consume(input);
      setNotice('');
    } catch {
      setNotice(
        'Open a regular web page and click the Swiss toolbar button to grant capture access, then retry.',
      );
    }
  }
  let toolContent;
  if (state.tool === 'base64') {
    toolContent = <Base64 />;
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
          <strong>swiss</strong>
          <div className="toolbar">
            {isSidebar && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void capture()}
                >
                  Capture page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void openTab().catch(() =>
                      setNotice('Could not open a workspace tab.'),
                    )
                  }
                >
                  Open in tab
                </Button>
              </>
            )}
          </div>
        </header>
        <div className="workspace-content">
          {notice && (
            <Alert className="mb-4">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {toolContent}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
