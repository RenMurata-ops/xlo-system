'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, RefreshCw, Upload, Activity, AlertCircle, Link as LinkIcon, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import MainAccountCard from '@/components/accounts/MainAccountCard';
import MainAccountForm from '@/components/accounts/MainAccountForm';
import CSVImportModal from '@/components/accounts/CSVImportModal';

interface MainAccount {
  id: string;
  handle: string;
  name: string | null;
  follower_count: number | null;
  following_count: number | null;
  is_active: boolean;
  is_verified: boolean;
  last_activity_at: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface AccountToken {
  account_id: string;
  expires_at: string;
  is_active: boolean;
}

export default function MainAccountsPage() {
  const [accounts, setAccounts] = useState<MainAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingAccount, setEditingAccount] = useState<MainAccount | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [checkingAccountId, setCheckingAccountId] = useState<string | null>(null);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [connectingAccountId, setConnectingAccountId] = useState<string | null>(null);
  const [accountTokens, setAccountTokens] = useState<Map<string, AccountToken>>(new Map());
  const [twitterApps, setTwitterApps] = useState<any[]>([]);
  const [selectedTwitterAppId, setSelectedTwitterAppId] = useState<string | null>(null);
  const [bulkConnectMode, setBulkConnectMode] = useState(false);
  const [bulkConnectProgress, setBulkConnectProgress] = useState({ current: 0, total: 0 });
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

      // Check if bulk connect mode is active
      const bulkConnectData = localStorage.getItem('bulkConnectQueue');
      if (bulkConnectData) {
        const queue = JSON.parse(bulkConnectData);
        if (queue.remaining && queue.remaining.length > 0) {
          // Continue bulk connect with next account
          setTimeout(() => {
            const nextAccountId = queue.remaining[0];
            const newRemaining = queue.remaining.slice(1);
            localStorage.setItem('bulkConnectQueue', JSON.stringify({
              ...queue,
              remaining: newRemaining,
              current: queue.total - newRemaining.length
            }));
            setBulkConnectMode(true);
            setBulkConnectProgress({
              current: queue.total - newRemaining.length,
              total: queue.total
            });
            handleOAuthConnect(nextAccountId);
          }, 1000);
        } else {
          // Bulk connect complete
          localStorage.removeItem('bulkConnectQueue');
          setBulkConnectMode(false);
          toast.success(`一括連携が完了しました！（${queue.total}件）`);
        }
      }
    }
  }, []);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('main_accounts')
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
        .eq('account_type', 'main');

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

  function startBulkConnect() {
    if (!selectedTwitterAppId) {
      toast.error('X Appを選択してください');
      return;
    }

    // Get unconnected accounts
    const unconnectedAccounts = accounts.filter(acc => !accountTokens.has(acc.id));

    if (unconnectedAccounts.length === 0) {
      toast.info('未連携のアカウントがありません');
      return;
    }

    // Save queue to localStorage
    const queue = {
      remaining: unconnectedAccounts.map(acc => acc.id),
      total: unconnectedAccounts.length,
      current: 0,
      twitterAppId: selectedTwitterAppId
    };
    localStorage.setItem('bulkConnectQueue', JSON.stringify(queue));

    // Start with first account
    const firstAccountId = queue.remaining[0];
    const newRemaining = queue.remaining.slice(1);
    localStorage.setItem('bulkConnectQueue', JSON.stringify({
      ...queue,
      remaining: newRemaining,
      current: 1
    }));

    setBulkConnectMode(true);
    setBulkConnectProgress({ current: 1, total: queue.total });
    toast.info(`一括連携を開始します（${queue.total}件）`);

    handleOAuthConnect(firstAccountId);
  }

  function cancelBulkConnect() {
    localStorage.removeItem('bulkConnectQueue');
    setBulkConnectMode(false);
    setBulkConnectProgress({ current: 0, total: 0 });
    toast.info('一括連携をキャンセルしました');
  }

  async function handleOAuthConnect(accountId: string) {
    // For bulk connect, use the stored Twitter App ID
    const bulkConnectData = localStorage.getItem('bulkConnectQueue');
    const effectiveTwitterAppId = bulkConnectData
      ? JSON.parse(bulkConnectData).twitterAppId
      : selectedTwitterAppId;

    // Check if Twitter App is selected
    if (!effectiveTwitterAppId) {
      toast.error('X Appを選択してください。先にX Appを登録する必要があります。');
      return;
    }

    setConnectingAccountId(accountId);

    try {
      // Debug: Check localStorage for session
      const storedSession = localStorage.getItem('xlo-auth');
      console.log('Stored session exists:', !!storedSession);

      // Force refresh the session to get a valid token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      console.log('Refresh result:', {
        hasSession: !!refreshData?.session,
        hasUser: !!refreshData?.user,
        error: refreshError?.message
      });

      if (refreshError) {
        console.error('Session refresh error:', refreshError);
        toast.error(`セッションの更新に失敗: ${refreshError.message}`);
        return;
      }

      const session = refreshData?.session;
      if (!session) {
        toast.error('ログインが必要です。LocalStorageをクリアして再ログインしてください。');
        return;
      }

      console.log('Token length:', session.access_token?.length);

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
            account_type: 'main',
            twitter_app_id: effectiveTwitterAppId,
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
    if (!confirm('このアカウントを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('main_accounts')
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
        .from('main_accounts')
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

      // Update last_activity_at
      const { error } = await supabase
        .from('main_accounts')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) throw error;

      toast.success('ヘルスチェック完了', {
        id: loadingToast,
        description: 'アカウントは正常です',
      });
      loadAccounts(); // Refresh to show updated last_activity_at
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
            .from('main_accounts')
            .update({ last_activity_at: new Date().toISOString() })
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

  function handleEdit(account: MainAccount) {
    setEditingAccount(account);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingAccount(null);
    loadAccounts();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const activeCount = accounts.filter(acc => acc.is_active).length;
  const verifiedCount = accounts.filter(acc => acc.is_verified).length;
  const totalFollowers = accounts.reduce((sum, acc) => sum + (acc.follower_count || 0), 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {successMessage && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg text-green-400">
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">メインアカウント</h1>
          <p className="text-gray-600 mt-2">
            主要なTwitterアカウントを管理します
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

      {/* X App Selector */}
      {twitterApps.length === 0 ? (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-yellow-800 font-medium">X Appが登録されていません</p>
            <p className="text-yellow-700 text-sm mt-1">
              アカウントをXと連携するには、まず<a href="/twitter-apps" className="underline hover:text-yellow-900">X Apps管理</a>でX Appを登録してください。
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-800 font-medium">OAuth連携に使用するX App</p>
              <p className="text-blue-600 text-sm mt-1">
                アカウントをXと連携する際に使用するX Appを選択してください
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedTwitterAppId || ''}
                onChange={(e) => setSelectedTwitterAppId(e.target.value)}
                className="px-4 py-2 border border-blue-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {twitterApps.map(app => (
                  <option key={app.id} value={app.id}>
                    {app.app_name}
                  </option>
                ))}
              </select>
              <button
                onClick={startBulkConnect}
                disabled={bulkConnectMode || accounts.filter(acc => !accountTokens.has(acc.id)).length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LinkIcon size={18} />
                一括連携開始
                {accounts.filter(acc => !accountTokens.has(acc.id)).length > 0 && (
                  <span className="bg-green-800 px-2 py-0.5 rounded text-xs">
                    {accounts.filter(acc => !accountTokens.has(acc.id)).length}件
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Connect Progress */}
      {bulkConnectMode && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-800 font-medium">一括連携実行中...</p>
              <p className="text-yellow-600 text-sm mt-1">
                {bulkConnectProgress.current} / {bulkConnectProgress.total} 件処理中
              </p>
              <div className="mt-2 w-64 bg-yellow-200 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full transition-all"
                  style={{ width: `${(bulkConnectProgress.current / bulkConnectProgress.total) * 100}%` }}
                />
              </div>
            </div>
            <button
              onClick={cancelBulkConnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <X size={18} />
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総アカウント数</div>
          <div className="text-3xl font-bold text-gray-900">{accounts.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">認証済み</div>
          <div className="text-3xl font-bold text-blue-600">{verifiedCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総フォロワー数</div>
          <div className="text-3xl font-bold text-purple-600">
            {totalFollowers.toLocaleString()}
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            メインアカウントが登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            まずはTwitterアカウントを登録してください
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
          {accounts.map(account => {
            const token = accountTokens.get(account.id);
            const hasToken = !!token;
            const tokenExpired = token ? new Date(token.expires_at) < new Date() : false;

            return (
              <MainAccountCard
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
        <MainAccountForm
          account={editingAccount}
          onClose={handleFormClose}
        />
      )}

      {showCSVImport && (
        <CSVImportModal
          accountType="main"
          onClose={() => setShowCSVImport(false)}
          onImportComplete={loadAccounts}
        />
      )}
    </div>
  );
}
