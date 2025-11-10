'use client';

import { Edit2, Trash2, CheckCircle, XCircle, Zap, Heart, MessageCircle, UserPlus, Repeat } from 'lucide-react';

interface EngagementRule {
  id: string;
  rule_name: string;
  rule_type: 'keyword' | 'url' | 'user';
  is_active: boolean;
  execution_frequency_minutes: number;
  action_type: string[];
  search_keywords: string[] | null;
  target_user_ids: string[] | null;
  executor_account_ids: string[] | null;
  total_executions: number;
  success_count: number;
  error_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EngagementRuleCardProps {
  rule: EngagementRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

export default function EngagementRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggleActive
}: EngagementRuleCardProps) {
  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'keyword': return 'キーワード';
      case 'url': return 'URL';
      case 'user': return 'ユーザー';
      default: return type;
    }
  };

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'keyword': return 'bg-blue-100 text-blue-800';
      case 'url': return 'bg-purple-100 text-purple-800';
      case 'user': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'like': return <Heart size={14} />;
      case 'reply': return <MessageCircle size={14} />;
      case 'follow': return <UserPlus size={14} />;
      case 'retweet': return <Repeat size={14} />;
      default: return null;
    }
  };

  const successRate = rule.total_executions > 0
    ? ((rule.success_count / rule.total_executions) * 100).toFixed(0)
    : '0';

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
      !rule.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {rule.rule_name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRuleTypeColor(rule.rule_type)}`}>
                {getRuleTypeLabel(rule.rule_type)}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                rule.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {rule.is_active ? 'アクティブ' : '停止中'}
              </span>
            </div>
          </div>
          {rule.is_active ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <XCircle size={20} className="text-gray-400" />
          )}
        </div>

        {rule.search_keywords && rule.search_keywords.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">キーワード</div>
            <div className="flex items-center gap-1 flex-wrap">
              {rule.search_keywords.slice(0, 3).map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700"
                >
                  {keyword}
                </span>
              ))}
              {rule.search_keywords.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{rule.search_keywords.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">実行頻度</span>
          <span className="font-semibold text-gray-900">
            {rule.execution_frequency_minutes}分
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">アクション</span>
          <div className="flex items-center gap-1">
            {rule.action_type.map((action, idx) => (
              <span key={idx} className="p-1 rounded bg-gray-100 text-gray-700">
                {getActionIcon(action)}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">総実行</div>
            <div className="text-lg font-bold text-gray-900">
              {rule.total_executions}
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

        {rule.last_executed_at && (
          <div className="pt-2 text-xs text-gray-500">
            最終実行: {new Date(rule.last_executed_at).toLocaleString('ja-JP')}
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2">
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
