'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Users, FileText, Zap, Repeat, MessageCircle, Globe } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import StatsCard from '@/components/dashboard/StatsCard';
import QuickActions from '@/components/dashboard/QuickActions';
import RateLimitMonitor from '@/components/dashboard/RateLimitMonitor';
import LoopLockMonitor from '@/components/dashboard/LoopLockMonitor';
import DuplicateAttemptsMonitor from '@/components/dashboard/DuplicateAttemptsMonitor';
import TokenStatusCard from '@/components/dashboard/TokenStatusCard';

interface DashboardStats {
  totalTwitterApps: number;
  totalMainAccounts: number;
  totalFollowAccounts: number;
  totalSpamAccounts: number;
  totalPosts: number;
  totalEngagementRules: number;
  totalLoops: number;
  totalTemplates: number;
  totalProxies: number;
  activeMainAccounts: number;
  activeSpamAccounts: number;
  scheduledPosts: number;
  activeEngagementRules: number;
  activeLoops: number;
  workingProxies: number;
  totalEngagements: number;
  totalPostCount: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const results = await Promise.allSettled([
        supabase.from('twitter_apps').select('*', { count: 'exact' }),
        supabase.from('main_accounts').select('*', { count: 'exact' }),
        supabase.from('follow_accounts').select('*', { count: 'exact' }),
        supabase.from('spam_accounts').select('*', { count: 'exact' }),
        supabase.from('posts').select('*', { count: 'exact' }),
        supabase.from('auto_engagement_rules').select('*', { count: 'exact' }),
        supabase.from('loops').select('*', { count: 'exact' }),
        supabase.from('templates').select('*', { count: 'exact' }),
        supabase.from('proxies').select('*', { count: 'exact' }),
      ]);

      // Extract results, handling both fulfilled and rejected promises
      const [
        twitterApps,
        mainAccounts,
        followAccounts,
        spamAccounts,
        posts,
        engagementRules,
        loops,
        templates,
        proxies,
      ] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Error loading data for index ${index}:`, result.reason);
          return { count: 0, data: [] };
        }
      });

      const dashboardStats: DashboardStats = {
        totalTwitterApps: twitterApps.count || 0,
        totalMainAccounts: mainAccounts.count || 0,
        totalFollowAccounts: followAccounts.count || 0,
        totalSpamAccounts: spamAccounts.count || 0,
        totalPosts: posts.count || 0,
        totalEngagementRules: engagementRules.count || 0,
        totalLoops: loops.count || 0,
        totalTemplates: templates.count || 0,
        totalProxies: proxies.count || 0,
        activeMainAccounts: mainAccounts.data?.filter((a: any) => a.is_active).length || 0,
        activeSpamAccounts: spamAccounts.data?.filter((a: any) => a.is_active).length || 0,
        scheduledPosts: posts.data?.filter((p: any) => p.status === 'scheduled').length || 0,
        activeEngagementRules: engagementRules.data?.filter((r: any) => r.is_active).length || 0,
        activeLoops: loops.data?.filter((l: any) => l.is_active).length || 0,
        workingProxies: proxies.data?.filter((p: any) => p.test_status === 'success').length || 0,
        totalEngagements: spamAccounts.data?.reduce((sum: number, acc: any) => sum + acc.total_engagements, 0) || 0,
        totalPostCount: loops.data?.reduce((sum: number, loop: any) => sum + loop.post_count, 0) || 0,
      };

      setStats(dashboardStats);
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('統計情報の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-gray-400">データの読み込みに失敗しました</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">ダッシュボード</h1>
            <p className="text-gray-400 mt-2">
              XLO Systemの全体統計を確認します
            </p>
          </div>
          <button
            onClick={loadStats}
            className="flex items-center gap-2 px-4 py-2 text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition"
          >
            <RefreshCw size={20} />
            更新
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">アカウント管理</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Twitter Apps"
              value={stats.totalTwitterApps}
              icon={<FileText size={24} />}
              color="blue"
              link="/twitter-apps"
            />
            <StatsCard
              title="メインアカウント"
              value={stats.totalMainAccounts}
              subtitle={`アクティブ: ${stats.activeMainAccounts}`}
              icon={<Users size={24} />}
              color="green"
              link="/accounts/main"
            />
            <StatsCard
              title="フォローアカウント"
              value={stats.totalFollowAccounts}
              icon={<Users size={24} />}
              color="purple"
              link="/accounts/follow"
            />
            <StatsCard
              title="スパムアカウント"
              value={stats.totalSpamAccounts}
              subtitle={`アクティブ: ${stats.activeSpamAccounts}`}
              icon={<Users size={24} />}
              color="orange"
              link="/accounts/spam"
            />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">コンテンツ & 自動化</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="投稿"
              value={stats.totalPosts}
              subtitle={`予約: ${stats.scheduledPosts}`}
              icon={<MessageCircle size={24} />}
              color="blue"
              link="/posts"
            />
            <StatsCard
              title="エンゲージメントルール"
              value={stats.totalEngagementRules}
              subtitle={`アクティブ: ${stats.activeEngagementRules}`}
              icon={<Zap size={24} />}
              color="yellow"
              link="/engagement"
            />
            <StatsCard
              title="ループ"
              value={stats.totalLoops}
              subtitle={`アクティブ: ${stats.activeLoops}`}
              icon={<Repeat size={24} />}
              color="green"
              link="/loops"
            />
            <StatsCard
              title="テンプレート"
              value={stats.totalTemplates}
              icon={<FileText size={24} />}
              color="purple"
              link="/templates"
            />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">インフラ & パフォーマンス</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="プロキシ"
              value={stats.totalProxies}
              subtitle={`正常: ${stats.workingProxies}`}
              icon={<Globe size={24} />}
              color="blue"
              link="/proxies"
            />
            <StatsCard
              title="総エンゲージメント"
              value={stats.totalEngagements.toLocaleString()}
              icon={<TrendingUp size={24} />}
              color="green"
            />
            <StatsCard
              title="ループ投稿数"
              value={stats.totalPostCount.toLocaleString()}
              icon={<Repeat size={24} />}
              color="purple"
            />
            <StatsCard
              title="システム稼働率"
              value="99.9%"
              icon={<TrendingUp size={24} />}
              color="green"
            />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">トークン管理</h2>
          <TokenStatusCard />
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">リアルタイムモニタリング</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <RateLimitMonitor />
            <LoopLockMonitor />
            <DuplicateAttemptsMonitor />
          </div>
        </div>

        <QuickActions />
      </div>
    </div>
  );
}
