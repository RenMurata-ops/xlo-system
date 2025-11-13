'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Globe,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCw,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ProxyForm from '@/components/proxies/ProxyForm';

interface Proxy {
  id: string;
  proxy_type: 'nordvpn' | 'http' | 'https' | 'socks5';
  proxy_url: string;
  username?: string | null;
  password?: string | null;
  country?: string | null;
  city?: string | null;
  is_active: boolean;
  response_time_ms?: number | null;
  last_checked_at?: string | null;
  error_message?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
}

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadProxies();
  }, [filter, typeFilter]);

  async function loadProxies() {
    try {
      setLoading(true);

      let query = supabase
        .from('proxies')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (typeFilter !== 'all') {
        query = query.eq('proxy_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setProxies(data || []);
    } catch (error) {
      console.error('Failed to load proxies:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProxy(id: string) {
    if (!confirm('このプロキシを削除してもよろしいですか？')) {
      return;
    }

    try {
      const { error } = await supabase.from('proxies').delete().eq('id', id);

      if (error) throw error;

      setProxies((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Failed to delete proxy:', error);
      alert('削除に失敗しました。アカウントに割り当てられている可能性があります。');
    }
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('proxies')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setProxies((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !currentStatus } : p))
      );
    } catch (error) {
      console.error('Failed to toggle proxy status:', error);
    }
  }

  function getProxyTypeBadge(type: string) {
    const colors = {
      nordvpn: 'bg-blue-500',
      http: 'bg-green-500',
      https: 'bg-purple-500',
      socks5: 'bg-orange-500',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded text-xs text-white font-medium',
          colors[type as keyof typeof colors] || 'bg-gray-500'
        )}
      >
        {type.toUpperCase()}
      </span>
    );
  }

  function formatLastChecked(dateString?: string | null) {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  const activeCount = proxies.filter((p) => p.is_active).length;
  const healthyCount = proxies.filter(
    (p) => p.is_active && !p.error_message
  ).length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Globe className="h-8 w-8" />
              プロキシ管理
            </h1>
            <p className="text-muted-foreground mt-1">
              {proxies.length} プロキシ | {activeCount} アクティブ | {healthyCount}{' '}
              正常
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => loadProxies()}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw
                className={cn('h-4 w-4 mr-2', loading && 'animate-spin')}
              />
              更新
            </Button>
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              プロキシ追加
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              すべて
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              アクティブ
            </Button>
            <Button
              variant={filter === 'inactive' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('inactive')}
            >
              非アクティブ
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={typeFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('all')}
            >
              すべてのタイプ
            </Button>
            <Button
              variant={typeFilter === 'nordvpn' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('nordvpn')}
            >
              NordVPN
            </Button>
            <Button
              variant={typeFilter === 'http' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('http')}
            >
              HTTP
            </Button>
            <Button
              variant={typeFilter === 'https' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('https')}
            >
              HTTPS
            </Button>
            <Button
              variant={typeFilter === 'socks5' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('socks5')}
            >
              SOCKS5
            </Button>
          </div>
        </div>
      </div>

      {/* Proxy List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          プロキシを読み込み中...
        </div>
      ) : proxies.length === 0 ? (
        <Card className="p-12 text-center">
          <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">プロキシが見つかりません</h3>
          <p className="text-muted-foreground mb-4">
            最初のプロキシを追加して始めましょう
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            プロキシ追加
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proxies.map((proxy) => (
            <Card key={proxy.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Globe className="h-4 w-4" />
                    {getProxyTypeBadge(proxy.proxy_type)}
                    <code className="text-sm font-mono bg-secondary px-2 py-1 rounded break-all">
                      {proxy.proxy_url}
                    </code>
                    {proxy.is_active ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    {proxy.country && (
                      <span>
                        📍 {proxy.country}
                        {proxy.city && `, ${proxy.city}`}
                      </span>
                    )}
                    {proxy.response_time_ms && (
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {proxy.response_time_ms}ms
                      </span>
                    )}
                    <span>
                      最終確認: {formatLastChecked(proxy.last_checked_at)}
                    </span>
                  </div>

                  {proxy.error_message && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span>{proxy.error_message}</span>
                    </div>
                  )}

                  {proxy.tags && proxy.tags.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {proxy.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded bg-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingProxy(proxy)}
                    title="編集"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(proxy.id, proxy.is_active)}
                    title={proxy.is_active ? '非アクティブ化' : 'アクティブ化'}
                  >
                    {proxy.is_active ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteProxy(proxy.id)}
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {(showForm || editingProxy) && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => {
            setShowForm(false);
            setEditingProxy(null);
          }} />
          <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50">
            <ProxyForm
              proxy={editingProxy}
              onClose={() => {
                setShowForm(false);
                setEditingProxy(null);
                loadProxies();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
