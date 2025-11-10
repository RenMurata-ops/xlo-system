'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Execution {
  id: string;
  rule_id: string;
  executor_account_id: string;
  target_user_id: string | null;
  target_username: string | null;
  target_tweet_id: string | null;
  action_type: string;
  success: boolean;
  error_message: string | null;
  executed_at: string;
}

interface EngagementHistoryProps {
  onClose: () => void;
}

export default function EngagementHistory({ onClose }: EngagementHistoryProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const supabase = createClient();

  useEffect(() => {
    loadExecutions();
  }, []);

  async function loadExecutions() {
    try {
      let query = supabase
        .from('auto_engagement_executions')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(100);

      if (filter === 'success') {
        query = query.eq('success', true);
      } else if (filter === 'failed') {
        query = query.eq('success', false);
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

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'like': return 'いいね';
      case 'reply': return 'リプライ';
      case 'follow': return 'フォロー';
      case 'retweet': return 'リツイート';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'like': return 'bg-pink-100 text-pink-800';
      case 'reply': return 'bg-blue-100 text-blue-800';
      case 'follow': return 'bg-green-100 text-green-800';
      case 'retweet': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const successCount = executions.filter(e => e.success).length;
  const failedCount = executions.filter(e => !e.success).length;
  const successRate = executions.length > 0
    ? ((successCount / executions.length) * 100).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">総実行数</div>
              <div className="text-2xl font-bold text-gray-900">{executions.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">成功</div>
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">成功率</div>
              <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(execution.action_type)}`}>
                          {getActionLabel(execution.action_type)}
                        </span>
                        {execution.success ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-red-500" />
                        )}
                        <span className={`text-xs font-medium ${execution.success ? 'text-green-600' : 'text-red-600'}`}>
                          {execution.success ? '成功' : '失敗'}
                        </span>
                      </div>
                      {execution.target_username && (
                        <div className="text-sm text-gray-700 mb-1">
                          ターゲット: @{execution.target_username}
                        </div>
                      )}
                      {execution.error_message && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                          {execution.error_message}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 text-right">
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
