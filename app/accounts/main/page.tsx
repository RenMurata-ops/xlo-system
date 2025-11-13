'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, RefreshCw, Upload, CheckCircle, XCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MainAccount {
  id: string;
  handle: string;
  name: string;
  followers_count: number;
  following_count: number;
  is_active: boolean;
  is_verified: boolean;
  last_activity_at: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface AccountWithToken extends MainAccount {
  token_status?: 'active' | 'expired' | 'missing';
  token_expires_at?: string | null;
}

export default function MainAccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
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
  }, [filter, verifiedFilter]);

  async function loadAccounts() {
    try {
      setLoading(true);

      // Load accounts
      let query = supabase
        .from('main_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (verifiedFilter === 'verified') {
        query = query.eq('is_verified', true);
      } else if (verifiedFilter === 'unverified') {
        query = query.eq('is_verified', false);
      }

      const { data: accountsData, error: accountsError } = await query;

      if (accountsError) throw accountsError;

      // Load token status for each account
      const accountsWithTokens = await Promise.all(
        (accountsData || []).map(async (account) => {
          const { data: token } = await supabase
            .from('account_tokens')
            .select('expires_at')
            .eq('account_id', account.id)
            .eq('account_type', 'main')
            .single();

          let token_status: 'active' | 'expired' | 'missing' = 'missing';
          if (token) {
            const expiresAt = new Date(token.expires_at);
            token_status = expiresAt > new Date() ? 'active' : 'expired';
          }

          return {
            ...account,
            token_status,
            token_expires_at: token?.expires_at || null,
          };
        })
      );

      setAccounts(accountsWithTokens);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このアカウントを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('main_accounts')
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
        .from('main_accounts')
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
          followers_count: parseInt(rowData.followers_count) || 0,
          following_count: parseInt(rowData.following_count) || 0,
          is_verified: rowData.is_verified === 'true' || rowData.is_verified === '1',
          tags: rowData.tags ? rowData.tags.split(';').filter((t: string) => t) : [],
        });
      }

      // Bulk insert
      const { data, error } = await supabase
        .from('main_accounts')
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
            account_type: 'main', // Specify this is for main accounts
            redirect_to: `${window.location.origin}/accounts/main?connected=1`,
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
        body: { account_type: 'main' },
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
  const verifiedCount = accounts.filter(acc => acc.is_verified).length;
  const totalFollowers = accounts.reduce((sum, acc) => sum + (acc.followers_count || 0), 0);
  const tokenActiveCount = accounts.filter(acc => acc.token_status === 'active').length;

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
              <Users className="h-8 w-8" />
              メインアカウント
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
              CSVフォーマット: handle, name, followers_count, following_count, is_verified, tags
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
              variant={verifiedFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setVerifiedFilter('all')}
            >
              すべて
            </Button>
            <Button
              variant={verifiedFilter === 'verified' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setVerifiedFilter('verified')}
            >
              認証済み
            </Button>
            <Button
              variant={verifiedFilter === 'unverified' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setVerifiedFilter('unverified')}
            >
              未認証
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
          <div className="text-sm text-muted-foreground mb-1">認証済み</div>
          <div className="text-3xl font-bold text-blue-600">{verifiedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">総フォロワー数</div>
          <div className="text-3xl font-bold text-purple-600">
            {totalFollowers.toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? 'アカウントが見つかりません' : 'メインアカウントが登録されていません'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? '検索条件を変更してください' : 'まずはTwitterアカウントを登録してください'}
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
                    {account.is_verified && (
                      <CheckCircle className="h-5 w-5 text-blue-500" />
                    )}
                    {account.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white">
                        アクティブ
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-500 text-white">
                        非アクティブ
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
                        <AlertCircle className="h-3 w-3" />
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

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{account.followers_count.toLocaleString()} フォロワー</span>
                    <span>{account.following_count.toLocaleString()} フォロー中</span>
                    {account.last_activity_at && (
                      <span>
                        最終アクティビティ: {new Date(account.last_activity_at).toLocaleDateString('ja-JP')}
                      </span>
                    )}
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
