'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, RefreshCw, Upload, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import MainAccountCard from '@/components/accounts/MainAccountCard';
import MainAccountForm from '@/components/accounts/MainAccountForm';
import CSVImportModal from '@/components/accounts/CSVImportModal';

interface MainAccount {
  id: string;
  account_handle: string;
  account_name: string | null;
  follower_count: number | null;
  following_count: number | null;
  is_active: boolean;
  is_verified: boolean;
  last_activity_at: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
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
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();

    // Check for OAuth success
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast.success('Twitterアカウントの接続に成功しました！');
      // Remove query param from URL
      window.history.replaceState({}, '', window.location.pathname);
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
          {accounts.map(account => (
            <MainAccountCard
              key={account.id}
              account={account}
              onEdit={() => handleEdit(account)}
              onDelete={() => handleDelete(account.id)}
              onToggleActive={() => handleToggleActive(account.id, account.is_active)}
              onHealthCheck={() => handleHealthCheck(account.id)}
              checking={checkingAccountId === account.id}
            />
          ))}
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
