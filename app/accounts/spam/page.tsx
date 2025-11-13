'use client';

import { useState, useEffect } from 'react';
import { Plus, UsersRound, RefreshCw, Upload, CheckCircle, XCircle, Search, Filter, AlertTriangle, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SpamAccount {
  id: string;
  handle: string;
  name: string;
  proxy_id: string | null;
  is_active: boolean;
  last_used_at: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface AccountWithProxy extends SpamAccount {
  proxy_url?: string;
  token_status?: 'active' | 'expired' | 'missing';
  token_expires_at?: string | null;
}

export default function SpamAccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [proxyFilter, setProxyFilter] = useState<'all' | 'with_proxy' | 'without_proxy'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();

    // Check for OAuth success
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      setSuccessMessage('Twitterアカウントの接続に成功しました！');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [filter, proxyFilter]);

  async function loadAccounts() {
    try {
      setLoading(true);

      let query = supabase
        .from('spam_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (proxyFilter === 'with_proxy') {
        query = query.not('proxy_id', 'is', null);
      } else if (proxyFilter === 'without_proxy') {
        query = query.is('proxy_id', null);
      }

      const { data: accountsData, error: accountsError } = await query;

      if (accountsError) throw accountsError;

      // Load proxy info and token status for accounts
      const accountsWithProxies = await Promise.all(
        (accountsData || []).map(async (account) => {
          // Load proxy info
          let proxy_url = undefined;
          if (account.proxy_id) {
            const { data: proxy } = await supabase
              .from('proxies')
              .select('proxy_url')
              .eq('id', account.proxy_id)
              .single();
            proxy_url = proxy?.proxy_url || undefined;
          }

          // Load token status
          const { data: token } = await supabase
            .from('account_tokens')
            .select('expires_at')
            .eq('account_id', account.id)
            .eq('account_type', 'spam')
            .single();

          let token_status: 'active' | 'expired' | 'missing' = 'missing';
          if (token) {
            const expiresAt = new Date(token.expires_at);
            token_status = expiresAt > new Date() ? 'active' : 'expired';
          }

          return {
            ...account,
            proxy_url,
            token_status,
            token_expires_at: token?.expires_at || null,
          };
        })
      );

      setAccounts(accountsWithProxies);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このスパムアカウントを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('spam_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.filter(acc => acc.id !== id));
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('spam_accounts')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.map(acc =>
        acc.id === id ? { ...acc, is_active: !currentStatus } : acc
      ));
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('ステータス変更に失敗しました');
    }
  }

  async function handleConnectTwitter() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      // Call OAuth start endpoint with account_type parameter
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twitter-oauth-start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_type: 'spam', // Specify this is for spam accounts
            redirect_to: `${window.location.origin}/accounts/spam?connected=1`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'OAuth開始に失敗しました');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('OAuth error:', error);
      alert(`Twitterアカウント連携に失敗しました: ${error.message}`);
    }
  }

  async function validateAllTokens() {
    setImportLoading(true);
    try {
      // Call Edge Function to validate tokens
      const { data, error } = await supabase.functions.invoke('validate-and-refresh-tokens', {
        body: { account_type: 'spam' },
      });

      if (error) throw error;

      setSuccessMessage(`トークン検証完了: ${data.valid_count}個有効、${data.invalid_count}個無効`);
      setTimeout(() => setSuccessMessage(null), 5000);
      loadAccounts();
    } catch (error) {
      console.error('Token validation error:', error);
      alert('トークン検証に失敗しました');
    } finally {
      setImportLoading(false);
    }
  }

  async function handleCSVImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());

      // Validate headers
      const requiredHeaders = ['handle', 'name'];
      const hasRequiredHeaders = requiredHeaders.every(h =>
        headers.some(header => header.toLowerCase() === h)
      );

      if (!hasRequiredHeaders) {
        alert('CSVファイルには handle, name 列が必要です');
        return;
      }

      const importData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 2) continue;

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header.toLowerCase()] = values[index] || '';
        });

        importData.push({
          handle: rowData.handle.replace('@', ''),
          name: rowData.name,
          tags: rowData.tags ? rowData.tags.split(';').filter((t: string) => t) : [],
        });
      }

      // Bulk insert
      const { data, error } = await supabase
        .from('spam_accounts')
        .insert(importData)
        .select();

      if (error) throw error;

      setSuccessMessage(`${data.length}件のアカウントをインポートしました`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowImport(false);
      loadAccounts();
    } catch (error) {
      console.error('Import error:', error);
      alert('インポートに失敗しました。CSVフォーマットを確認してください。');
    } finally {
      setImportLoading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  }

  // Filter accounts by search query
  const filteredAccounts = accounts.filter(account =>
    account.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const activeCount = accounts.filter(acc => acc.is_active).length;
  const withProxyCount = accounts.filter(acc => acc.proxy_id).length;
  const tokenActiveCount = accounts.filter(acc => acc.token_status === 'active').length;
  const recentlyUsedCount = accounts.filter(acc => {
    if (!acc.last_used_at) return false;
    const daysSince = (Date.now() - new Date(acc.last_used_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }).length;

  function formatLastUsed(dateString?: string | null) {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('ja-JP');
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {successMessage && (
        <Card className="mb-6 p-4 bg-green-900/20 border-green-700 text-green-400">
          {successMessage}
        </Card>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <UsersRound className="h-8 w-8" />
              スパムアカウント
            </h1>
            <p className="text-muted-foreground mt-1">
              {accounts.length} アカウント | {activeCount} アクティブ | {tokenActiveCount} トークン有効
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={validateAllTokens} variant="outline" size="sm" disabled={importLoading}>
              <CheckCircle className={cn('h-4 w-4 mr-2', importLoading && 'animate-spin')} />
              トークン検証
            </Button>
            <Button onClick={() => setShowImport(!showImport)} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              CSV インポート
            </Button>
            <Button onClick={loadAccounts} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              更新
            </Button>
            <Button onClick={handleConnectTwitter} variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
              <UserPlus className="h-4 w-4 mr-2" />
              Twitterアカウントを連携
            </Button>
            <Button onClick={() => setShowForm(true)} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              手動登録
            </Button>
          </div>
        </div>

        {/* CSV Import Section */}
        {showImport && (
          <Card className="p-4 mb-4">
            <h3 className="font-semibold mb-2">CSV一括インポート</h3>
            <p className="text-sm text-muted-foreground mb-3">
              CSVフォーマット: handle, name, tags
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              disabled={importLoading}
            />
            {importLoading && (
              <p className="text-sm text-muted-foreground mt-2">インポート中...</p>
            )}
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="アカウント検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

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
              variant={proxyFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setProxyFilter('all')}
            >
              すべて
            </Button>
            <Button
              variant={proxyFilter === 'with_proxy' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setProxyFilter('with_proxy')}
            >
              プロキシあり
            </Button>
            <Button
              variant={proxyFilter === 'without_proxy' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setProxyFilter('without_proxy')}
            >
              プロキシなし
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">総アカウント数</div>
          <div className="text-3xl font-bold">{accounts.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">プロキシ割当済み</div>
          <div className="text-3xl font-bold text-blue-600">{withProxyCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">最近使用（7日以内）</div>
          <div className="text-3xl font-bold text-purple-600">{recentlyUsedCount}</div>
        </Card>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <Card className="p-12 text-center">
          <UsersRound className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? 'アカウントが見つかりません' : 'スパムアカウントが登録されていません'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? '検索条件を変更してください' : 'スパムアカウントを登録してください'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              最初のアカウントを登録
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAccounts.map(account => (
            <Card key={account.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-lg">@{account.handle}</h3>
                      <p className="text-sm text-muted-foreground">{account.name}</p>
                    </div>
                    {account.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white">
                        アクティブ
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-500 text-white">
                        非アクティブ
                      </span>
                    )}
                    {account.proxy_id ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        プロキシあり
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-500 text-white flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        プロキシなし
                      </span>
                    )}
                    {account.token_status === 'active' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        トークン有効
                      </span>
                    )}
                    {account.token_status === 'expired' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange-500 text-white flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        トークン期限切れ
                      </span>
                    )}
                    {account.token_status === 'missing' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500 text-white flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        トークンなし
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    {account.proxy_url && (
                      <span className="font-mono text-xs">
                        プロキシ: {account.proxy_url}
                      </span>
                    )}
                    <span>
                      最終使用: {formatLastUsed(account.last_used_at)}
                    </span>
                  </div>

                  {account.tags && account.tags.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {account.tags.map((tag) => (
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
                    onClick={() => handleToggleActive(account.id, account.is_active)}
                    title={account.is_active ? '非アクティブ化' : 'アクティブ化'}
                  >
                    {account.is_active ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(account.id)}
                    title="削除"
                    className="text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Placeholder */}
      {showForm && (
        <>
          <Card className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl p-6 z-50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">アカウントを追加</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              アカウント追加フォームは次のコミットで実装されます
            </div>
          </Card>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowForm(false)}
          />
        </>
      )}
    </div>
  );
}
