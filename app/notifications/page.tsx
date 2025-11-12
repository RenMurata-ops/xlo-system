'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'system' | 'account' | 'execution' | 'rate_limit';
  is_read: boolean;
  action_url?: string;
  action_label?: string;
  metadata?: any;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const supabase = createClient();

  useEffect(() => {
    loadNotifications();
  }, [filter, categoryFilter]);

  async function loadNotifications() {
    try {
      setLoading(true);

      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  async function deleteNotification(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  async function deleteAllRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('is_read', true);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
    }
  }

  function getNotificationStyle(type: string, priority: string) {
    if (priority === 'urgent') {
      return 'border-l-4 border-red-500';
    }
    switch (type) {
      case 'success':
        return 'border-l-4 border-green-500';
      case 'warning':
        return 'border-l-4 border-yellow-500';
      case 'error':
        return 'border-l-4 border-red-500';
      default:
        return 'border-l-4 border-blue-500';
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bell className="h-8 w-8" />
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" size="sm">
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all read
              </Button>
            )}
            <Button
              onClick={deleteAllRead}
              variant="outline"
              size="sm"
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete read
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={categoryFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategoryFilter('all')}
            >
              All
            </Button>
            <Button
              variant={categoryFilter === 'system' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategoryFilter('system')}
            >
              System
            </Button>
            <Button
              variant={categoryFilter === 'account' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategoryFilter('account')}
            >
              Account
            </Button>
            <Button
              variant={categoryFilter === 'execution' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategoryFilter('execution')}
            >
              Execution
            </Button>
            <Button
              variant={categoryFilter === 'rate_limit' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategoryFilter('rate_limit')}
            >
              Rate Limit
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No notifications</h3>
          <p className="text-muted-foreground">
            {filter === 'unread'
              ? 'All caught up! No unread notifications.'
              : 'You have no notifications yet.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'p-4 transition-colors',
                !notification.is_read && 'bg-accent/50',
                getNotificationStyle(
                  notification.type,
                  notification.priority
                )
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className={cn(
                        'font-medium',
                        !notification.is_read && 'font-semibold'
                      )}
                    >
                      {notification.title}
                    </h3>
                    {notification.priority === 'urgent' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500 text-white">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatTime(notification.created_at)}</span>
                    {notification.category && (
                      <span className="px-2 py-0.5 rounded bg-secondary">
                        {notification.category}
                      </span>
                    )}
                  </div>
                  {notification.action_url && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 h-auto p-0 text-xs"
                      onClick={() => {
                        window.location.href = notification.action_url!;
                        markAsRead(notification.id);
                      }}
                    >
                      {notification.action_label || 'View details'}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => markAsRead(notification.id)}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteNotification(notification.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
