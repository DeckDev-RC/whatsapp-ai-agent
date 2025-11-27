import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
import { api } from './api/client';

// ============================================
// RENDERER ENTRY POINT
// ============================================

// Initialize API shim for Web App mode
// This replaces the Electron contextBridge
(window as any).api = api;

// Nota: React.StrictMode foi removido para evitar chamadas duplicadas
// em desenvolvimento. StrictMode executa efeitos duas vezes para detectar
// problemas, mas causa logs repetitivos desnecessários.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

