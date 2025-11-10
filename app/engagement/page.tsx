'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Zap, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import EngagementRuleCard from '@/components/engagement/EngagementRuleCard';
import EngagementRuleForm from '@/components/engagement/EngagementRuleForm';
import EngagementHistory from '@/components/engagement/EngagementHistory';

interface EngagementRule {
  id: string;
  rule_name: string;
  rule_type: 'keyword' | 'url' | 'user';
  is_active: boolean;
  execution_frequency_minutes: number;
  action_type: string[];
  search_keywords: string[] | null;
  target_user_ids: string[] | null;
  executor_account_ids: string[] | null;
  total_executions: number;
  success_count: number;
  error_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function EngagementPage() {
  const [rules, setRules] = useState<EngagementRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<EngagementRule | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      const { data, error } = await supabase
        .from('auto_engagement_rules')
        .select('*')
        .order('created_at', { ascending: false });

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

  function handleEdit(rule: EngagementRule) {
    setEditingRule(rule);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingRule(null);
    loadRules();
  }

  const activeRules = rules.filter(r => r.is_active).length;
  const totalExecutions = rules.reduce((sum, r) => sum + r.total_executions, 0);
  const successRate = totalExecutions > 0
    ? ((rules.reduce((sum, r) => sum + r.success_count, 0) / totalExecutions) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">エンゲージメント自動化</h1>
          <p className="text-gray-600 mt-2">
            自動いいね・リプライ・フォローのルールを管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <TrendingUp size={20} />
            実行履歴
          </button>
          <button
            onClick={loadRules}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={20} />
            更新
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            新規ルール
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総ルール数</div>
          <div className="text-3xl font-bold text-gray-900">{rules.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeRules}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総実行回数</div>
          <div className="text-3xl font-bold text-blue-600">{totalExecutions.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">成功率</div>
          <div className="text-3xl font-bold text-purple-600">{successRate}%</div>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Zap size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            エンゲージメントルールがありません
          </h3>
          <p className="text-gray-600 mb-6">
            自動エンゲージメントルールを作成してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            最初のルールを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map(rule => (
            <EngagementRuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => handleEdit(rule)}
              onDelete={() => handleDelete(rule.id)}
              onToggleActive={() => handleToggleActive(rule.id, rule.is_active)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <EngagementRuleForm
          rule={editingRule}
          onClose={handleFormClose}
        />
      )}

      {showHistory && (
        <EngagementHistory
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
