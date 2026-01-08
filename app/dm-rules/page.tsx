'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Clock, Mail, AlertCircle, Pause, Play, Zap, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import DMSendRuleForm from '@/components/dm/DMSendRuleForm';

interface Rule {
  id: string;
  account_token_id: string;
  account_type: 'main' | 'spam' | 'follow';
  template_id: string;
  delay_slot_hours: number;
  daily_limit: number | null;
  status: 'active' | 'paused';
  created_at: string;
  updated_at: string;
  templates?: { template_name: string } | null;
  account_tokens?: { x_username: string; account_type: string } | null;
}

export default function DMRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [runningDetect, setRunningDetect] = useState(false);
  const [runningDispatch, setRunningDispatch] = useState(false);
  const supabase = createClient();

  const delayLabel = (h: number) => (h === 0 ? '即時' : `${h}時間後`);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dm_send_rules')
        .select(`
          *,
          templates ( template_name ),
          account_tokens ( x_username, account_type )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error(error);
      toast.error('DMルールの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('このDMルールを削除しますか？')) return;
    try {
      const { error } = await supabase.from('dm_send_rules').delete().eq('id', id);
      if (error) throw error;
      toast.success('削除しました');
      loadRules();
    } catch (error) {
      console.error(error);
      toast.error('削除に失敗しました');
    }
  };

  const handleToggleStatus = async (rule: Rule) => {
    try {
      const next = rule.status === 'active' ? 'paused' : 'active';
      const { error } = await supabase
        .from('dm_send_rules')
        .update({ status: next })
        .eq('id', rule.id);
      if (error) throw error;
      toast.success(next === 'active' ? '有効化しました' : '一時停止しました');
      loadRules();
    } catch (error) {
      console.error(error);
      toast.error('ステータス変更に失敗しました');
    }
  };

  const summary = useMemo(() => {
    const active = rules.filter(r => r.status === 'active').length;
    return { total: rules.length, active };
  }, [rules]);

  const runDetectFollowbacks = async () => {
    setRunningDetect(true);
    const toastId = toast.loading('フォローバック検知を実行中...');
    try {
      const { data, error } = await supabase.functions.invoke('detect-followbacks', {
        body: {},
      });
      if (error) throw error;
      toast.success('フォローバック検知を実行しました', {
        id: toastId,
        description: `検知/キュー追加: ${data?.enqueued ?? 'N/A'}件`,
      });
    } catch (err: any) {
      console.error('detect-followbacks error', err);
      toast.error('フォローバック検知に失敗しました', {
        id: toastId,
        description: err?.message || 'エラーが発生しました',
      });
    } finally {
      setRunningDetect(false);
    }
  };

  const runDispatchDms = async () => {
    setRunningDispatch(true);
    const toastId = toast.loading('DM送信を実行中...');
    try {
      const { data, error } = await supabase.functions.invoke('dispatch-dms', {
        body: {},
      });
      if (error) throw error;
      toast.success('DM送信を実行しました', {
        id: toastId,
        description: `処理: ${data?.processed ?? 'N/A'}件 / 送信: ${data?.sent ?? 'N/A'}件`,
      });
    } catch (err: any) {
      console.error('dispatch-dms error', err);
      toast.error('DM送信に失敗しました', {
        id: toastId,
        description: err?.message || 'エラーが発生しました',
      });
    } finally {
      setRunningDispatch(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">フォローバック自動DM</h1>
          <p className="text-gray-600 mt-2">
            フォローバックを検知してテンプレートDMを送信するルールを管理します
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={runDetectFollowbacks}
            disabled={runningDetect}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <Zap size={18} className={runningDetect ? 'animate-spin' : ''} />
            検知を今すぐ実行
          </button>
          <button
            onClick={runDispatchDms}
            disabled={runningDispatch}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <Send size={18} className={runningDispatch ? 'animate-pulse' : ''} />
            DM送信を今すぐ実行
          </button>
          <button
            onClick={loadRules}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={18} /> 更新
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} /> 新規ルール
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-sm text-gray-600">ルール数</div>
          <div className="text-3xl font-bold text-gray-900">{summary.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-sm text-gray-600">有効</div>
          <div className="text-3xl font-bold text-green-600">{summary.active}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-sm text-gray-600">テンプレートタイプ</div>
          <div className="text-lg font-semibold text-orange-600">DMのみ</div>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
          ルールがありません。新規作成してください。
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white border rounded-lg shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-blue-600" />
                  <div className="text-lg font-semibold text-gray-900">
                    {rule.templates?.template_name || 'DMテンプレート'}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    rule.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {rule.status === 'active' ? '有効' : '一時停止'}
                </span>
              </div>

              <div className="text-sm text-gray-600 flex flex-wrap gap-3">
                <span className="flex items-center gap-1">
                  <Clock size={14} /> 遅延: {delayLabel(rule.delay_slot_hours)}
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle size={14} /> 上限: {rule.daily_limit ?? '未設定'}
                </span>
                <span className="flex items-center gap-1">
                  送信元: @{rule.account_tokens?.x_username || 'N/A'} ({rule.account_type})
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleToggleStatus(rule)}
                  className={`px-3 py-2 rounded text-sm flex items-center gap-1 ${
                    rule.status === 'active'
                      ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {rule.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  {rule.status === 'active' ? '停止' : '有効化'}
                </button>
                <button
                  onClick={() => {
                    setEditingRule(rule);
                    setShowForm(true);
                  }}
                  className="px-3 py-2 rounded text-sm bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="px-3 py-2 rounded text-sm bg-red-50 text-red-700 hover:bg-red-100"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <DMSendRuleForm
          rule={editingRule}
          onClose={() => {
            setShowForm(false);
            setEditingRule(null);
            loadRules();
          }}
        />
      )}
    </div>
  );
}
