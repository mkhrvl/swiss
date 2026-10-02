import { browser } from 'wxt/browser';

// WXT exposes Chromium types; Firefox MV2 retains browserAction and sidebarAction.
export const firefoxApis = browser as unknown as {
  browserAction: typeof browser.action;
  sidebarAction: { open(): Promise<void> };
};
export const toolbarAction =
  import.meta.env.BROWSER === 'firefox'
    ? firefoxApis.browserAction
    : browser.action;
