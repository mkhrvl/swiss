import { browser } from 'wxt/browser';
import { firefoxApis, toolbarAction } from '../src/platform/browser-apis';
import { isMessage, type WorkspaceInput } from '../src/platform/messages';

export default defineBackground(() => {
  const pending = new Map<
    string,
    { input: WorkspaceInput; windowId?: number; expires: number }
  >();
  function stage(input: WorkspaceInput, windowId?: number) {
    for (const [token, item] of pending)
      if (
        item.expires < Date.now() ||
        (item.windowId === windowId && windowId !== undefined)
      )
        pending.delete(token);
    const token = crypto.randomUUID();
    pending.set(token, { input, windowId, expires: Date.now() + 60_000 });
    setTimeout(() => pending.delete(token), 60_000);
    return token;
  }
  async function openTab(input?: WorkspaceInput) {
    const url = new URL(browser.runtime.getURL('/workspace.html'));
    if (input) url.searchParams.set('input', stage(input));
    await browser.tabs.create({ url: url.href });
  }
  function openPanel(windowId: number): Promise<boolean> {
    // Invoke immediately in the gesture handler; Firefox rejects an awaited gesture.
    try {
      if (import.meta.env.BROWSER === 'firefox')
        return firefoxApis.sidebarAction.open().then(
          () => true,
          () => false,
        );
      return browser.sidePanel.open({ windowId }).then(
        () => true,
        () => false,
      );
    } catch {
      return Promise.resolve(false);
    }
  }
  async function deliver(
    input: WorkspaceInput,
    windowId: number,
    opening: Promise<boolean>,
  ) {
    if (!(await opening)) {
      await openTab(input);
      return;
    }
    const token = stage(input, windowId);
    try {
      await browser.runtime.sendMessage({
        kind: 'input-ready',
        windowId,
        token,
      });
    } catch {
      /* A newly opened sidebar consumes pending input on mount. */
    }
  }
  async function capture(windowId: number): Promise<WorkspaceInput> {
    const [tab] = await browser.tabs.query({ active: true, windowId });
    if (!tab?.url || !/^https?:/.test(tab.url))
      throw new Error(
        'Open a regular web page and click Swiss before capturing it.',
      );
    return {
      tool: 'ocr',
      dataUrl: await browser.tabs.captureVisibleTab(windowId, {
        format: 'png',
      }),
    };
  }
  browser.runtime.onInstalled.addListener(() => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: 'decode-base64',
        title: 'Decode selection with Swiss',
        contexts: ['selection'],
      });
      browser.contextMenus.create({
        id: 'ocr-page',
        title: 'Extract text from visible page with Swiss',
        contexts: ['page', 'image'],
      });
    });
  });
  toolbarAction.onClicked.addListener((tab) => {
    if (tab.windowId !== undefined)
      void openPanel(tab.windowId).then((opened) => {
        if (!opened) return openTab();
      });
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.windowId === undefined) return;
    const opening = openPanel(tab.windowId);
    if (info.menuItemId === 'decode-base64')
      void deliver(
        { tool: 'base64', text: info.selectionText ?? '' },
        tab.windowId,
        opening,
      );
    else if (info.menuItemId === 'ocr-page')
      void capture(tab.windowId)
        .then((input) => deliver(input, tab.windowId!, opening))
        .catch(() => openTab());
  });
  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== 'capture-page') return;
    // Firefox's onCommand supplies no tab. Open its sidebar before awaiting a query.
    if (import.meta.env.BROWSER === 'firefox') {
      const opening = openPanel(0);
      void browser.tabs
        .query({ active: true, currentWindow: true })
        .then(async ([active]) => {
          if (active?.windowId === undefined) return;
          await deliver(
            await capture(active.windowId),
            active.windowId,
            opening,
          );
        })
        .catch(() => openTab());
    } else if (tab?.windowId !== undefined) {
      const opening = openPanel(tab.windowId);
      void capture(tab.windowId)
        .then((input) => deliver(input, tab.windowId!, opening))
        .catch(() => openTab());
    }
  });
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (sender.id !== browser.runtime.id || !isMessage(message)) return;
    if (message.kind === 'take-input') {
      const entry = message.token
        ? [...pending].find(([token]) => token === message.token)
        : [...pending].find(([, item]) => item.windowId === message.windowId);
      if (!entry) return Promise.resolve(undefined);
      pending.delete(entry[0]);
      return Promise.resolve(
        entry[1].expires >= Date.now() ? entry[1].input : undefined,
      );
    }
    if (message.kind === 'open-tab') return openTab(message.input);
    if (message.kind === 'capture') return capture(message.windowId);
  });
});
