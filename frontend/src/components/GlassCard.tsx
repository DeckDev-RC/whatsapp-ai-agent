import { ReactNode } from 'react';

// ============================================
// GLASS CARD COMPONENT
// ============================================

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className = '', hover = false }: GlassCardProps) {
  return (
    <div className={`${hover ? 'glass-card-hover' : 'glass-card'} p-6 ${className}`}>
      {children}
    </div>
  );
}

interface GlassCardHeaderProps {
  title: string | ReactNode;
  description?: string;
  action?: ReactNode;
}

export function GlassCardHeader({ title, description, action }: GlassCardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {typeof title === 'string' ? (
          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
        ) : (
          <div>{title}</div>
        )}
        {description && (
          <p className="text-text-secondary mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

