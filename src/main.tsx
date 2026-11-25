import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { restoreLanguage, type Language } from './i18n';
import { request } from './services/api';
import '@xyflow/react/dist/style.css';
import './styles/global.css';

void request<{ language: Language | null }>('/api/preferences/language')
  .then(({ language }) => restoreLanguage(language))
  .catch(() => {});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
