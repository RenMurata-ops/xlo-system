'use client';

import { Edit2, Trash2, CheckCircle, XCircle, AlertTriangle, Clock, TrendingUp, Activity, Link as LinkIcon, Check } from 'lucide-react';

interface SpamAccount {
  id: string;
  handle: string;
  name: string | null;
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

interface SpamAccountCardProps {
  account: SpamAccount;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onHealthCheck: () => void;
  onConnect: () => void;
  hasToken: boolean;
  tokenExpired?: boolean;
  checking?: boolean;
  connecting?: boolean;
}

export default function SpamAccountCard({
  account,
  onEdit,
  onDelete,
  onToggleActive,
  onHealthCheck,
  onConnect,
  hasToken,
  tokenExpired = false,
  checking = false,
  connecting = false
}: SpamAccountCardProps) {
  const getBanStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'shadowban': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'unknown': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBanStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '正常';
      case 'shadowban': return 'シャドウBAN';
      case 'suspended': return '凍結';
      case 'unknown': return '不明';
      default: return status;
    }
  };

  const getBanStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} className="text-green-500" />;
      case 'shadowban': return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'suspended': return <XCircle size={16} className="text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
      !account.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900">
                @{account.handle}
              </h3>
            </div>
            {account.name && (
              <p className="text-sm text-gray-600 mb-2">{account.name}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                account.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {account.is_active ? 'アクティブ' : '非アクティブ'}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getBanStatusColor(account.ban_status)}`}>
                {getBanStatusIcon(account.ban_status)}
                {getBanStatusLabel(account.ban_status)}
              </span>
              {hasToken ? (
                tokenExpired ? (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
                    <LinkIcon size={12} />
                    トークン期限切れ
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                    <LinkIcon size={12} />
                    X連携済み
                  </span>
                )
              ) : (
                <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
                  <LinkIcon size={12} />
                  未連携
                </span>
              )}
              {account.proxy_id && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  プロキシ設定済み
                </span>
              )}
            </div>
          </div>
        </div>

        {account.tags && account.tags.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-1 flex-wrap">
              {account.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <TrendingUp size={16} />
            <span>エンゲージメント</span>
          </div>
          <span className="font-semibold text-gray-900">
            {account.total_engagements.toLocaleString()}
          </span>
        </div>

        {account.success_rate !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">成功率</span>
            <span className={`font-semibold ${
              account.success_rate >= 80 ? 'text-green-600' :
              account.success_rate >= 50 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {account.success_rate.toFixed(1)}%
            </span>
          </div>
        )}

        {account.last_used_at && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={14} />
              <span>最終使用: {new Date(account.last_used_at).toLocaleString('ja-JP')}</span>
            </div>
          </div>
        )}

        {account.notes && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-600 line-clamp-2">{account.notes}</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2">
        <button
          onClick={onToggleActive}
          className={`px-3 py-2 text-sm rounded transition ${
            account.is_active
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {account.is_active ? '無効化' : '有効化'}
        </button>

        <div className="flex items-center gap-2">
          {hasToken && !tokenExpired ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm rounded bg-green-100 text-green-700">
              <Check size={16} />
              連携完了
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={connecting}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded transition bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              aria-label={tokenExpired ? 'X再連携' : 'X連携'}
            >
              <LinkIcon size={16} className={connecting ? 'animate-spin' : ''} />
              {connecting ? '連携中...' : (tokenExpired ? '再連携' : 'X連携')}
            </button>
          )}

          <button
            onClick={onHealthCheck}
            disabled={checking}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded transition bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="ヘルスチェック"
          >
            <Activity size={16} className={checking ? 'animate-spin' : ''} />
            {checking ? 'チェック中...' : 'ヘルスチェック'}
          </button>

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
        登録日: {new Date(account.created_at).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
