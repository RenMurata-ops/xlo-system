'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  UsersRound,
  Globe,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardStats {
  mainAccounts: { total: number; active: number; tokenActive: number };
  followAccounts: { total: number; active: number; highPriority: number };
  spamAccounts: { total: number; active: number; withProxy: number };
  proxies: { total: number; active: number; healthy: number };
  engagementRules: { total: number; active: number };
  recentActivity: {
    notifications: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    mainAccounts: { total: 0, active: 0, tokenActive: 0 },
    followAccounts: { total: 0, active: 0, highPriority: 0 },
    spamAccounts: { total: 0, active: 0, withProxy: 0 },
    proxies: { total: 0, active: 0, healthy: 0 },
    engagementRules: { total: 0, active: 0 },
    recentActivity: { notifications: 0 },
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadDashboardStats();
  }, []);

  async function loadDashboardStats() {
    try {
      setLoading(true);

      const [
        mainAccountsData,
        mainAccountsActiveData,
        followAccountsData,
        followAccountsActiveData,
        followAccountsHighPriorityData,
        spamAccountsData,
        spamAccountsActiveData,
        spamAccountsWithProxyData,
        proxiesData,
        proxiesActiveData,
        engagementRulesData,
        engagementRulesActiveData,
        unreadNotifications,
      ] = await Promise.all([
        supabase.from('main_accounts').select('id', { count: 'exact', head: true }),
        supabase.from('main_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('follow_accounts').select('id', { count: 'exact', head: true }),
        supabase.from('follow_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('follow_accounts').select('id', { count: 'exact', head: true }).gte('priority', 8),
        supabase.from('spam_accounts').select('id', { count: 'exact', head: true }),
        supabase.from('spam_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('spam_accounts').select('id', { count: 'exact', head: true }).not('proxy_id', 'is', null),
        supabase.from('proxies').select('id', { count: 'exact', head: true }),
        supabase.from('proxies').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('auto_engagement_rules').select('id', { count: 'exact', head: true }),
        supabase.from('auto_engagement_rules').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
      ]);

      const { count: tokenCount } = await supabase
        .from('account_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('account_type', 'main')
        .gte('expires_at', new Date().toISOString());

      setStats({
        mainAccounts: {
          total: mainAccountsData.count || 0,
          active: mainAccountsActiveData.count || 0,
          tokenActive: tokenCount || 0,
        },
        followAccounts: {
          total: followAccountsData.count || 0,
          active: followAccountsActiveData.count || 0,
          highPriority: followAccountsHighPriorityData.count || 0,
        },
        spamAccounts: {
          total: spamAccountsData.count || 0,
          active: spamAccountsActiveData.count || 0,
          withProxy: spamAccountsWithProxyData.count || 0,
        },
        proxies: {
          total: proxiesData.count || 0,
          active: proxiesActiveData.count || 0,
          healthy: proxiesActiveData.count || 0,
        },
        engagementRules: {
          total: engagementRulesData.count || 0,
          active: engagementRulesActiveData.count || 0,
        },
        recentActivity: {
          notifications: unreadNotifications.count || 0,
        },
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const systemHealth =
    stats.mainAccounts.tokenActive / Math.max(stats.mainAccounts.total, 1) * 100;
  const proxyHealth =
    stats.proxies.healthy / Math.max(stats.proxies.total, 1) * 100;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8" />
            ダッシュボード
          </h1>
          <p className="text-muted-foreground mt-1">
            システム全体の概要と統計情報
          </p>
        </div>
        <Button onClick={loadDashboardStats} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          更新
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">システム健全性</div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold">{systemHealth.toFixed(0)}%</div>
            {systemHealth >= 80 ? (
              <CheckCircle className="h-5 w-5 text-green-500 mb-1" />
            ) : systemHealth >= 50 ? (
              <AlertCircle className="h-5 w-5 text-yellow-500 mb-1" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mb-1" />
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            トークン有効率
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">プロキシ健全性</div>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold">{proxyHealth.toFixed(0)}%</div>
            {proxyHealth >= 80 ? (
              <CheckCircle className="h-5 w-5 text-green-500 mb-1" />
            ) : proxyHealth >= 50 ? (
              <AlertCircle className="h-5 w-5 text-yellow-500 mb-1" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mb-1" />
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            アクティブ率
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">アクティブルール</div>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold">{stats.engagementRules.active}</div>
          <div className="text-xs text-muted-foreground mt-1">
            / {stats.engagementRules.total} ルール
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">未読通知</div>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold">{stats.recentActivity.notifications}</div>
          <div className="text-xs text-muted-foreground mt-1">
            要確認
          </div>
        </Card>
      </div>

      {/* Account Statistics */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">アカウント統計</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Accounts */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">メインアカウント</h3>
                <p className="text-sm text-muted-foreground">主要アカウント</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">総数</span>
                <span className="font-semibold">{stats.mainAccounts.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">アクティブ</span>
                <span className="font-semibold text-green-600">{stats.mainAccounts.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">トークン有効</span>
                <span className="font-semibold text-blue-600">{stats.mainAccounts.tokenActive}</span>
              </div>
            </div>
          </Card>

          {/* Follow Accounts */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <UserPlus className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">フォローアカウント</h3>
                <p className="text-sm text-muted-foreground">ターゲットアカウント</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">総数</span>
                <span className="font-semibold">{stats.followAccounts.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">アクティブ</span>
                <span className="font-semibold text-green-600">{stats.followAccounts.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">高優先度</span>
                <span className="font-semibold text-red-600">{stats.followAccounts.highPriority}</span>
              </div>
            </div>
          </Card>

          {/* Spam Accounts */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <UsersRound className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">スパムアカウント</h3>
                <p className="text-sm text-muted-foreground">補助アカウント</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">総数</span>
                <span className="font-semibold">{stats.spamAccounts.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">アクティブ</span>
                <span className="font-semibold text-green-600">{stats.spamAccounts.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">プロキシ割当</span>
                <span className="font-semibold text-blue-600">{stats.spamAccounts.withProxy}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Infrastructure & Automation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Proxies */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <Globe className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold">プロキシ</h3>
              <p className="text-sm text-muted-foreground">インフラストラクチャ</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">総プロキシ数</span>
              <span className="font-semibold">{stats.proxies.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">アクティブ</span>
              <span className="font-semibold text-green-600">{stats.proxies.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">正常動作</span>
              <span className="font-semibold text-blue-600">{stats.proxies.healthy}</span>
            </div>
          </div>
        </Card>

        {/* Engagement Rules */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-pink-500/10">
              <Zap className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <h3 className="font-semibold">エンゲージメントルール</h3>
              <p className="text-sm text-muted-foreground">自動化設定</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">総ルール数</span>
              <span className="font-semibold">{stats.engagementRules.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">アクティブ</span>
              <span className="font-semibold text-green-600">{stats.engagementRules.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">非アクティブ</span>
              <span className="font-semibold text-gray-600">
                {stats.engagementRules.total - stats.engagementRules.active}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="text-xl font-bold mb-4">クイックアクション</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            className="p-4 hover:bg-accent cursor-pointer transition-colors"
            onClick={() => window.location.href = '/accounts/main'}
          >
            <Users className="h-8 w-8 mb-2 text-blue-500" />
            <div className="font-semibold">メインアカウント</div>
            <div className="text-sm text-muted-foreground">アカウント管理</div>
          </Card>
          <Card
            className="p-4 hover:bg-accent cursor-pointer transition-colors"
            onClick={() => window.location.href = '/proxies'}
          >
            <Globe className="h-8 w-8 mb-2 text-orange-500" />
            <div className="font-semibold">プロキシ</div>
            <div className="text-sm text-muted-foreground">プロキシ設定</div>
          </Card>
          <Card
            className="p-4 hover:bg-accent cursor-pointer transition-colors"
            onClick={() => window.location.href = '/engagement'}
          >
            <Zap className="h-8 w-8 mb-2 text-pink-500" />
            <div className="font-semibold">エンゲージメント</div>
            <div className="text-sm text-muted-foreground">自動化ルール</div>
          </Card>
          <Card
            className="p-4 hover:bg-accent cursor-pointer transition-colors"
            onClick={() => window.location.href = '/notifications'}
          >
            <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
            <div className="font-semibold">通知</div>
            <div className="text-sm text-muted-foreground">
              {stats.recentActivity.notifications > 0 ? (
                <span className="text-red-500 font-semibold">
                  {stats.recentActivity.notifications}件未読
                </span>
              ) : (
                '通知を確認'
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
