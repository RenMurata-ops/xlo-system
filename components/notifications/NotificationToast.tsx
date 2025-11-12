'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('notification-toasts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notification = payload.new as ToastNotification;

          // Only show high priority or urgent notifications as toasts
          if (notification.priority === 'high' || notification.priority === 'urgent') {
            addToast(notification);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  function addToast(notification: ToastNotification) {
    setToasts(prev => [...prev, notification]);

    // Auto-remove after duration based on priority
    const duration = notification.priority === 'urgent' ? 10000 : 5000;
    setTimeout(() => {
      removeToast(notification.id);
    }, duration);
  }

  function removeToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function getToastIcon(type: string) {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  }

  function getToastStyle(type: string, priority: string) {
    if (priority === 'urgent') {
      return 'bg-red-500 text-white border-red-600';
    }
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
    }
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={cn(
            'p-4 rounded-lg border shadow-lg animate-in slide-in-from-right duration-300',
            getToastStyle(toast.type, toast.priority)
          )}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getToastIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">{toast.title}</h4>
              <p className="text-sm mt-1 opacity-90">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
