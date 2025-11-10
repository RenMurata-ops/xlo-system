'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
}

interface EngagementRuleFormProps {
  rule?: EngagementRule | null;
  onClose: () => void;
}

export default function EngagementRuleForm({ rule, onClose }: EngagementRuleFormProps) {
  const [formData, setFormData] = useState({
    rule_name: '',
    rule_type: 'keyword' as 'keyword' | 'url' | 'user',
    execution_frequency_minutes: 30,
    action_type: [] as string[],
    search_keywords: '',
    target_user_ids: '',
    executor_account_ids: '',
    is_active: true,
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
    if (rule) {
      setFormData({
        rule_name: rule.rule_name,
        rule_type: rule.rule_type,
        execution_frequency_minutes: rule.execution_frequency_minutes,
        action_type: rule.action_type,
        search_keywords: rule.search_keywords ? rule.search_keywords.join(', ') : '',
        target_user_ids: rule.target_user_ids ? rule.target_user_ids.join(', ') : '',
        executor_account_ids: rule.executor_account_ids ? rule.executor_account_ids.join(', ') : '',
        is_active: rule.is_active,
      });
    }
  }, [rule]);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('main_accounts')
        .select('id, account_handle')
        .eq('is_active', true)
        .order('account_handle');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  const handleActionTypeToggle = (action: string) => {
    if (formData.action_type.includes(action)) {
      setFormData({
        ...formData,
        action_type: formData.action_type.filter(a => a !== action)
      });
    } else {
      setFormData({
        ...formData,
        action_type: [...formData.action_type, action]
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      if (formData.action_type.length === 0) {
        throw new Error('少なくとも1つのアクションを選択してください');
      }

      const searchKeywords = formData.search_keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const targetUserIds = formData.target_user_ids
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      const executorAccountIds = formData.executor_account_ids
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      const payload = {
        rule_name: formData.rule_name,
        rule_type: formData.rule_type,
        execution_frequency_minutes: formData.execution_frequency_minutes,
        action_type: formData.action_type,
        search_keywords: searchKeywords.length > 0 ? searchKeywords : null,
        target_user_ids: targetUserIds.length > 0 ? targetUserIds : null,
        executor_account_ids: executorAccountIds.length > 0 ? executorAccountIds : null,
        is_active: formData.is_active,
        user_id: user.id,
      };

      if (rule) {
        const { error: updateError } = await supabase
          .from('auto_engagement_rules')
          .update(payload)
          .eq('id', rule.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('auto_engagement_rules')
          .insert([payload]);

        if (insertError) throw insertError;
      }

      onClose();
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {rule ? 'ルール編集' : '新規ルール作成'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ルール名 *
            </label>
            <input
              type="text"
              required
              value={formData.rule_name}
              onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: テック系キーワード自動いいね"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ルールタイプ *
            </label>
            <select
              required
              value={formData.rule_type}
              onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="keyword">キーワードベース</option>
              <option value="url">URLベース</option>
              <option value="user">ユーザーベース</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              実行頻度（分） *
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              required
              value={formData.execution_frequency_minutes}
              onChange={(e) => setFormData({ ...formData, execution_frequency_minutes: parseInt(e.target.value) || 30 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              5分〜1440分（24時間）の範囲で設定してください
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              アクションタイプ *
            </label>
            <div className="space-y-2">
              {['like', 'reply', 'follow', 'retweet'].map(action => (
                <label key={action} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.action_type.includes(action)}
                    onChange={() => handleActionTypeToggle(action)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {action === 'like' && 'いいね'}
                    {action === 'reply' && 'リプライ'}
                    {action === 'follow' && 'フォロー'}
                    {action === 'retweet' && 'リツイート'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {formData.rule_type === 'keyword' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                検索キーワード（カンマ区切り）
              </label>
              <textarea
                rows={3}
                value={formData.search_keywords}
                onChange={(e) => setFormData({ ...formData, search_keywords: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="AI, 機械学習, プログラミング"
              />
            </div>
          )}

          {formData.rule_type === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ターゲットユーザーID（カンマ区切り）
              </label>
              <textarea
                rows={3}
                value={formData.target_user_ids}
                onChange={(e) => setFormData({ ...formData, target_user_ids: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user_id_1, user_id_2, user_id_3"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              実行アカウントID（カンマ区切り）
            </label>
            <textarea
              rows={2}
              value={formData.executor_account_ids}
              onChange={(e) => setFormData({ ...formData, executor_account_ids: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="account_id_1, account_id_2"
            />
            <p className="mt-1 text-sm text-gray-500">
              空欄の場合はすべてのアクティブアカウントが対象になります
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              このルールを有効化する
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '保存中...' : rule ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
