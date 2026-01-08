'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Proxy {
  id: string;
  proxy_name: string | null;
  proxy_type: 'http' | 'https' | 'socks5' | 'nordvpn';
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  country: string | null;
  is_active: boolean;
  notes: string | null;
}

interface ProxyFormProps {
  proxy?: Proxy | null;
  onClose: () => void;
}

export default function ProxyForm({ proxy, onClose }: ProxyFormProps) {
  const [formData, setFormData] = useState({
    proxy_name: '',
    proxy_type: 'http' as 'http' | 'https' | 'socks5' | 'nordvpn',
    host: '',
    port: 8080,
    username: '',
    password: '',
    country: '',
    notes: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (proxy) {
      setFormData({
        proxy_name: proxy.proxy_name || '',
        proxy_type: proxy.proxy_type,
        host: proxy.host || '',
        port: proxy.port || 8080,
        username: proxy.username || '',
        password: proxy.password || '',
        country: proxy.country || '',
        notes: proxy.notes || '',
        is_active: proxy.is_active,
      });
    }
  }, [proxy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const payload = {
        proxy_name: formData.proxy_name || null,
        proxy_type: formData.proxy_type,
        host: formData.host || null,
        port: formData.port || null,
        proxy_url: `${formData.proxy_type}://${formData.host}:${formData.port}`,
        username: formData.username || null,
        password: formData.password || null,
        country: formData.country || null,
        notes: formData.notes || null,
        is_active: formData.is_active,
        user_id: user.id,
        // test_status and assigned_accounts_count are managed by database defaults/triggers
      };

      if (proxy) {
        const { error: updateError } = await supabase
          .from('proxies')
          .update(payload)
          .eq('id', proxy.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('proxies')
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
            {proxy ? 'プロキシ編集' : '新規プロキシ登録'}
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
              プロキシ名 *
            </label>
            <input
              type="text"
              required
              value={formData.proxy_name}
              onChange={(e) => setFormData({ ...formData, proxy_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: US Proxy 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              プロキシタイプ *
            </label>
            <select
              required
              value={formData.proxy_type}
              onChange={(e) => setFormData({ ...formData, proxy_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ホスト *
              </label>
              <input
                type="text"
                required
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123.45.67.89"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ポート *
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                required
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 8080 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ユーザー名
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="オプション"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="オプション"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              国
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: US, JP, UK"
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
              placeholder="このプロキシについてのメモ..."
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
              このプロキシを有効化する
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
              {loading ? '保存中...' : proxy ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
