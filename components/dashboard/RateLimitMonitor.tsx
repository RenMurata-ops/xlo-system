'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Activity, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface RateLimit {
  endpoint: string;
  token_type: string;
  remaining: number;
  limit_total: number;
  remaining_percent: number;
  reset_at: string;
  updated_at: string;
}

export default function RateLimitMonitor() {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadRateLimits();
    const interval = setInterval(loadRateLimits, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function loadRateLimits() {
    try {
      const { data, error } = await supabase
        .from('v_rate_limit_warnings')
        .select('*')
        .order('remaining_percent', { ascending: true });

      if (error) throw error;
      setRateLimits(data || []);
    } catch (error) {
      console.error('Error loading rate limits:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (percent: number) => {
    if (percent <= 10) return 'text-red-500';
    if (percent <= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusBgColor = (percent: number) => {
    if (percent <= 10) return 'bg-red-500/20';
    if (percent <= 30) return 'bg-yellow-500/20';
    return 'bg-green-500/20';
  };

  const formatResetTime = (resetAt: string) => {
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'リセット中';
    if (diffMins < 60) return `${diffMins}分後`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}時間${diffMins % 60}分後`;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="text-blue-500" size={24} />
          <h2 className="text-xl font-semibold text-white">レート制限モニター</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="text-blue-500" size={24} />
        <h2 className="text-xl font-semibold text-white">レート制限モニター</h2>
        <span className="ml-auto text-sm text-gray-500">
          自動更新: 1分ごと
        </span>
      </div>

      {rateLimits.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
            <Activity className="text-green-500" size={32} />
          </div>
          <p className="text-gray-400">すべてのエンドポイントが正常です</p>
          <p className="text-sm text-gray-500 mt-1">レート制限の警告はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rateLimits.map((limit, idx) => (
            <div
              key={idx}
              className={`${getStatusBgColor(limit.remaining_percent)} border border-gray-800 rounded-lg p-4`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={getStatusColor(limit.remaining_percent)} size={16} />
                    <span className="font-mono text-sm text-white">{limit.endpoint}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {limit.token_type === 'user' ? 'ユーザートークン' : 'アプリトークン'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getStatusColor(limit.remaining_percent)}`}>
                    {limit.remaining_percent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">残り</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">
                  残り: <span className="text-white font-semibold">{limit.remaining}</span> / {limit.limit_total}
                </span>
                <div className="flex items-center gap-1 text-gray-500">
                  <Clock size={12} />
                  <span className="text-xs">{formatResetTime(limit.reset_at)}</span>
                </div>
              </div>

              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    limit.remaining_percent <= 10 ? 'bg-red-500' :
                    limit.remaining_percent <= 30 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.max(limit.remaining_percent, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
