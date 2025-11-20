'use client';

import { Edit2, Trash2, CheckCircle, XCircle, Repeat, Clock, FileText, PlayCircle, BarChart3 } from 'lucide-react';

interface Loop {
  id: string;
  loop_name: string;
  loop_type: 'post' | 'reply' | 'cta';
  description: string | null;
  is_active: boolean;
  execution_interval_hours: number;
  execution_interval_minutes: number | null;
  min_accounts: number;
  max_accounts: number;
  last_executed_at: string | null;
  next_run_at: string | null;
  post_count: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  template_names?: string;
  monitor_account_handle: string | null;
  target_value: string | null;
}

interface LoopCardProps {
  loop: Loop;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onShowLogs: () => void;
}

export default function LoopCard({
  loop,
  onEdit,
  onDelete,
  onToggleActive,
  onShowLogs
}: LoopCardProps) {
  const isScheduled = loop.next_run_at && new Date(loop.next_run_at) > new Date();
  const timeUntilNext = loop.next_run_at
    ? Math.max(0, Math.floor((new Date(loop.next_run_at).getTime() - new Date().getTime()) / (1000 * 60)))
    : null;

  const getLoopTypeDisplay = () => {
    switch (loop.loop_type) {
      case 'post':
        return { icon: '📝', label: '投稿ループ', color: 'bg-blue-100 text-blue-800' };
      case 'reply':
        return { icon: '💬', label: 'リプライループ', color: 'bg-green-100 text-green-800' };
      case 'cta':
        return { icon: '🎯', label: 'CTAループ', color: 'bg-purple-100 text-purple-800' };
      default:
        return { icon: '📝', label: '投稿ループ', color: 'bg-blue-100 text-blue-800' };
    }
  };

  const loopTypeDisplay = getLoopTypeDisplay();

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
      !loop.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {loop.loop_name}
              </h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${loopTypeDisplay.color}`}>
                {loopTypeDisplay.icon} {loopTypeDisplay.label}
              </span>
            </div>
            {loop.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {loop.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                loop.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {loop.is_active ? 'アクティブ' : '停止中'}
              </span>
              {isScheduled && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  予約済み
                </span>
              )}
              {loop.tags && loop.tags.length > 0 && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {loop.tags[0]}
                </span>
              )}
            </div>
          </div>
          {loop.is_active ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <XCircle size={20} className="text-gray-400" />
          )}
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock size={16} />
            <span>実行間隔</span>
          </div>
          <span className="font-semibold text-gray-900">
            {loop.execution_interval_minutes
              ? (loop.execution_interval_minutes >= 60
                  ? `${Math.floor(loop.execution_interval_minutes / 60)}時間${loop.execution_interval_minutes % 60 > 0 ? `${loop.execution_interval_minutes % 60}分` : ''}`
                  : `${loop.execution_interval_minutes}分`)
              : `${loop.execution_interval_hours}時間`}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Repeat size={16} />
            <span>アカウント数</span>
          </div>
          <span className="font-semibold text-gray-900">
            {loop.min_accounts}〜{loop.max_accounts}
          </span>
        </div>

        {loop.template_names && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <FileText size={16} />
              <span>テンプレート</span>
            </div>
            <span className="font-semibold text-gray-900 truncate max-w-[150px]" title={loop.template_names}>
              {loop.template_names}
            </span>
          </div>
        )}

        {loop.loop_type === 'cta' && loop.monitor_account_handle && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span>監視アカウント</span>
            </div>
            <span className="font-semibold text-gray-900">
              @{loop.monitor_account_handle}
            </span>
          </div>
        )}

        {loop.loop_type === 'reply' && loop.target_value && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span>ターゲット</span>
            </div>
            <span className="font-semibold text-gray-900 truncate max-w-[150px]" title={loop.target_value}>
              {loop.target_value}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <BarChart3 size={16} />
            <span>総投稿数</span>
          </div>
          <span className="font-semibold text-gray-900">
            {loop.post_count.toLocaleString()}
          </span>
        </div>

        {loop.next_run_at && timeUntilNext !== null && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">次回実行まで</div>
            <div className="text-sm font-semibold text-blue-600">
              {timeUntilNext < 60
                ? `${timeUntilNext}分`
                : `${Math.floor(timeUntilNext / 60)}時間${timeUntilNext % 60}分`
              }
            </div>
          </div>
        )}

        {loop.last_executed_at && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              最終実行: {new Date(loop.last_executed_at).toLocaleString('ja-JP')}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleActive}
            className={`px-3 py-2 text-sm rounded transition ${
              loop.is_active
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {loop.is_active ? '停止' : '開始'}
          </button>

          <button
            onClick={onShowLogs}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded transition"
            aria-label="ログ"
          >
            <PlayCircle size={16} />
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
        作成日: {new Date(loop.created_at).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
