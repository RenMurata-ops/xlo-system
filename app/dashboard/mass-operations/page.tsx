'use client';

import { useState, useEffect } from 'react';
import { Activity, Server, AlertTriangle, TrendingUp, RefreshCw, Users, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface HealthSummary {
  total_accounts: number;
  healthy_accounts: number;
  degraded_accounts: number;
  suspended_accounts: number;
  avg_health_score: number;
  total_requests_today: number;
  total_errors_today: number;
  accounts_near_limit: number;
}

interface ProxyUsage {
  proxy_id: string;
  proxy_name: string;
  provider_type: string;
  nordvpn_server: string | null;
  nordvpn_country: string | null;
  current_accounts: number;
  max_accounts: number;
  utilization_percent: number;
  health_status: string;
  requests_today: number;
  errors_today: number;
  error_rate_percent: number;
}

export default function MassOperationsDashboard() {
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [proxyUsage, setProxyUsage] = useState<ProxyUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const supabase = createClient();

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get account health summary
      const { data: healthData } = await supabase.rpc('get_account_health_summary', {
        p_user_id: user.id,
      });

      if (healthData && healthData.length > 0) {
        setHealthSummary(healthData[0]);
      }

      // Get proxy usage summary
      const { data: proxyData } = await supabase.rpc('get_proxy_usage_summary', {
        p_user_id: user.id,
      });

      if (proxyData) {
        setProxyUsage(proxyData);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  const errorRate = healthSummary
    ? healthSummary.total_requests_today > 0
      ? (healthSummary.total_errors_today / healthSummary.total_requests_today) * 100
      : 0
    : 0;

  const healthPercentage = healthSummary
    ? healthSummary.total_accounts > 0
      ? (healthSummary.healthy_accounts / healthSummary.total_accounts) * 100
      : 0
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Activity className="text-blue-600" size={32} />
                大量運用ダッシュボード
              </h1>
              <p className="text-gray-600 mt-1">
                500アカウント同時運用の健全性とパフォーマンスをリアルタイム監視
              </p>
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              更新
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="総アカウント数"
            value={healthSummary?.total_accounts || 0}
            icon={<Users size={24} />}
            color="blue"
            subtitle={`健全: ${healthSummary?.healthy_accounts || 0}`}
          />
          <MetricCard
            title="健全性スコア"
            value={`${Math.round(healthSummary?.avg_health_score || 0)}/100`}
            icon={<Activity size={24} />}
            color={healthSummary && healthSummary.avg_health_score >= 70 ? 'green' : healthSummary && healthSummary.avg_health_score >= 40 ? 'yellow' : 'red'}
            subtitle={`健全: ${Math.round(healthPercentage)}%`}
          />
          <MetricCard
            title="本日のリクエスト"
            value={healthSummary?.total_requests_today.toLocaleString() || '0'}
            icon={<Zap size={24} />}
            color="purple"
            subtitle={`エラー: ${healthSummary?.total_errors_today || 0}`}
          />
          <MetricCard
            title="エラー率"
            value={`${errorRate.toFixed(2)}%`}
            icon={<AlertTriangle size={24} />}
            color={errorRate < 5 ? 'green' : errorRate < 10 ? 'yellow' : 'red'}
            subtitle={`制限接近: ${healthSummary?.accounts_near_limit || 0}`}
          />
        </div>

        {/* Account Health Breakdown */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">アカウント健全性分析</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard
              status="健全"
              count={healthSummary?.healthy_accounts || 0}
              color="green"
              description="スコア 70-100"
            />
            <StatusCard
              status="注意"
              count={healthSummary?.degraded_accounts || 0}
              color="yellow"
              description="スコア 20-69"
            />
            <StatusCard
              status="停止中"
              count={healthSummary?.suspended_accounts || 0}
              color="red"
              description="スコア <20 または自動停止"
            />
          </div>
        </div>

        {/* Proxy Usage Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Server size={24} className="text-blue-600" />
              プロキシ使用状況
            </h2>
            <span className="text-sm text-gray-500">
              {proxyUsage.length} プロキシ登録中
            </span>
          </div>

          {proxyUsage.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Server size={48} className="mx-auto mb-4 opacity-50" />
              <p>プロキシが登録されていません</p>
              <p className="text-sm mt-2">プロキシページから NordVPN または手動プロキシを登録してください</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">プロキシ名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">タイプ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">サーバー/国</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">使用率</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">本日リクエスト</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">エラー率</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">健全性</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {proxyUsage.map((proxy) => (
                    <tr key={proxy.proxy_id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">{proxy.proxy_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          proxy.provider_type === 'nordvpn'
                            ? 'bg-blue-100 text-blue-800'
                            : proxy.provider_type === 'manual'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {proxy.provider_type === 'nordvpn' ? 'NordVPN' : proxy.provider_type === 'manual' ? '手動' : 'その他'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {proxy.provider_type === 'nordvpn' ? (
                          <div>
                            <div className="font-mono text-xs">{proxy.nordvpn_server}</div>
                            {proxy.nordvpn_country && (
                              <div className="text-xs text-gray-500">{proxy.nordvpn_country}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                proxy.utilization_percent >= 90
                                  ? 'bg-red-500'
                                  : proxy.utilization_percent >= 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(proxy.utilization_percent, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 min-w-[60px]">
                            {proxy.current_accounts}/{proxy.max_accounts}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">
                        {proxy.requests_today.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          proxy.error_rate_percent < 5
                            ? 'bg-green-100 text-green-800'
                            : proxy.error_rate_percent < 10
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {proxy.error_rate_percent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          proxy.health_status === 'healthy'
                            ? 'bg-green-100 text-green-800'
                            : proxy.health_status === 'degraded'
                            ? 'bg-yellow-100 text-yellow-800'
                            : proxy.health_status === 'unhealthy'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {proxy.health_status === 'healthy'
                            ? '健全'
                            : proxy.health_status === 'degraded'
                            ? '注意'
                            : proxy.health_status === 'unhealthy'
                            ? '不良'
                            : '不明'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {healthSummary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <TrendingUp size={20} />
              推奨アクション
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              {healthSummary.suspended_accounts > 0 && (
                <li>• {healthSummary.suspended_accounts} アカウントが停止中です。エラー内容を確認し、必要に応じて手動で再有効化してください</li>
              )}
              {healthSummary.degraded_accounts > healthSummary.healthy_accounts && (
                <li>• 注意状態のアカウントが多数あります。リクエスト頻度を下げることを検討してください</li>
              )}
              {healthSummary.accounts_near_limit > 5 && (
                <li>• {healthSummary.accounts_near_limit} アカウントがレート制限に接近中です。プロキシ追加またはアカウント分散を検討してください</li>
              )}
              {errorRate > 10 && (
                <li>• エラー率が高い状態です（{errorRate.toFixed(1)}%）。プロキシ設定やアカウント健全性を確認してください</li>
              )}
              {proxyUsage.some(p => p.utilization_percent > 90) && (
                <li>• 使用率90%超のプロキシがあります。新しいプロキシの追加を検討してください</li>
              )}
              {proxyUsage.length === 0 && healthSummary.total_accounts > 0 && (
                <li>• プロキシが設定されていません。大量運用にはNordVPNプロキシの設定を強く推奨します</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  subtitle?: string;
}

function MetricCard({ title, value, icon, color, subtitle }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
    </div>
  );
}

interface StatusCardProps {
  status: string;
  count: number;
  color: 'green' | 'yellow' | 'red';
  description: string;
}

function StatusCard({ status, count, color, description }: StatusCardProps) {
  const colorClasses = {
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    red: 'border-red-200 bg-red-50',
  };

  const textClasses = {
    green: 'text-green-900',
    yellow: 'text-yellow-900',
    red: 'text-red-900',
  };

  const badgeClasses = {
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
  };

  return (
    <div className={`border-2 rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-bold ${textClasses[color]}`}>{status}</h3>
        <span className={`${badgeClasses[color]} text-white px-3 py-1 rounded-full text-sm font-bold`}>
          {count}
        </span>
      </div>
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  );
}
