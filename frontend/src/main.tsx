import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// ============================================
// RENDERER ENTRY POINT
// ============================================

// Nota: React.StrictMode foi removido para evitar chamadas duplicadas
// em desenvolvimento. StrictMode executa efeitos duas vezes para detectar
// problemas, mas causa logs repetitivos desnecessários.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

