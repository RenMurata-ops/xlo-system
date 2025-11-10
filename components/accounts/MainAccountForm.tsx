'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MainAccount {
  id: string;
  account_handle: string;
  account_name: string | null;
  follower_count: number | null;
  following_count: number | null;
  is_active: boolean;
  is_verified: boolean;
  tags: string[] | null;
}

interface MainAccountFormProps {
  account?: MainAccount | null;
  onClose: () => void;
}

export default function MainAccountForm({ account, onClose }: MainAccountFormProps) {
  const [formData, setFormData] = useState({
    account_handle: '',
    account_name: '',
    follower_count: 0,
    following_count: 0,
    is_active: true,
    is_verified: false,
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (account) {
      setFormData({
        account_handle: account.account_handle,
        account_name: account.account_name || '',
        follower_count: account.follower_count || 0,
        following_count: account.following_count || 0,
        is_active: account.is_active,
        is_verified: account.is_verified,
        tags: account.tags ? account.tags.join(', ') : '',
      });
    }
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const payload = {
        account_handle: formData.account_handle.replace('@', ''),
        account_name: formData.account_name || null,
        follower_count: formData.follower_count || null,
        following_count: formData.following_count || null,
        is_active: formData.is_active,
        is_verified: formData.is_verified,
        tags: tags.length > 0 ? tags : null,
        user_id: user.id,
      };

      if (account) {
        const { error: updateError } = await supabase
          .from('main_accounts')
          .update(payload)
          .eq('id', account.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('main_accounts')
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
            {account ? 'アカウント編集' : '新規アカウント登録'}
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
              アカウントハンドル *
            </label>
            <div className="flex items-center">
              <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-600">
                @
              </span>
              <input
                type="text"
                required
                value={formData.account_handle}
                onChange={(e) => setFormData({ ...formData, account_handle: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              アカウント名
            </label>
            <input
              type="text"
              value={formData.account_name}
              onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="表示名"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                フォロワー数
              </label>
              <input
                type="number"
                min="0"
                value={formData.follower_count}
                onChange={(e) => setFormData({ ...formData, follower_count: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                フォロー中
              </label>
              <input
                type="number"
                min="0"
                value={formData.following_count}
                onChange={(e) => setFormData({ ...formData, following_count: parseInt(e.target.value) || 0 })}
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
              placeholder="メイン, 公式, プロモーション"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                このアカウントを有効化する
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_verified"
                checked={formData.is_verified}
                onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_verified" className="text-sm font-medium text-gray-700">
                認証済みアカウント
              </label>
            </div>
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
              {loading ? '保存中...' : account ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
