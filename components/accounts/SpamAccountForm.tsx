'use client';

import { useState, useEffect } from 'react';
import { X, Shuffle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SpamAccount {
  id: string;
  handle: string;
  name: string | null;
  proxy_id: string | null;
  is_active: boolean;
  ban_status: 'active' | 'shadowban' | 'suspended' | 'unknown';
  notes: string | null;
  tags: string[] | null;
}

interface SpamAccountFormProps {
  account?: SpamAccount | null;
  onClose: () => void;
}

export default function SpamAccountForm({ account, onClose }: SpamAccountFormProps) {
  const [formData, setFormData] = useState({
    handle: '',
    name: '',
    proxy_id: '',
    ban_status: 'active' as 'active' | 'shadowban' | 'suspended' | 'unknown',
    tags: '',
    notes: '',
    is_active: true,
  });
  const [proxies, setProxies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigningProxy, setAssigningProxy] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadProxies();
    if (account) {
      setFormData({
        handle: account.handle,
        name: account.name || '',
        proxy_id: account.proxy_id || '',
        ban_status: account.ban_status,
        tags: account.tags ? account.tags.join(', ') : '',
        notes: account.notes || '',
        is_active: account.is_active,
      });
    }
  }, [account]);

  async function loadProxies() {
    try {
      const { data, error } = await supabase
        .from('proxies')
        .select('id, proxy_name, is_active')
        .eq('is_active', true)
        .order('proxy_name');

      if (error) throw error;
      setProxies(data || []);
    } catch (error) {
      console.error('Error loading proxies:', error);
    }
  }

  async function handleAutoAssignProxy() {
    setAssigningProxy(true);
    const loadingToast = toast.loading('プロキシを自動割当中...', {
      description: 'ラウンドロビン方式で選択しています',
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      // Call the get_available_proxy function
      const { data, error } = await supabase.rpc('get_available_proxy', {
        p_user_id: user.id,
        p_strategy: 'round_robin',
      });

      if (error) throw error;
      if (!data) throw new Error('利用可能なプロキシがありません');

      // Update form with selected proxy
      setFormData({ ...formData, proxy_id: data.id });

      toast.success('プロキシを割り当てました', {
        id: loadingToast,
        description: `${data.proxy_name} を選択しました`,
      });
    } catch (error: any) {
      console.error('Auto-assign proxy error:', error);
      toast.error('プロキシの割り当てに失敗しました', {
        id: loadingToast,
        description: error.message,
      });
    } finally {
      setAssigningProxy(false);
    }
  }

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
        handle: formData.handle.replace('@', ''),
        name: formData.name || null,
        proxy_id: formData.proxy_id || null,
        ban_status: formData.ban_status,
        tags: tags.length > 0 ? tags : null,
        notes: formData.notes || null,
        is_active: formData.is_active,
        user_id: user.id,
      };

      if (account) {
        const { error: updateError } = await supabase
          .from('spam_accounts')
          .update(payload)
          .eq('id', account.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('spam_accounts')
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
            {account ? 'スパムアカウント編集' : '新規スパムアカウント登録'}
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
                value={formData.handle}
                onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
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
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="表示名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              プロキシ
            </label>
            <div className="flex items-center gap-2">
              <select
                value={formData.proxy_id}
                onChange={(e) => setFormData({ ...formData, proxy_id: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">プロキシなし</option>
                {proxies.map(proxy => (
                  <option key={proxy.id} value={proxy.id}>
                    {proxy.proxy_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAutoAssignProxy}
                disabled={assigningProxy || proxies.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                title="ラウンドロビン方式で自動割当"
              >
                <Shuffle size={16} className={assigningProxy ? 'animate-spin' : ''} />
                自動割当
              </button>
            </div>
            {proxies.length === 0 && (
              <p className="mt-1 text-sm text-gray-500">
                プロキシを追加してください
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              BANステータス *
            </label>
            <select
              required
              value={formData.ban_status}
              onChange={(e) => setFormData({ ...formData, ban_status: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">正常</option>
              <option value="shadowban">シャドウBAN</option>
              <option value="suspended">凍結</option>
              <option value="unknown">不明</option>
            </select>
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
              placeholder="グループA, 高頻度, テスト用"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              メモ
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="このアカウントについてのメモ..."
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
              このアカウントを有効化する
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
              {loading ? '保存中...' : account ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
