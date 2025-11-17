'use client';

import { useState } from 'react';
import { Edit2, Trash2, CheckCircle, XCircle, Zap, Heart, MessageCircle, UserPlus, Repeat, Quote } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface EngagementRule {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  search_type: 'keyword' | 'url' | 'user' | 'hashtag';
  search_query: string;
  action_type: 'like' | 'reply' | 'retweet' | 'follow' | 'quote';
  reply_template_id: string | null;
  min_followers: number;
  max_followers: number | null;
  min_account_age_days: number;
  exclude_keywords: string[] | null;
  exclude_verified: boolean;
  require_verified: boolean;
  executor_account_ids: string[] | null;
  allowed_account_tags: string[] | null;
  max_actions_per_execution: number;
  execution_interval_hours: number;
  daily_limit: number;
  actions_today: number;
  last_daily_reset: string;
  next_execution_at: string | null;
  last_execution_at: string | null;
  total_actions_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

interface EngagementRuleCardProps {
  rule: EngagementRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onRefresh?: () => void;
}

export default function EngagementRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggleActive,
  onRefresh
}: EngagementRuleCardProps) {
  const [executing, setExecuting] = useState(false);
  const supabase = createClient();

  const getSearchTypeLabel = (type: string) => {
    switch (type) {
      case 'keyword': return 'キーワード';
      case 'hashtag': return 'ハッシュタグ';
      case 'url': return 'URL';
      case 'user': return 'ユーザー';
      default: return type;
    }
  };

  const getSearchTypeColor = (type: string) => {
    switch (type) {
      case 'keyword': return 'bg-blue-100 text-blue-800';
      case 'hashtag': return 'bg-purple-100 text-purple-800';
      case 'url': return 'bg-orange-100 text-orange-800';
      case 'user': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'like': return <Heart size={16} className="text-pink-600" />;
      case 'reply': return <MessageCircle size={16} className="text-blue-600" />;
      case 'follow': return <UserPlus size={16} className="text-green-600" />;
      case 'retweet': return <Repeat size={16} className="text-purple-600" />;
      case 'quote': return <Quote size={16} className="text-orange-600" />;
      default: return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'like': return 'いいね';
      case 'reply': return 'リプライ';
      case 'follow': return 'フォロー';
      case 'retweet': return 'リツイート';
      case 'quote': return '引用';
      default: return action;
    }
  };

  const successRate = rule.total_actions_count > 0
    ? ((rule.success_count / rule.total_actions_count) * 100).toFixed(0)
    : '0';

  const dailyUsagePercent = rule.daily_limit > 0
    ? ((rule.actions_today / rule.daily_limit) * 100).toFixed(0)
    : '0';

  const handleExecuteNow = async () => {
    setExecuting(true);
    const loadingToast = toast.loading('実行中...', {
      description: `ルール: ${rule.name}`,
    });

    try {
      const { data, error } = await supabase.functions.invoke('execute-auto-engagement', {
        body: { rule_id: rule.id },
      });

      if (error) throw error;

      if (data?.ok) {
        const result = data.results?.[0];
        toast.success('実行完了', {
          id: loadingToast,
          description: `${result?.actions_succeeded || 0}件成功 / ${result?.actions_attempted || 0}件試行`,
          action: result?.trace_id ? {
            label: 'trace_id をコピー',
            onClick: () => {
              navigator.clipboard.writeText(result.trace_id);
              toast.info('trace_id をコピーしました');
            },
          } : undefined,
        });
        onRefresh?.();
      } else {
        toast.error('実行に失敗しました', {
          id: loadingToast,
        });
      }
    } catch (error: any) {
      console.error('Execute now error:', error);
      toast.error('実行エラー', {
        id: loadingToast,
        description: error.message,
      });
    } finally {
      setExecuting(false);
    }
  };

  const formatNextExecution = (dateStr: string | null) => {
    if (!dateStr) return '未設定';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'まもなく';
    if (diffMins < 60) return `${diffMins}分後`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}時間後`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日後`;
  };

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
      !rule.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {rule.name}
            </h3>
            {rule.description && (
              <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getSearchTypeColor(rule.search_type)}`}>
                {getSearchTypeLabel(rule.search_type)}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                rule.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {rule.is_active ? 'アクティブ' : '停止中'}
              </span>
              <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {getActionIcon(rule.action_type)}
                <span>{getActionLabel(rule.action_type)}</span>
              </div>
            </div>
          </div>
          {rule.is_active ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <XCircle size={20} className="text-gray-400" />
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-xs text-gray-500">検索クエリ</div>
          <div className="px-2 py-1 text-sm rounded bg-blue-50 text-blue-700 font-mono">
            {rule.search_query}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">実行間隔</span>
          <span className="font-semibold text-gray-900">
            {rule.execution_interval_hours}時間
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">次回実行</span>
          <span className="font-semibold text-blue-600">
            {formatNextExecution(rule.next_execution_at)}
          </span>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">今日の実行</span>
            <span className="font-semibold text-gray-900">
              {rule.actions_today} / {rule.daily_limit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                parseInt(dailyUsagePercent) >= 90 ? 'bg-red-500' :
                parseInt(dailyUsagePercent) >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(parseInt(dailyUsagePercent), 100)}%` }}
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">総実行</div>
            <div className="text-lg font-bold text-gray-900">
              {rule.total_actions_count}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">成功</div>
            <div className="text-lg font-bold text-green-600">
              {rule.success_count}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">成功率</div>
            <div className="text-lg font-bold text-blue-600">
              {successRate}%
            </div>
          </div>
        </div>

        {rule.last_execution_at && (
          <div className="pt-2 text-xs text-gray-500">
            最終実行: {new Date(rule.last_execution_at).toLocaleString('ja-JP')}
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleActive}
            className={`px-3 py-2 text-sm rounded transition ${
              rule.is_active
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {rule.is_active ? '停止' : '開始'}
          </button>

          {rule.is_active && (
            <button
              onClick={handleExecuteNow}
              disabled={executing || rule.actions_today >= rule.daily_limit}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded transition ${
                executing || rule.actions_today >= rule.daily_limit
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
              title={rule.actions_today >= rule.daily_limit ? '日次リミット到達' : '今すぐ実行'}
            >
              <Zap size={14} />
              {executing ? '実行中...' : '今すぐ実行'}
            </button>
          )}
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
    </div>
  );
}
