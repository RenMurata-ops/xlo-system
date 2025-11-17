'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Users, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import SpamAccountCard from '@/components/accounts/SpamAccountCard';
import SpamAccountForm from '@/components/accounts/SpamAccountForm';
import SpamAccountBulkImport from '@/components/accounts/SpamAccountBulkImport';

interface SpamAccount {
  id: string;
  account_handle: string;
  account_name: string | null;
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

export default function SpamAccountsPage() {
  const [accounts, setAccounts] = useState<SpamAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SpamAccount | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
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
          {accounts.map(account => (
            <SpamAccountCard
              key={account.id}
              account={account}
              onEdit={() => handleEdit(account)}
              onDelete={() => handleDelete(account.id)}
              onToggleActive={() => handleToggleActive(account.id, account.is_active)}
            />
          ))}
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
    </div>
  );
}
