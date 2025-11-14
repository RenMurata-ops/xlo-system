'use client';

import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Proxy {
  id: string;
  name: string;
  protocol?: string;
  host?: string;
  port?: number;
  username?: string | null;
  password?: string | null;
  is_active: boolean;
  notes?: string | null;
  provider_type?: string;
  nordvpn_server?: string | null;
  nordvpn_country?: string | null;
  nordvpn_city?: string | null;
  nordvpn_username?: string | null;
  nordvpn_password?: string | null;
  max_accounts?: number;
}

interface ProxyFormProps {
  proxy?: Proxy | null;
  onClose: () => void;
}

export default function ProxyForm({ proxy, onClose }: ProxyFormProps) {
  const [providerType, setProviderType] = useState<'manual' | 'nordvpn' | 'other'>('manual');
  const [formData, setFormData] = useState({
    name: '',
    // Manual proxy fields
    protocol: 'http',
    host: '',
    port: 8080,
    username: '',
    password: '',
    // NordVPN fields
    nordvpn_server: '',
    nordvpn_country: '',
    nordvpn_city: '',
    nordvpn_username: '',
    nordvpn_password: '',
    // Common fields
    max_accounts: 10,
    notes: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (proxy) {
      setProviderType((proxy.provider_type as any) || 'manual');
      setFormData({
        name: proxy.name,
        protocol: proxy.protocol || 'http',
        host: proxy.host || '',
        port: proxy.port || 8080,
        username: proxy.username || '',
        password: proxy.password || '',
        nordvpn_server: proxy.nordvpn_server || '',
        nordvpn_country: proxy.nordvpn_country || '',
        nordvpn_city: proxy.nordvpn_city || '',
        nordvpn_username: proxy.nordvpn_username || '',
        nordvpn_password: proxy.nordvpn_password || '',
        max_accounts: proxy.max_accounts || 10,
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

      const payload: any = {
        name: formData.name,
        provider_type: providerType,
        is_active: formData.is_active,
        notes: formData.notes || null,
        max_accounts: formData.max_accounts,
        current_accounts: 0,
        user_id: user.id,
        health_status: 'unknown',
      };

      // Add provider-specific fields
      if (providerType === 'manual') {
        payload.protocol = formData.protocol;
        payload.host = formData.host;
        payload.port = formData.port;
        payload.username = formData.username || null;
        payload.password = formData.password || null;
      } else if (providerType === 'nordvpn') {
        payload.nordvpn_server = formData.nordvpn_server;
        payload.nordvpn_country = formData.nordvpn_country || null;
        payload.nordvpn_city = formData.nordvpn_city || null;
        payload.nordvpn_username = formData.nordvpn_username;
        payload.nordvpn_password = formData.nordvpn_password;
      }

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
    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
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

        {/* Provider Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            プロバイダータイプ *
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setProviderType('manual')}
              className={`px-4 py-3 rounded-lg border-2 transition ${
                providerType === 'manual'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">手動設定</div>
              <div className="text-xs text-gray-500 mt-1">IP:Port指定</div>
            </button>
            <button
              type="button"
              onClick={() => setProviderType('nordvpn')}
              className={`px-4 py-3 rounded-lg border-2 transition ${
                providerType === 'nordvpn'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">NordVPN</div>
              <div className="text-xs text-gray-500 mt-1">推奨</div>
            </button>
            <button
              type="button"
              onClick={() => setProviderType('other')}
              className={`px-4 py-3 rounded-lg border-2 transition ${
                providerType === 'other'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">その他</div>
              <div className="text-xs text-gray-500 mt-1">カスタム</div>
            </button>
          </div>
        </div>

        {/* NordVPN Information Banner */}
        {providerType === 'nordvpn' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">NordVPN プロキシ設定ガイド</div>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>NordVPNダッシュボードでHTTPプロキシを有効化</li>
                  <li>サービス認証情報（ユーザー名・パスワード）を取得</li>
                  <li>使用したいサーバーアドレスを入力（例: us9999.nordvpn.com）</li>
                  <li>ポート89でHTTPプロキシが利用可能</li>
                </ol>
                <a
                  href="https://support.nordvpn.com/hc/en-us/articles/20195967385745-NordVPN-proxy-setup-for-qBittorrent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-xs mt-2 inline-block"
                >
                  設定方法の詳細 →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Common Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            プロキシ名 *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="例: NordVPN US East 1"
          />
        </div>

        {/* Manual Proxy Configuration */}
        {providerType === 'manual' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プロトコル *
              </label>
              <select
                required
                value={formData.protocol}
                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
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
          </>
        )}

        {/* NordVPN Configuration */}
        {providerType === 'nordvpn' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NordVPN サーバーアドレス *
              </label>
              <input
                type="text"
                required
                value={formData.nordvpn_server}
                onChange={(e) => setFormData({ ...formData, nordvpn_server: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: us9999.nordvpn.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                NordVPNアプリまたはサーバーリストから取得したサーバーアドレスを入力
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  国コード
                </label>
                <input
                  type="text"
                  value={formData.nordvpn_country}
                  onChange={(e) => setFormData({ ...formData, nordvpn_country: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: US, JP, UK"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  都市（オプション）
                </label>
                <input
                  type="text"
                  value={formData.nordvpn_city}
                  onChange={(e) => setFormData({ ...formData, nordvpn_city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: New York, Tokyo"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  サービス認証情報 - ユーザー名 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nordvpn_username}
                  onChange={(e) => setFormData({ ...formData, nordvpn_username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="NordVPNダッシュボードから取得"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  サービス認証情報 - パスワード *
                </label>
                <input
                  type="password"
                  required
                  value={formData.nordvpn_password}
                  onChange={(e) => setFormData({ ...formData, nordvpn_password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="NordVPNダッシュボードから取得"
                />
              </div>
            </div>
          </>
        )}

        {/* Max Accounts */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            最大割り当てアカウント数 *
          </label>
          <input
            type="number"
            min="1"
            max="100"
            required
            value={formData.max_accounts}
            onChange={(e) => setFormData({ ...formData, max_accounts: parseInt(e.target.value) || 10 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            このプロキシに割り当て可能なアカウント数（推奨: 10-20）
          </p>
        </div>

        {/* Notes */}
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

        {/* Active Toggle */}
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
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
  );
}
