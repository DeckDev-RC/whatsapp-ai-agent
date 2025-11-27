import { Minus, Square, X } from 'lucide-react';

// ============================================
// TITLE BAR - Barra de Título Customizada
// ============================================

export function TitleBar() {
  const handleMinimize = () => {
    window.api?.window.minimize();
  };

  const handleMaximize = () => {
    window.api?.window.maximize();
  };

  const handleClose = () => {
    window.api?.window.close();
  };

  return (
    <div
      className="h-10 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Title */}
      <div className="flex items-center gap-2 text-text-secondary text-sm font-medium">
        <span>WhatsApp AI Agent Manager</span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors duration-200"
          title="Minimizar"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors duration-200"
          title="Maximizar/Restaurar"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-white hover:bg-red-500/20 rounded transition-colors duration-200"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

