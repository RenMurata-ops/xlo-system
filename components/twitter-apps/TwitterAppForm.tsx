'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import CallbackUrlDisplay from './CallbackUrlDisplay';

interface TwitterApp {
  id: string;
  app_name: string;
  api_key: string;
  api_secret: string;
  bearer_token: string | null;
  client_id: string | null;
  client_secret: string | null;
  is_active: boolean;
}

interface TwitterAppFormProps {
  app?: TwitterApp | null;
  onClose: () => void;
}

export default function TwitterAppForm({ app, onClose }: TwitterAppFormProps) {
  const [formData, setFormData] = useState({
    app_name: '',
    api_key: '',
    api_secret: '',
    bearer_token: '',
    client_id: '',
    client_secret: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (app) {
      setFormData({
        app_name: app.app_name,
        api_key: app.api_key,
        api_secret: app.api_secret,
        bearer_token: app.bearer_token || '',
        client_id: app.client_id || '',
        client_secret: app.client_secret || '',
        is_active: app.is_active,
      });
    }
  }, [app]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const payload = {
        app_name: formData.app_name,
        api_key: formData.api_key,
        api_secret: formData.api_secret,
        bearer_token: formData.bearer_token || null,
        client_id: formData.client_id || null,
        client_secret: formData.client_secret || null,
        is_active: formData.is_active,
        user_id: user.id,
      };

      if (app) {
        const { error: updateError } = await supabase
          .from('twitter_apps')
          .update(payload)
          .eq('id', app.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('twitter_apps')
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 py-8 overflow-y-auto">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">
            {app ? 'Twitter App編集' : '新規Twitter App連携'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!app && <CallbackUrlDisplay />}

          {!app && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex gap-3">
              <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-200 font-semibold mb-1">
                  重要：Twitter Developer Portalでアプリを作成してから、以下のフォームに入力してください
                </p>
                <p className="text-xs text-yellow-300">
                  上記のCallback URLを使用してTwitterアプリを作成後、API KeyとAPI Secretをここに入力します
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                App名 *
              </label>
              <input
                type="text"
                required
                value={formData.app_name}
                onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: My Twitter Bot"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key (Consumer Key) *
              </label>
              <input
                type="text"
                required
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="xxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Secret (Consumer Secret) *
              </label>
              <input
                type="password"
                required
                value={formData.api_secret}
                onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="xxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bearer Token（オプション）
              </label>
              <input
                type="text"
                value={formData.bearer_token}
                onChange={(e) => setFormData({ ...formData, bearer_token: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="xxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">OAuth 2.0 認証情報</h3>
              <p className="text-sm text-gray-400 mb-4">
                アカウント認証機能を使用する場合は、OAuth 2.0のClient IDとClient Secretを入力してください
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client ID (OAuth 2.0)
                  </label>
                  <input
                    type="text"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="xxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client Secret (OAuth 2.0)
                  </label>
                  <input
                    type="password"
                    value={formData.client_secret}
                    onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="xxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-300">
                このアプリを有効化する
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? '保存中...' : app ? '更新' : '登録'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
