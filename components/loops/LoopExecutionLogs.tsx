'use client';

import { useState, useEffect } from 'react';
import { X, PlayCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ExecutionLog {
  id: string;
  loop_id: string;
  executor_account_id: string;
  post_id: string | null;
  execution_status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  executed_at: string;
}

interface LoopExecutionLogsProps {
  loopId: string;
  onClose: () => void;
}

export default function LoopExecutionLogs({ loopId, onClose }: LoopExecutionLogsProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const supabase = createClient();

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      let query = supabase
        .from('loop_execution_logs')
        .select('*')
        .eq('loop_id', loopId)
        .order('executed_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('execution_status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [filter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success': return '成功';
      case 'failed': return '失敗';
      case 'pending': return '実行中';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const successCount = logs.filter(l => l.execution_status === 'success').length;
  const failedCount = logs.filter(l => l.execution_status === 'failed').length;
  const pendingCount = logs.filter(l => l.execution_status === 'pending').length;
  const successRate = logs.length > 0
    ? ((successCount / logs.length) * 100).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <PlayCircle size={24} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">実行ログ</h2>
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
              <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">成功</div>
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">失敗</div>
              <div className="text-2xl font-bold text-red-600">{failedCount}</div>
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
              成功
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'failed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              失敗
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              実行中
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600">実行ログがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(log.execution_status)}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.execution_status)}`}>
                          {getStatusLabel(log.execution_status)}
                        </span>
                      </div>

                      <div className="text-sm text-gray-700 mb-1">
                        実行アカウント: {log.executor_account_id}
                      </div>

                      {log.post_id && (
                        <div className="text-sm text-gray-700 mb-1">
                          投稿ID: {log.post_id}
                        </div>
                      )}

                      {log.error_message && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                          エラー: {log.error_message}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      {new Date(log.executed_at).toLocaleString('ja-JP')}
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
