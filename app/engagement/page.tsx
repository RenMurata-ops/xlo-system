'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Zap, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import EngagementRuleForm from '@/components/engagement/EngagementRuleForm';

interface EngagementRule {
  id: string;
  rule_name: string;
  rule_type: 'keyword' | 'url' | 'user';
  is_active: boolean;

  // Search Settings
  search_keywords?: string[] | null;
  exclude_keywords?: string[] | null;
  target_urls?: string[] | null;
  target_user_ids?: string[] | null;

  // Filters
  min_followers?: number;
  max_followers?: number | null;
  account_age_days?: number;

  // Actions
  action_type: 'like' | 'reply' | 'follow' | 'retweet';
  like_strategy?: string;
  likes_per_follower?: number;
  reply_template_id?: string | null;

  // Execution
  executor_account_ids?: string[] | null;
  account_selection_mode?: string;
  max_accounts_per_run?: number;

  // Schedule
  execution_frequency_minutes?: number;
  detection_delay_minutes?: number;
  max_executions_per_hour?: number;
  schedule_enabled?: boolean;
  schedule_days_of_week?: number[] | null;
  schedule_hours?: number[] | null;

  // Auto Unfollow
  auto_unfollow_enabled?: boolean;
  unfollow_after_days?: number;

  created_at: string;
  updated_at: string;
}

export default function EngagementPage() {
  const [rules, setRules] = useState<EngagementRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<EngagementRule | null>(null);
  const [executingRule, setExecutingRule] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadRules();
  }, [filter, typeFilter]);

  async function loadRules() {
    try {
      setLoading(true);

      let query = supabase
        .from('auto_engagement_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (typeFilter !== 'all') {
        query = query.eq('rule_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このルールを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('auto_engagement_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRules(rules.filter(rule => rule.id !== id));
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('auto_engagement_rules')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setRules(rules.map(rule =>
        rule.id === id ? { ...rule, is_active: !currentStatus } : rule
      ));
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('ステータス変更に失敗しました');
    }
  }

  async function handleExecuteRule(ruleId: string) {
    if (!confirm('このルールを今すぐ実行しますか？')) return;

    setExecutingRule(ruleId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-auto-engagement`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rule_id: ruleId }),
        }
      );

      if (!response.ok) {
        throw new Error('ルール実行に失敗しました');
      }

      const result = await response.json();
      alert(`実行完了: ${result.total_actions}件のアクション実行 (成功: ${result.total_successes}, 失敗: ${result.total_failures})`);
      loadRules(); // Refresh rules list
    } catch (error: any) {
      console.error('Execution error:', error);
      alert(`実行エラー: ${error.message}`);
    } finally {
      setExecutingRule(null);
    }
  }

  function handleEdit(rule: EngagementRule) {
    setEditingRule(rule);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingRule(null);
    loadRules();
  }

  function getRuleTypeBadge(type: string) {
    const colors = {
      keyword: 'bg-blue-500',
      url: 'bg-purple-500',
      user: 'bg-green-500',
    };

    const labels = {
      keyword: 'キーワード',
      url: 'URL',
      user: 'ユーザー',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded text-xs text-white font-medium',
          colors[type as keyof typeof colors] || 'bg-gray-500'
        )}
      >
        {labels[type as keyof typeof labels] || type}
      </span>
    );
  }

  function getActionTypeBadge(type: string) {
    const colors = {
      like: 'bg-pink-500',
      reply: 'bg-blue-500',
      follow: 'bg-green-500',
      retweet: 'bg-purple-500',
    };

    const labels = {
      like: 'いいね',
      reply: 'リプライ',
      follow: 'フォロー',
      retweet: 'リツイート',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded text-xs text-white font-medium',
          colors[type as keyof typeof colors] || 'bg-gray-500'
        )}
      >
        {labels[type as keyof typeof labels] || type}
      </span>
    );
  }

  const activeRules = rules.filter(r => r.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Zap className="h-8 w-8" />
              エンゲージメント自動化
            </h1>
            <p className="text-muted-foreground mt-1">
              {rules.length} ルール | {activeRules} アクティブ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={loadRules} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              更新
            </Button>
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新規ルール
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              すべて
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              アクティブ
            </Button>
            <Button
              variant={filter === 'inactive' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('inactive')}
            >
              非アクティブ
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={typeFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('all')}
            >
              すべてのタイプ
            </Button>
            <Button
              variant={typeFilter === 'keyword' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('keyword')}
            >
              キーワード
            </Button>
            <Button
              variant={typeFilter === 'url' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('url')}
            >
              URL
            </Button>
            <Button
              variant={typeFilter === 'user' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('user')}
            >
              ユーザー
            </Button>
          </div>
        </div>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            エンゲージメントルールがありません
          </h3>
          <p className="text-muted-foreground mb-4">
            自動エンゲージメントルールを作成してください
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            最初のルールを作成
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <Card key={rule.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{rule.rule_name}</h3>
                    {getRuleTypeBadge(rule.rule_type)}
                    {getActionTypeBadge(rule.action_type)}
                    {rule.is_active ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    {rule.schedule_enabled && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white">
                        スケジュール有効
                      </span>
                    )}
                    {rule.auto_unfollow_enabled && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange-500 text-white">
                        自動アンフォロー
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    {rule.search_keywords && rule.search_keywords.length > 0 && (
                      <div>
                        キーワード: {rule.search_keywords.slice(0, 3).join(', ')}
                        {rule.search_keywords.length > 3 && ` +${rule.search_keywords.length - 3}個`}
                      </div>
                    )}
                    {rule.target_urls && rule.target_urls.length > 0 && (
                      <div>
                        ターゲットURL: {rule.target_urls.length}個
                      </div>
                    )}
                    {rule.target_user_ids && rule.target_user_ids.length > 0 && (
                      <div>
                        ターゲットユーザー: {rule.target_user_ids.length}人
                      </div>
                    )}
                    <div>
                      実行頻度: {rule.execution_frequency_minutes}分ごと
                      {rule.max_executions_per_hour && ` (最大${rule.max_executions_per_hour}回/時)`}
                    </div>
                    {rule.executor_account_ids && rule.executor_account_ids.length > 0 && (
                      <div>
                        実行アカウント: {rule.executor_account_ids.length}個
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExecuteRule(rule.id)}
                    disabled={executingRule === rule.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {executingRule === rule.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        実行中
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-1" />
                        今すぐ実行
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(rule)}
                    title="編集"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(rule.id, rule.is_active)}
                    title={rule.is_active ? '非アクティブ化' : 'アクティブ化'}
                  >
                    {rule.is_active ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rule.id)}
                    title="削除"
                    className="text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <EngagementRuleForm
          rule={editingRule}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
