'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Users, Upload, Activity, Shuffle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import SpamAccountCard from '@/components/accounts/SpamAccountCard';
import SpamAccountForm from '@/components/accounts/SpamAccountForm';
import SpamAccountBulkImport from '@/components/accounts/SpamAccountBulkImport';
import CSVImportModal from '@/components/accounts/CSVImportModal';

interface SpamAccount {
  id: string;
  handle: string;
  name: string | null;
  proxy_id: string | null;
  is_active: boolean;
  last_used_at: string | null;
  total_engagements: number;
  success_rate: number | null;
  ban_status: 'active' | 'shadowban' | 'suspended' | 'unknown';
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface AccountToken {
  account_id: string;
  expires_at: string;
  is_active: boolean;
}

export default function SpamAccountsPage() {
  const [accounts, setAccounts] = useState<SpamAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SpamAccount | null>(null);
  const [checkingAccountId, setCheckingAccountId] = useState<string | null>(null);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [bulkAssigningProxies, setBulkAssigningProxies] = useState(false);
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
      const accountId = params.get('account_id');
      toast.success('Twitterアカウントの接続に成功しました！');
      // Reload tokens to reflect the new connection
      loadAccountTokens();
      // Remove query param from URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('spam_accounts')
        .select('*')
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
        .eq('account_type', 'spam');

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
      // Set default selected app if available
      if (data && data.length > 0 && !selectedTwitterAppId) {
        setSelectedTwitterAppId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading Twitter apps:', error);
    }
  }

  async function handleOAuthConnect(accountId: string) {
    // Check if Twitter App is selected
    if (!selectedTwitterAppId) {
      toast.error('X Appを選択してください。先にX Appを登録する必要があります。');
      return;
    }

    setConnectingAccountId(accountId);

    try {
      // Force refresh the session to get a valid token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error('Session refresh error:', refreshError);
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
            account_type: 'spam',
            twitter_app_id: selectedTwitterAppId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'OAuth開始に失敗しました');
      }

      const { authUrl } = await response.json();

      // Redirect to Twitter OAuth
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('OAuth connect error:', error);
      toast.error(error.message || 'X連携の開始に失敗しました');
      setConnectingAccountId(null);
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
      toast.success('アカウントを削除しました');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('spam_accounts')
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

      // Update last_used_at
      const { error } = await supabase
        .from('spam_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) throw error;

      toast.success('ヘルスチェック完了', {
        id: loadingToast,
        description: 'アカウントは正常です',
      });
      loadAccounts(); // Refresh to show updated last_used_at
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
            .from('spam_accounts')
            .update({ last_used_at: new Date().toISOString() })
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

  async function handleBulkAssignProxies() {
    if (accounts.length === 0) {
      toast.info('プロキシを割り当てるアカウントがありません');
      return;
    }

    setBulkAssigningProxies(true);
    const loadingToast = toast.loading('一括プロキシ割当中...', {
      description: `${accounts.length}件のアカウントにプロキシを割り当てています`,
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const accountIds = accounts.map(acc => acc.id);

      // Call bulk_assign_proxies function
      const { data, error } = await supabase.rpc('bulk_assign_proxies', {
        p_account_ids: accountIds,
        p_account_table: 'spam_accounts',
        p_user_id: user.id,
        p_strategy: 'round_robin',
      });

      if (error) throw error;

      const successCount = data?.filter((r: any) => r.success).length || 0;
      const failCount = data?.length - successCount || 0;

      toast.success('一括プロキシ割当完了', {
        id: loadingToast,
        description: `成功: ${successCount}件 / 失敗: ${failCount}件`,
      });

      loadAccounts();
    } catch (error: any) {
      console.error('Bulk proxy assignment error:', error);
      toast.error('一括プロキシ割当失敗', {
        id: loadingToast,
        description: error.message,
      });
    } finally {
      setBulkAssigningProxies(false);
    }
  }

  function handleEdit(account: SpamAccount) {
    setEditingAccount(account);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingAccount(null);
    loadAccounts();
  }

  function handleBulkImportClose() {
    setShowBulkImport(false);
    loadAccounts();
  }

  const activeAccounts = accounts.filter(acc => acc.is_active).length;
  const totalEngagements = accounts.reduce((sum, acc) => sum + acc.total_engagements, 0);
  const avgSuccessRate = accounts.length > 0
    ? (accounts.reduce((sum, acc) => sum + (acc.success_rate || 0), 0) / accounts.length).toFixed(1)
    : '0';
  const bannedAccounts = accounts.filter(acc => acc.ban_status === 'suspended' || acc.ban_status === 'shadowban').length;

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
          <h1 className="text-3xl font-bold text-gray-900">スパムアカウント管理</h1>
          <p className="text-gray-600 mt-2">
            大量エンゲージメント用のアカウントを管理します
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
            onClick={handleBulkAssignProxies}
            disabled={bulkAssigningProxies || accounts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            title="全アカウントにプロキシを自動割当"
          >
            <Shuffle size={20} className={bulkAssigningProxies ? 'animate-spin' : ''} />
            {bulkAssigningProxies ? '割当中...' : 'プロキシ一括割当'}
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 px-4 py-2 text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition"
          >
            <Upload size={20} />
            一括インポート
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総アカウント数</div>
          <div className="text-3xl font-bold text-gray-900">{accounts.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeAccounts}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総エンゲージメント</div>
          <div className="text-3xl font-bold text-blue-600">{totalEngagements.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">BANアカウント</div>
          <div className="text-3xl font-bold text-red-600">{bannedAccounts}</div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            スパムアカウントが登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            エンゲージメント用のアカウントを登録してください
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowBulkImport(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition"
            >
              <Upload size={20} />
              一括インポート
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              最初のアカウントを登録
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(account => {
            const token = accountTokens.get(account.id);
            const hasToken = !!token;
            const tokenExpired = token ? new Date(token.expires_at) < new Date() : false;

            return (
              <SpamAccountCard
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
        <SpamAccountForm
          account={editingAccount}
          onClose={handleFormClose}
        />
      )}

      {showBulkImport && (
        <SpamAccountBulkImport
          onClose={handleBulkImportClose}
        />
      )}

      {showCSVImport && (
        <CSVImportModal
          accountType="spam"
          onClose={() => setShowCSVImport(false)}
          onImportComplete={loadAccounts}
        />
      )}
    </div>
  );
}
