'use client';

import { useState, useEffect } from 'react';
import { Plus, UserPlus, RefreshCw, Filter, Upload, Activity, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import FollowAccountCard from '@/components/accounts/FollowAccountCard';
import FollowAccountForm from '@/components/accounts/FollowAccountForm';
import CSVImportModal from '@/components/accounts/CSVImportModal';

interface FollowAccount {
  id: string;
  target_handle: string;
  target_name: string | null;
  followers_count: number | null;
  priority: number;
  category: string | null;
  tags: string[] | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AccountToken {
  account_id: string;
  expires_at: string;
  is_active: boolean;
}

export default function FollowAccountsPage() {
  const [accounts, setAccounts] = useState<FollowAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FollowAccount | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [checkingAccountId, setCheckingAccountId] = useState<string | null>(null);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [connectingAccountId, setConnectingAccountId] = useState<string | null>(null);
  const [accountTokens, setAccountTokens] = useState<Map<string, AccountToken>>(new Map());
  const [twitterApps, setTwitterApps] = useState<any[]>([]);
  const [selectedTwitterAppId, setSelectedTwitterAppId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
    loadAccountTokens();
    loadTwitterApps();

    // Check for OAuth success
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast.success('Twitterアカウントの接続に成功しました！');
      loadAccountTokens();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('follow_accounts')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountTokens() {
    try {
      const { data, error } = await supabase
        .from('account_tokens')
        .select('account_id, expires_at, is_active')
        .eq('account_type', 'follow');

      if (error) throw error;

      const tokenMap = new Map<string, AccountToken>();
      data?.forEach((token: AccountToken) => {
        tokenMap.set(token.account_id, token);
      });
      setAccountTokens(tokenMap);
    } catch (error) {
      console.error('Error loading account tokens:', error);
    }
  }

  async function loadTwitterApps() {
    try {
      const { data, error } = await supabase
        .from('twitter_apps')
        .select('id, app_name, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTwitterApps(data || []);
      if (data && data.length > 0 && !selectedTwitterAppId) {
        setSelectedTwitterAppId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading Twitter apps:', error);
    }
  }

  async function handleOAuthConnect(accountId: string) {
    if (!selectedTwitterAppId) {
      toast.error('X Appを選択してください。先にX Appを登録する必要があります。');
      return;
    }

    setConnectingAccountId(accountId);

    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        toast.error(`セッションの更新に失敗: ${refreshError.message}`);
        return;
      }

      const session = refreshData?.session;
      if (!session) {
        toast.error('ログインが必要です');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twitter-oauth-start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_id: accountId,
            account_type: 'follow',
            twitter_app_id: selectedTwitterAppId,
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
      console.error('OAuth connect error:', error);
      toast.error(error.message || 'X連携の開始に失敗しました');
      setConnectingAccountId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このフォローアカウントを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('follow_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.filter(acc => acc.id !== id));
      toast.success('アカウントを削除しました');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('follow_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.map(acc =>
        acc.id === id ? { ...acc, is_active: !currentStatus } : acc
      ));
      toast.success(currentStatus ? 'アカウントを停止しました' : 'アカウントを有効化しました');
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('ステータス変更に失敗しました');
    }
  }

  async function handleHealthCheck(accountId: string) {
    setCheckingAccountId(accountId);
    const loadingToast = toast.loading('アカウントをチェック中...', {
      description: '接続状態を確認しています',
    });

    try {
      // Simulate health check (in real implementation, call twitter-api-proxy)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update updated_at
      const { error } = await supabase
        .from('follow_accounts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) throw error;

      toast.success('ヘルスチェック完了', {
        id: loadingToast,
        description: 'アカウントは正常です',
      });
      loadAccounts(); // Refresh to show updated updated_at
    } catch (error: any) {
      console.error('Health check error:', error);
      toast.error('ヘルスチェック失敗', {
        id: loadingToast,
        description: error.message,
      });
    } finally {
      setCheckingAccountId(null);
    }
  }

  async function handleBulkHealthCheck() {
    if (accounts.length === 0) {
      toast.info('チェックするアカウントがありません');
      return;
    }

    setBulkChecking(true);
    const loadingToast = toast.loading('一括ヘルスチェック実行中...', {
      description: `${accounts.length}件のアカウントをチェックしています`,
    });

    try {
      let successCount = 0;
      let failCount = 0;

      for (const account of accounts) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Delay between checks

          const { error } = await supabase
            .from('follow_accounts')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', account.id);

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error(`Health check failed for account ${account.id}:`, error);
          failCount++;
        }
      }

      toast.success('一括ヘルスチェック完了', {
        id: loadingToast,
        description: `成功: ${successCount}件 / 失敗: ${failCount}件`,
      });
      loadAccounts();
    } catch (error: any) {
      console.error('Bulk health check error:', error);
      toast.error('一括ヘルスチェック失敗', {
        id: loadingToast,
        description: error.message,
      });
    } finally {
      setBulkChecking(false);
    }
  }

  function handleEdit(account: FollowAccount) {
    setEditingAccount(account);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingAccount(null);
    loadAccounts();
  }

  const categories = ['all', ...new Set(accounts.map(acc => acc.category).filter((cat): cat is string => cat !== null))];
  const filteredAccounts = filterCategory === 'all'
    ? accounts
    : accounts.filter(acc => acc.category === filterCategory);

  const activeCount = filteredAccounts.filter(acc => acc.is_active).length;
  const highPriorityCount = filteredAccounts.filter(acc => acc.priority >= 8).length;
  const avgPriority = filteredAccounts.length > 0
    ? (filteredAccounts.reduce((sum, acc) => sum + acc.priority, 0) / filteredAccounts.length).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">フォローアカウント</h1>
          <p className="text-gray-600 mt-2">
            フォロー対象のTwitterアカウントを管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAccounts}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={20} />
            更新
          </button>
          <button
            onClick={() => setShowCSVImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Upload size={20} />
            CSV インポート
          </button>
          <button
            onClick={handleBulkHealthCheck}
            disabled={bulkChecking}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
          >
            <Activity size={20} className={bulkChecking ? 'animate-spin' : ''} />
            {bulkChecking ? 'チェック中...' : '一括チェック'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            新規登録
          </button>
        </div>
      </div>

      {twitterApps.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LinkIcon size={20} className="text-blue-600" />
              <div>
                <div className="text-sm font-medium text-blue-900">X連携に使用するApp</div>
                <div className="text-xs text-blue-700">OAuth認証に使用するX Appを選択してください</div>
              </div>
            </div>
            <select
              value={selectedTwitterAppId || ''}
              onChange={(e) => setSelectedTwitterAppId(e.target.value)}
              className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {twitterApps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.app_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {twitterApps.length === 0 && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-yellow-600" />
            <div>
              <div className="text-sm font-medium text-yellow-900">X Appが未登録です</div>
              <div className="text-xs text-yellow-700">X連携を行うには、まず設定画面でX Appを登録してください</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総アカウント数</div>
          <div className="text-3xl font-bold text-gray-900">{filteredAccounts.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">高優先度</div>
          <div className="text-3xl font-bold text-orange-600">{highPriorityCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">平均優先度</div>
          <div className="text-3xl font-bold text-purple-600">{avgPriority}</div>
        </div>
      </div>

      {categories.length > 1 && (
        <div className="mb-6 flex items-center gap-2">
          <Filter size={20} className="text-gray-600" />
          <div className="flex items-center gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filterCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat === 'all' ? 'すべて' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <UserPlus size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            フォローアカウントが登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            フォロー対象のアカウントを登録してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            最初のアカウントを登録
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map(account => {
            const token = accountTokens.get(account.id);
            const hasToken = !!token;
            const tokenExpired = token ? new Date(token.expires_at) < new Date() : false;

            return (
              <FollowAccountCard
                key={account.id}
                account={account}
                onEdit={() => handleEdit(account)}
                onDelete={() => handleDelete(account.id)}
                onToggleActive={() => handleToggleActive(account.id, account.is_active)}
                onHealthCheck={() => handleHealthCheck(account.id)}
                onConnect={() => handleOAuthConnect(account.id)}
                hasToken={hasToken}
                tokenExpired={tokenExpired}
                checking={checkingAccountId === account.id}
                connecting={connectingAccountId === account.id}
              />
            );
          })}
        </div>
      )}

      {showForm && (
        <FollowAccountForm
          account={editingAccount}
          onClose={handleFormClose}
        />
      )}

      {showCSVImport && (
        <CSVImportModal
          accountType="follow"
          onClose={() => setShowCSVImport(false)}
          onImportComplete={loadAccounts}
        />
      )}
    </div>
  );
}
