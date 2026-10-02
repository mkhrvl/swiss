import { createRoot } from 'react-dom/client';
import { App } from '../../src/app';
import { WorkspaceProvider } from '../../src/state/workspace';
import '../../src/styles.css';
createRoot(document.getElementById('root')!).render(
  <WorkspaceProvider>
    <App />
  </WorkspaceProvider>,
);
