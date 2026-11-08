import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { ToastProvider } from '../ui/feedback';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
