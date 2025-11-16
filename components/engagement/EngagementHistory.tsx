'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, CheckCircle, AlertCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Execution {
  id: string;
  rule_id: string;
  rule_name: string;
  action_type: string;
  executed_at: string;
  status: 'success' | 'partial' | 'failed';
  actions_attempted: number;
  actions_succeeded: number;
  actions_failed: number;
  trace_id: string;
  error_message: string | null;
}

interface EngagementHistoryProps {
  onClose: () => void;
}

export default function EngagementHistory({ onClose }: EngagementHistoryProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'partial' | 'failed'>('all');
  const supabase = createClient();

  useEffect(() => {
    loadExecutions();
  }, []);

  async function loadExecutions() {
    try {
      let query = supabase
        .from('v_recent_engagement_executions')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadExecutions();
  }, [filter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle size={16} className="text-green-500" />;
      case 'partial': return <AlertCircle size={16} className="text-yellow-500" />;
      case 'failed': return <XCircle size={16} className="text-red-500" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success': return '成功';
      case 'partial': return '部分成功';
      case 'failed': return '失敗';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'partial': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
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

  const getActionColor = (action: string) => {
    switch (action) {
      case 'like': return 'bg-pink-100 text-pink-800';
      case 'reply': return 'bg-blue-100 text-blue-800';
      case 'follow': return 'bg-green-100 text-green-800';
      case 'retweet': return 'bg-purple-100 text-purple-800';
      case 'quote': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalAttempted = executions.reduce((sum, e) => sum + e.actions_attempted, 0);
  const totalSucceeded = executions.reduce((sum, e) => sum + e.actions_succeeded, 0);
  const totalFailed = executions.reduce((sum, e) => sum + e.actions_failed, 0);
  const successRate = totalAttempted > 0
    ? ((totalSucceeded / totalAttempted) * 100).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <TrendingUp size={24} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">実行履歴</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">総実行数</div>
              <div className="text-2xl font-bold text-gray-900">{executions.length}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">総アクション試行</div>
              <div className="text-2xl font-bold text-blue-600">{totalAttempted}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">成功</div>
              <div className="text-2xl font-bold text-green-600">{totalSucceeded}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">成功率</div>
              <div className="text-2xl font-bold text-purple-600">{successRate}%</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'success'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              成功のみ
            </button>
            <button
              onClick={() => setFilter('partial')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'partial'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              部分成功のみ
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'failed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              失敗のみ
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600">実行履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions.map(execution => (
                <div
                  key={execution.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {execution.rule_name}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(execution.action_type)}`}>
                          {getActionLabel(execution.action_type)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(execution.status)}
                          <span className={`font-medium ${getStatusColor(execution.status)}`}>
                            {getStatusLabel(execution.status)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">試行:</span>
                          <span className="font-semibold text-gray-900">{execution.actions_attempted}</span>
                          <span className="text-gray-500">成功:</span>
                          <span className="font-semibold text-green-600">{execution.actions_succeeded}</span>
                          {execution.actions_failed > 0 && (
                            <>
                              <span className="text-gray-500">失敗:</span>
                              <span className="font-semibold text-red-600">{execution.actions_failed}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>trace_id:</span>
                        <code className="px-2 py-1 bg-gray-100 rounded font-mono">
                          {execution.trace_id}
                        </code>
                      </div>

                      {execution.error_message && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                          <strong>エラー:</strong> {execution.error_message}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 text-right ml-4">
                      {new Date(execution.executed_at).toLocaleString('ja-JP')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
