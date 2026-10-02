import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'Swiss — Local developer tools',
    description:
      'Local Base64, OCR, Identity passwords and secret generators in a sidebar or tab.',
    permissions: [
      'activeTab',
      'contextMenus',
      ...(browser === 'chrome' ? ['sidePanel'] : []),
    ],
    action: { default_title: 'Open Swiss', default_icon: 'icon-192.png' },
    icons: { 192: 'icon-192.png' },
    commands: {
      'capture-page': {
        suggested_key: { default: 'Alt+Shift+O' },
        description: 'Capture the visible page for English OCR',
      },
    },
    // WXT adds development CSP sources before converting its manifest to MV2.
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    browser_specific_settings:
      browser === 'firefox'
        ? {
            gecko: {
              id: 'swiss@mkrevil.local',
              strict_min_version: '128.0',
              data_collection_permissions: { required: ['none'] },
            },
          }
        : undefined,
  }),
  vite: () => ({ plugins: [tailwindcss()], worker: { format: 'es' } }),
});
