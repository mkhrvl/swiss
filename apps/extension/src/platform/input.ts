import { browser } from 'wxt/browser';
import { isMessage, type WorkspaceInput } from './messages';
export async function subscribeToInput(
  consume: (input: WorkspaceInput) => void,
) {
  const token = new URL(location.href).searchParams.get('input');
  const isSidebar = location.pathname.endsWith('/sidepanel.html');
  const windowId = (await browser.windows.getCurrent()).id;
  let active = true;
  async function take(inputToken?: string) {
    const input: WorkspaceInput | undefined = await browser.runtime.sendMessage(
      {
        kind: 'take-input',
        token: inputToken,
        windowId: isSidebar ? windowId : undefined,
      },
    );
    if (active && input) consume(input);
  }
  const listener = (message: unknown) => {
    if (
      isSidebar &&
      isMessage(message) &&
      message.kind === 'input-ready' &&
      message.windowId === windowId
    )
      void take(message.token);
  };
  browser.runtime.onMessage.addListener(listener);
  if (token || isSidebar) await take(token ?? undefined);
  if (token) history.replaceState(null, '', location.pathname);
  return () => {
    active = false;
    browser.runtime.onMessage.removeListener(listener);
  };
}
