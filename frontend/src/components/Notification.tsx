import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// ============================================
// NOTIFICATION COMPONENT
// ============================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  error: 'bg-red-500/20 border-red-500/50 text-red-400',
  warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
};

export function NotificationItem({ notification, onClose }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = icons[notification.type];

  useEffect(() => {
    // Anima entrada
    setTimeout(() => setIsVisible(true), 10);

    // Auto-remove após duração
    if (notification.duration !== 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(notification.id), 300); // Aguarda animação de saída
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }

    // Retorna função vazia quando duration === 0 para garantir que todos os caminhos retornem um valor
    return () => {};
  }, [notification, onClose]);

  return (
    <div
      className={`
        ${colors[notification.type]}
        border rounded-xl p-4 mb-3 backdrop-blur-xl
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
        flex items-start gap-3 min-w-[300px] max-w-[400px]
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{notification.message}</p>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose(notification.id), 300);
        }}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================
// NOTIFICATION MANAGER
// ============================================

let notificationIdCounter = 0;
const listeners: Array<(notifications: Notification[]) => void> = [];
let notifications: Notification[] = [];

export function showNotification(
  type: NotificationType,
  message: string,
  duration?: number
): void {
  const id = `notification-${++notificationIdCounter}`;
  const notification: Notification = { id, type, message, duration };
  
  notifications = [...notifications, notification];
  listeners.forEach(listener => listener([...notifications]));
}

export function removeNotification(id: string): void {
  notifications = notifications.filter(n => n.id !== id);
  listeners.forEach(listener => listener([...notifications]));
}

export function useNotifications() {
  const [state, setState] = useState<Notification[]>([]);

  useEffect(() => {
    listeners.push(setState);
    setState([...notifications]);

    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return state;
}

// ============================================
// NOTIFICATION CONTAINER
// ============================================

export function NotificationContainer() {
  const notifications = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
}

