'use client';

import { Edit2, Trash2, CheckCircle, XCircle, Globe, Zap, Clock, Users } from 'lucide-react';

interface Proxy {
  id: string;
  proxy_name: string | null;
  proxy_type: 'http' | 'https' | 'socks5' | 'nordvpn';
  proxy_url: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  country: string | null;
  is_active: boolean;
  last_checked_at: string | null;
  test_status: 'success' | 'failed' | 'untested' | null;
  response_time_ms: number | null;
  assigned_accounts_count: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProxyCardProps {
  proxy: Proxy;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onTest: () => void;
}

export default function ProxyCard({
  proxy,
  onEdit,
  onDelete,
  onToggleActive,
  onTest
}: ProxyCardProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'http': return 'bg-blue-100 text-blue-800';
      case 'https': return 'bg-green-100 text-green-800';
      case 'socks5': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTestStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'untested': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getTestStatusLabel = (status: string) => {
    switch (status) {
      case 'success': return '正常';
      case 'failed': return '失敗';
      case 'untested': return '未テスト';
      default: return status;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
      !proxy.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {proxy.proxy_name || '（名称未設定）'}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(proxy.proxy_type)}`}>
                {proxy.proxy_type.toUpperCase()}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                proxy.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {proxy.is_active ? 'アクティブ' : '非アクティブ'}
              </span>
              {proxy.country && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  {proxy.country}
                </span>
              )}
            </div>
          </div>
          {proxy.is_active ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <XCircle size={20} className="text-gray-400" />
          )}
        </div>

        <div className="mt-3 p-3 bg-gray-50 rounded text-sm font-mono text-gray-700">
          {proxy.proxy_url || `${proxy.host || 'host'}:${proxy.port || 'port'}`}
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">テスト状態</span>
          <span className={`font-semibold ${getTestStatusColor(proxy.test_status || 'untested')}`}>
            {getTestStatusLabel(proxy.test_status || 'untested')}
          </span>
        </div>

        {proxy.response_time_ms !== null && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} />
              <span>応答時間</span>
            </div>
            <span className="font-semibold text-gray-900">
              {proxy.response_time_ms}ms
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Users size={16} />
            <span>割当アカウント</span>
          </div>
          <span className="font-semibold text-gray-900">
            {proxy.assigned_accounts_count}
          </span>
        </div>

        {proxy.last_checked_at && (
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
            最終テスト: {new Date(proxy.last_checked_at).toLocaleString('ja-JP')}
          </div>
        )}

        {proxy.notes && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-600 line-clamp-2">{proxy.notes}</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleActive}
            className={`px-3 py-2 text-sm rounded transition ${
              proxy.is_active
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {proxy.is_active ? '無効化' : '有効化'}
          </button>

          <button
            onClick={onTest}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded transition"
            aria-label="テスト"
          >
            <Zap size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
            aria-label="編集"
          >
            <Edit2 size={16} />
          </button>

          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
            aria-label="削除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        登録日: {new Date(proxy.created_at).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
