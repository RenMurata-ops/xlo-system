'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface TokenStatus {
  id: string;
  x_username: string;
  account_type: string;
  expires_at: string;
  last_refreshed_at: string | null;
  refresh_count: number;
  is_active: boolean;
}

export default function TokenStatusCard() {
  const [tokens, setTokens] = useState<TokenStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    loadTokens();
    // Auto-refresh status every 5 minutes
    const interval = setInterval(loadTokens, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadTokens() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('account_tokens')
        .select('id, x_username, account_type, expires_at, last_refreshed_at, refresh_count, is_active')
        .eq('user_id', user.id)
        .eq('token_type', 'oauth2')
        .order('expires_at', { ascending: true });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualRefresh() {
    try {
      setRefreshing(true);
      setLastRefreshResult(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/refresh-tokens`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      setLastRefreshResult(result);

      if (result.ok) {
        if (result.refreshed > 0) {
          toast.success(`${result.refreshed}件のトークンを更新しました`);
        } else {
          toast.info('更新が必要なトークンはありません');
        }
        // Reload token list
        await loadTokens();
      } else {
        toast.error(result.error || 'リフレッシュに失敗しました');
      }
    } catch (error: any) {
      console.error('Manual refresh error:', error);
      toast.error('リフレッシュに失敗しました');
    } finally {
      setRefreshing(false);
    }
  }

  function getTokenStatus(token: TokenStatus) {
    if (!token.is_active) {
      return { status: 'inactive', label: '無効', color: 'text-gray-500', icon: XCircle };
    }

    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 0) {
      return { status: 'expired', label: '期限切れ', color: 'text-red-600', icon: XCircle };
    } else if (hoursUntilExpiry < 1) {
      return { status: 'expiring', label: 'まもなく期限切れ', color: 'text-yellow-600', icon: AlertTriangle };
    } else {
      return { status: 'valid', label: '有効', color: 'text-green-600', icon: CheckCircle };
    }
  }

  function formatTimeUntilExpiry(expiresAt: string) {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs < 0) {
      return '期限切れ';
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}日後`;
    } else if (hours > 0) {
      return `${hours}時間${minutes}分後`;
    } else {
      return `${minutes}分後`;
    }
  }

  function formatLastRefresh(lastRefreshedAt: string | null) {
    if (!lastRefreshedAt) return '未更新';

    const date = new Date(lastRefreshedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));

    if (minutes < 1) {
      return 'たった今';
    } else if (minutes < 60) {
      return `${minutes}分前`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours}時間前`;
    }
  }

  const activeTokens = tokens.filter(t => t.is_active);
  const expiringTokens = tokens.filter(t => {
    if (!t.is_active) return false;
    const hoursUntilExpiry = (new Date(t.expires_at).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 1 && hoursUntilExpiry > 0;
  });

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">トークンステータス</h3>
            <p className="text-sm text-gray-400 mt-1">
              X API認証トークンの状態（30分ごとに自動更新）
            </p>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '更新中...' : '手動リフレッシュ'}
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-white">{activeTokens.length}</div>
            <div className="text-xs text-gray-400">アクティブ</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-500">{expiringTokens.length}</div>
            <div className="text-xs text-gray-400">まもなく期限切れ</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-white">
              {tokens.reduce((sum, t) => sum + (t.refresh_count || 0), 0)}
            </div>
            <div className="text-xs text-gray-400">総リフレッシュ回数</div>
          </div>
        </div>
      </div>

      {/* Last Refresh Result */}
      {lastRefreshResult && (
        <div className={`px-6 py-3 border-b border-gray-700 ${
          lastRefreshResult.ok ? 'bg-green-900/30' : 'bg-red-900/30'
        }`}>
          <div className="flex items-center gap-2">
            {lastRefreshResult.ok ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : (
              <XCircle size={16} className="text-red-500" />
            )}
            <span className={`text-sm ${
              lastRefreshResult.ok ? 'text-green-400' : 'text-red-400'
            }`}>
              {lastRefreshResult.message || lastRefreshResult.error}
            </span>
          </div>
        </div>
      )}

      {/* Token List */}
      <div className="divide-y divide-gray-700">
        {tokens.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            連携されているアカウントがありません
          </div>
        ) : (
          tokens.map(token => {
            const status = getTokenStatus(token);
            const StatusIcon = status.icon;

            return (
              <div key={token.id} className="p-4 hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon size={20} className={status.color} />
                    <div>
                      <div className="font-medium text-white">
                        @{token.x_username}
                      </div>
                      <div className="text-xs text-gray-400">
                        {token.account_type === 'main' ? 'メイン' :
                         token.account_type === 'spam' ? 'スパム' : 'フォロー'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${status.color}`}>
                      {status.label}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
                      {formatTimeUntilExpiry(token.expires_at)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>最終更新: {formatLastRefresh(token.last_refreshed_at)}</span>
                  <span>更新回数: {token.refresh_count || 0}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
