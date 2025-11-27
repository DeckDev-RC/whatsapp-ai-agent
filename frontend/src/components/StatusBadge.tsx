import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

// ============================================
// STATUS BADGE COMPONENT
// ============================================

type StatusType = 'success' | 'error' | 'warning' | 'loading';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  animate?: boolean;
}

export function StatusBadge({ status, label, animate = false }: StatusBadgeProps) {
  const config = {
    success: {
      icon: CheckCircle2,
      className: 'badge-success',
      defaultLabel: 'Conectado',
    },
    error: {
      icon: XCircle,
      className: 'badge-error',
      defaultLabel: 'Desconectado',
    },
    warning: {
      icon: AlertCircle,
      className: 'badge-warning',
      defaultLabel: 'Atenção',
    },
    loading: {
      icon: Loader2,
      className: 'badge-info',
      defaultLabel: 'Conectando...',
    },
  };

  const { icon: Icon, className, defaultLabel } = config[status];

  return (
    <span className={className}>
      <Icon
        className={`w-3.5 h-3.5 ${animate || status === 'loading' ? 'animate-pulse' : ''}`}
      />
      {label || defaultLabel}
    </span>
  );
}

