'use client';

import { useState, useEffect } from 'react';
import { Plus, UserPlus, RefreshCw, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import FollowAccountCard from '@/components/accounts/FollowAccountCard';
import FollowAccountForm from '@/components/accounts/FollowAccountForm';

interface FollowAccount {
  id: string;
  target_handle: string;
  target_name: string | null;
  follower_count: number | null;
  priority: number;
  category: string | null;
  tags: string[] | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function FollowAccountsPage() {
  const [accounts, setAccounts] = useState<FollowAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FollowAccount | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
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

  async function handleDelete(id: string) {
    if (!confirm('このフォローアカウントを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('follow_accounts')
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
        .from('follow_accounts')
        .update({ is_active: !currentStatus })
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
          {filteredAccounts.map(account => (
            <FollowAccountCard
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
        <FollowAccountForm
          account={editingAccount}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
