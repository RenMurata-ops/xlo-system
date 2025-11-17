'use client';

import { useState, useEffect } from 'react';
import { Copy, AlertCircle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DuplicateAttempt {
  created_at: string;
  user_id: string;
  text_hash: string;
  content: string;
  error_message: string;
}

export default function DuplicateAttemptsMonitor() {
  const [duplicates, setDuplicates] = useState<DuplicateAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    loadDuplicates();
    const interval = setInterval(loadDuplicates, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function loadDuplicates() {
    try {
      const { data, error } = await supabase
        .from('v_recent_duplicate_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setDuplicates(data || []);
    } catch (error) {
      console.error('Error loading duplicate attempts:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleExpand = (hash: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(hash)) {
      newExpanded.delete(hash);
    } else {
      newExpanded.add(hash);
    }
    setExpanded(newExpanded);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '今';
    if (diffMins < 60) return `${diffMins}分前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日前`;
  };

  const truncateContent = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Copy className="text-purple-500" size={24} />
          <h2 className="text-xl font-semibold text-white">重複投稿試行</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Copy className="text-purple-500" size={24} />
        <h2 className="text-xl font-semibold text-white">重複投稿試行</h2>
        <span className="ml-auto text-sm text-gray-500">
          自動更新: 1分ごと
        </span>
      </div>

      {duplicates.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
            <Copy className="text-green-500" size={32} />
          </div>
          <p className="text-gray-400">最近の重複試行はありません</p>
          <p className="text-sm text-gray-500 mt-1">すべての投稿が一意です</p>
        </div>
      ) : (
        <>
          <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-purple-400 mt-0.5" size={16} />
              <div className="text-sm text-gray-300">
                <span className="text-purple-400 font-semibold">{duplicates.length}件</span>
                {' '}の重複投稿試行が検出されました（24時間以内）
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {duplicates.map((dup) => (
              <div
                key={dup.text_hash + dup.created_at}
                className="bg-purple-500/10 border border-gray-800 rounded-lg p-4 hover:bg-purple-500/15 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="text-purple-400" size={14} />
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(dup.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-white mb-2">
                      {expanded.has(dup.text_hash) ? dup.content : truncateContent(dup.content)}
                    </div>
                    {dup.content.length > 80 && (
                      <button
                        onClick={() => toggleExpand(dup.text_hash)}
                        className="text-xs text-purple-400 hover:text-purple-300 transition"
                      >
                        {expanded.has(dup.text_hash) ? '折りたたむ' : 'もっと見る'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(dup.created_at).toLocaleString('ja-JP')}
                  </div>
                  <div className="font-mono">
                    hash: {dup.text_hash.substring(0, 12)}...
                  </div>
                </div>

                {dup.error_message && (
                  <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/30">
                    {dup.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            過去10件の重複試行を表示中
          </div>
        </>
      )}
    </div>
  );
}
