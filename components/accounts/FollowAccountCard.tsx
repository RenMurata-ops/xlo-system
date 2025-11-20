'use client';

import { Edit2, Trash2, CheckCircle, XCircle, Users, Star, Activity, Link as LinkIcon, Check } from 'lucide-react';

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

interface FollowAccountCardProps {
  account: FollowAccount;
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

export default function FollowAccountCard({
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
}: FollowAccountCardProps) {
  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-600 bg-red-100';
    if (priority >= 5) return 'text-orange-600 bg-orange-100';
    return 'text-blue-600 bg-blue-100';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return '高';
    if (priority >= 5) return '中';
    return '低';
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
                @{account.target_handle}
              </h3>
            </div>
            {account.target_name && (
              <p className="text-sm text-gray-600">{account.target_name}</p>
            )}
          </div>
          {account.is_active ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <XCircle size={20} className="text-gray-400" />
          )}
        </div>

        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className={`px-2 py-1 rounded ${
            account.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {account.is_active ? 'アクティブ' : '非アクティブ'}
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
          <span className={`px-2 py-1 rounded ${getPriorityColor(account.priority)}`}>
            優先度: {getPriorityLabel(account.priority)} ({account.priority})
          </span>
          {account.category && (
            <span className="px-2 py-1 rounded bg-purple-100 text-purple-800">
              {account.category}
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Users size={16} />
            <span>フォロワー</span>
          </div>
          <span className="font-semibold text-gray-900">
            {account.follower_count?.toLocaleString() || '不明'}
          </span>
        </div>

        {account.tags && account.tags.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
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
            title="編集"
          >
            <Edit2 size={16} />
          </button>

          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
            title="削除"
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
