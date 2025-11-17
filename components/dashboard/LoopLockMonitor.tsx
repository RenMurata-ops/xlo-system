'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface LoopLock {
  id: string;
  loop_name: string;
  locked_until: string;
  time_remaining: string; // PostgreSQL interval type
}

export default function LoopLockMonitor() {
  const [locks, setLocks] = useState<LoopLock[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadLocks();
    const interval = setInterval(loadLocks, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadLocks() {
    try {
      const { data, error } = await supabase
        .from('v_active_loop_locks')
        .select('*')
        .order('locked_until', { ascending: true });

      if (error) throw error;
      setLocks(data || []);
    } catch (error) {
      console.error('Error loading loop locks:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatTimeRemaining = (lockedUntil: string) => {
    const lockDate = new Date(lockedUntil);
    const now = new Date();
    const diffMs = lockDate.getTime() - now.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 0) return '解除中';
    if (diffSecs < 60) return `${diffSecs}秒`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}分${diffSecs % 60}秒`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}時間${diffMins % 60}分`;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="text-orange-500" size={24} />
          <h2 className="text-xl font-semibold text-white">ループロック状態</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Lock className="text-orange-500" size={24} />
        <h2 className="text-xl font-semibold text-white">ループロック状態</h2>
        <span className="ml-auto text-sm text-gray-500">
          自動更新: 30秒ごと
        </span>
      </div>

      {locks.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
            <Unlock className="text-green-500" size={32} />
          </div>
          <p className="text-gray-400">ロックされているループはありません</p>
          <p className="text-sm text-gray-500 mt-1">すべてのループが利用可能です</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locks.map((lock) => (
            <div
              key={lock.id}
              className="bg-orange-500/20 border border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="text-orange-500" size={16} />
                    <span className="font-semibold text-white">{lock.loop_name}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    ループID: {lock.id.substring(0, 8)}...
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/30 text-orange-400 text-sm font-medium">
                  <Clock size={14} />
                  {formatTimeRemaining(lock.locked_until)}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                <span>ロック解除予定:</span>
                <span className="text-gray-400">
                  {new Date(lock.locked_until).toLocaleString('ja-JP')}
                </span>
              </div>

              <div className="mt-3 w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                <div className="h-1 bg-orange-500 animate-pulse w-full"></div>
              </div>
            </div>
          ))}

          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400">
              <span className="text-orange-500 font-semibold">注意:</span>
              {' '}ロックされたループは現在実行中です。完了するまでお待ちください。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
