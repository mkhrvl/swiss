import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { WorkspaceProvider } from './state/workspace';
import './app/styles.css';
createRoot(document.getElementById('root')!).render(
  <WorkspaceProvider>
    <App />
  </WorkspaceProvider>,
);
