'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Loop {
  id: string;
  loop_name: string;
  description: string | null;
  is_active: boolean;
  execution_interval_hours: number;
  execution_interval_minutes: number | null;
  min_accounts: number;
  max_accounts: number;
  executor_account_ids: string[] | null;
  allowed_account_tags: string[] | null;
  reply_template_id: string | null;
  reply_delay_min_minutes: number | null;
  reply_delay_max_minutes: number | null;
  jitter_min_minutes: number | null;
  jitter_max_minutes: number | null;
  tags: string[] | null;
}

interface LoopFormProps {
  loop?: Loop | null;
  onClose: () => void;
}

export default function LoopForm({ loop, onClose }: LoopFormProps) {
  const [formData, setFormData] = useState({
    loop_name: '',
    description: '',
    execution_interval_minutes: 60,
    min_accounts: 1,
    max_accounts: 3,
    executor_account_ids: [] as string[],
    allowed_account_tags: '',
    reply_delay_min_minutes: 5,
    reply_delay_max_minutes: 15,
    jitter_min_minutes: 0,
    jitter_max_minutes: 5,
    tags: '',
    is_active: true,
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
    if (loop) {
      setFormData({
        loop_name: loop.loop_name,
        description: loop.description || '',
        execution_interval_minutes: loop.execution_interval_minutes || (loop.execution_interval_hours * 60),
        min_accounts: loop.min_accounts,
        max_accounts: loop.max_accounts,
        executor_account_ids: loop.executor_account_ids || [],
        allowed_account_tags: loop.allowed_account_tags ? loop.allowed_account_tags.join(', ') : '',
        reply_delay_min_minutes: loop.reply_delay_min_minutes || 5,
        reply_delay_max_minutes: loop.reply_delay_max_minutes || 15,
        jitter_min_minutes: loop.jitter_min_minutes || 0,
        jitter_max_minutes: loop.jitter_max_minutes || 5,
        tags: loop.tags ? loop.tags.join(', ') : '',
        is_active: loop.is_active,
      });
    }
  }, [loop]);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('main_accounts')
        .select('id, handle, name, is_active')
        .eq('is_active', true)
        .order('handle');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  const toggleAccountSelection = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      executor_account_ids: prev.executor_account_ids.includes(accountId)
        ? prev.executor_account_ids.filter(id => id !== accountId)
        : [...prev.executor_account_ids, accountId]
    }));
  };

  const selectAllAccounts = () => {
    setFormData(prev => ({
      ...prev,
      executor_account_ids: accounts.map(a => a.id)
    }));
  };

  const deselectAllAccounts = () => {
    setFormData(prev => ({
      ...prev,
      executor_account_ids: []
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const allowedAccountTags = formData.allowed_account_tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const payload = {
        loop_name: formData.loop_name,
        description: formData.description || null,
        execution_interval_minutes: formData.execution_interval_minutes,
        min_accounts: formData.min_accounts,
        max_accounts: formData.max_accounts,
        executor_account_ids: formData.executor_account_ids.length > 0 ? formData.executor_account_ids : null,
        allowed_account_tags: allowedAccountTags.length > 0 ? allowedAccountTags : null,
        reply_delay_min_minutes: formData.reply_delay_min_minutes,
        reply_delay_max_minutes: formData.reply_delay_max_minutes,
        jitter_min_minutes: formData.jitter_min_minutes,
        jitter_max_minutes: formData.jitter_max_minutes,
        tags: tags.length > 0 ? tags : null,
        is_active: formData.is_active,
        user_id: user.id,
      };

      if (loop) {
        const { error: updateError } = await supabase
          .from('loops')
          .update(payload)
          .eq('id', loop.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('loops')
          .insert([payload]);

        if (insertError) throw insertError;
      }

      onClose();
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {loop ? 'ループ編集' : '新規ループ作成'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ループ名 *
            </label>
            <input
              type="text"
              required
              value={formData.loop_name}
              onChange={(e) => setFormData({ ...formData, loop_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: デイリー投稿ループ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              説明
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="このループの目的や内容を記述"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              実行間隔（分） *
            </label>
            <input
              type="number"
              min="1"
              max="10080"
              required
              value={formData.execution_interval_minutes}
              onChange={(e) => setFormData({ ...formData, execution_interval_minutes: parseInt(e.target.value) || 60 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              1分〜10080分（7日）の範囲で設定してください
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最小アカウント数 *
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.min_accounts}
                onChange={(e) => setFormData({ ...formData, min_accounts: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最大アカウント数 *
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.max_accounts}
                onChange={(e) => setFormData({ ...formData, max_accounts: parseInt(e.target.value) || 3 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                実行アカウント ({formData.executor_account_ids.length}件選択中)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllAccounts}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  すべて選択
                </button>
                <button
                  type="button"
                  onClick={deselectAllAccounts}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                >
                  選択解除
                </button>
              </div>
            </div>
            <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
              {accounts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  有効なアカウントがありません
                </p>
              ) : (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <label
                      key={account.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.executor_account_ids.includes(account.id)}
                        onChange={() => toggleAccountSelection(account.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        @{account.handle}
                      </span>
                      {account.name && (
                        <span className="text-xs text-gray-500">
                          ({account.name})
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              許可アカウントタグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={formData.allowed_account_tags}
              onChange={(e) => setFormData({ ...formData, allowed_account_tags: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="メイン, 公式"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                リプライ遅延最小（分）
              </label>
              <input
                type="number"
                min="0"
                value={formData.reply_delay_min_minutes}
                onChange={(e) => setFormData({ ...formData, reply_delay_min_minutes: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                リプライ遅延最大（分）
              </label>
              <input
                type="number"
                min="0"
                value={formData.reply_delay_max_minutes}
                onChange={(e) => setFormData({ ...formData, reply_delay_max_minutes: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ジッター最小（分）
              </label>
              <input
                type="number"
                min="0"
                value={formData.jitter_min_minutes}
                onChange={(e) => setFormData({ ...formData, jitter_min_minutes: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ジッター最大（分）
              </label>
              <input
                type="number"
                min="0"
                value={formData.jitter_max_minutes}
                onChange={(e) => setFormData({ ...formData, jitter_max_minutes: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="デイリー, プロモーション"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              このループを有効化する
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '保存中...' : loop ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
