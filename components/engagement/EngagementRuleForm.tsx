'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface EngagementRule {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  search_type: 'keyword' | 'url' | 'user' | 'hashtag';
  search_query: string;
  action_type?: 'like' | 'reply' | 'retweet' | 'follow' | 'quote'; // Keep for backward compatibility
  action_types: ('like' | 'reply' | 'retweet' | 'follow' | 'quote')[];
  reply_template_id: string | null;
  min_followers: number;
  max_followers: number | null;
  min_account_age_days: number;
  exclude_keywords: string[] | null;
  exclude_verified: boolean;
  require_verified: boolean;
  executor_account_ids: string[] | null;
  allowed_account_tags: string[] | null;
  max_actions_per_execution: number;
  execution_interval_hours: number;
  daily_limit: number;
  // Advanced search filters
  search_since: string | null;
  search_until: string | null;
  min_retweets: number | null;
  max_retweets: number | null;
  min_faves: number | null;
  max_faves: number | null;
  min_replies: number | null;
  max_replies: number | null;
  has_engagement: boolean;
}

interface EngagementRuleFormProps {
  rule?: EngagementRule | null;
  onClose: () => void;
}

export default function EngagementRuleForm({ rule, onClose }: EngagementRuleFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    search_type: 'keyword' as 'keyword' | 'url' | 'user' | 'hashtag',
    search_query: '',
    action_types: ['like'] as ('like' | 'reply' | 'retweet' | 'follow' | 'quote')[],
    reply_template_id: '',
    min_followers: 0,
    max_followers: '',
    min_account_age_days: 0,
    exclude_keywords: '',
    exclude_verified: false,
    require_verified: false,
    executor_account_ids: [] as string[],
    allowed_account_tags: '',
    max_actions_per_execution: 10,
    execution_interval_hours: 1,
    daily_limit: 100,
    is_active: true,
    // Advanced X search filters
    search_since: '',
    search_until: '',
    min_retweets: 0,
    max_retweets: '',
    min_faves: 0,
    max_faves: '',
    min_replies: 0,
    max_replies: '',
    has_engagement: false,
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
    loadTemplates();
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description || '',
        search_type: rule.search_type,
        search_query: rule.search_query,
        action_types: rule.action_types || (rule.action_type ? [rule.action_type] : ['like']),
        reply_template_id: rule.reply_template_id || '',
        min_followers: rule.min_followers,
        max_followers: rule.max_followers?.toString() || '',
        min_account_age_days: rule.min_account_age_days,
        exclude_keywords: rule.exclude_keywords ? rule.exclude_keywords.join(', ') : '',
        exclude_verified: rule.exclude_verified,
        require_verified: rule.require_verified,
        executor_account_ids: rule.executor_account_ids || [],
        allowed_account_tags: rule.allowed_account_tags ? rule.allowed_account_tags.join(', ') : '',
        max_actions_per_execution: rule.max_actions_per_execution,
        execution_interval_hours: rule.execution_interval_hours,
        daily_limit: rule.daily_limit,
        is_active: rule.is_active,
        // Advanced search filters
        search_since: rule.search_since || '',
        search_until: rule.search_until || '',
        min_retweets: rule.min_retweets || 0,
        max_retweets: rule.max_retweets?.toString() || '',
        min_faves: rule.min_faves || 0,
        max_faves: rule.max_faves?.toString() || '',
        min_replies: rule.min_replies || 0,
        max_replies: rule.max_replies?.toString() || '',
        has_engagement: rule.has_engagement || false,
      });
    }
  }, [rule]);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('main_accounts')
        .select('id, handle, name, is_active')
        .eq('is_active', true)
        .order('handle');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  const toggleAccountSelection = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      executor_account_ids: prev.executor_account_ids.includes(accountId)
        ? prev.executor_account_ids.filter(id => id !== accountId)
        : [...prev.executor_account_ids, accountId]
    }));
  };

  const toggleActionType = (actionType: 'like' | 'reply' | 'retweet' | 'follow') => {
    setFormData(prev => ({
      ...prev,
      action_types: prev.action_types.includes(actionType)
        ? prev.action_types.filter(a => a !== actionType)
        : [...prev.action_types, actionType]
    }));
  };

  const selectAllAccounts = () => {
    setFormData(prev => ({
      ...prev,
      executor_account_ids: accounts.map(a => a.id)
    }));
  };

  const deselectAllAccounts = () => {
    setFormData(prev => ({
      ...prev,
      executor_account_ids: []
    }));
  };

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('post_templates')
        .select('id, name, template_type')
        .eq('is_active', true)
        .eq('template_type', 'reply')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      if (!formData.name) throw new Error('ルール名は必須です');
      if (!formData.search_query) throw new Error('検索クエリは必須です');
      if (formData.action_types.length === 0) throw new Error('少なくとも1つのアクションを選択してください');

      if (formData.action_types.includes('reply') && !formData.reply_template_id) {
        throw new Error('リプライアクションにはテンプレートが必要です');
      }

      const excludeKeywords = formData.exclude_keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const allowedAccountTags = formData.allowed_account_tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const payload = {
        name: formData.name,
        description: formData.description || null,
        search_type: formData.search_type,
        search_query: formData.search_query,
        action_types: formData.action_types,
        reply_template_id: formData.reply_template_id || null,
        min_followers: formData.min_followers,
        max_followers: formData.max_followers ? parseInt(formData.max_followers) : null,
        min_account_age_days: formData.min_account_age_days,
        exclude_keywords: excludeKeywords.length > 0 ? excludeKeywords : null,
        exclude_verified: formData.exclude_verified,
        require_verified: formData.require_verified,
        executor_account_ids: formData.executor_account_ids.length > 0 ? formData.executor_account_ids : null,
        allowed_account_tags: allowedAccountTags.length > 0 ? allowedAccountTags : null,
        max_actions_per_execution: formData.max_actions_per_execution,
        execution_interval_hours: formData.execution_interval_hours,
        daily_limit: formData.daily_limit,
        is_active: formData.is_active,
        user_id: user.id,
        // Advanced search filters
        search_since: formData.search_since || null,
        search_until: formData.search_until || null,
        min_retweets: formData.min_retweets,
        max_retweets: formData.max_retweets ? parseInt(formData.max_retweets) : null,
        min_faves: formData.min_faves,
        max_faves: formData.max_faves ? parseInt(formData.max_faves) : null,
        min_replies: formData.min_replies,
        max_replies: formData.max_replies ? parseInt(formData.max_replies) : null,
        has_engagement: formData.has_engagement,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-gray-200 z-10">
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

          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">基本情報</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ルール名 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: テック系キーワード自動いいね"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="このルールの説明"
              />
            </div>
          </div>

          {/* 検索設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">検索設定</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  検索タイプ *
                </label>
                <select
                  required
                  value={formData.search_type}
                  onChange={(e) => setFormData({ ...formData, search_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="keyword">キーワード検索</option>
                  <option value="hashtag">ハッシュタグ検索</option>
                  <option value="user">ユーザー検索</option>
                  <option value="url">URL検索</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  検索クエリ *
                </label>
                <input
                  type="text"
                  required
                  value={formData.search_query}
                  onChange={(e) => setFormData({ ...formData, search_query: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={
                    formData.search_type === 'keyword' ? '例: AI プログラミング' :
                    formData.search_type === 'hashtag' ? '例: ChatGPT' :
                    formData.search_type === 'user' ? '例: username' : '例: example.com'
                  }
                />
              </div>
            </div>
          </div>

          {/* 高度な検索フィルター */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">高度な検索フィルター（X検索コマンド）</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  開始日 (since:)
                </label>
                <input
                  type="date"
                  value={formData.search_since}
                  onChange={(e) => setFormData({ ...formData, search_since: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">この日以降の投稿を検索</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  終了日 (until:)
                </label>
                <input
                  type="date"
                  value={formData.search_until}
                  onChange={(e) => setFormData({ ...formData, search_until: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">この日より前の投稿を検索</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最小RT数 (min_retweets:)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_retweets}
                  onChange={(e) => setFormData({ ...formData, min_retweets: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最小いいね数 (min_faves:)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_faves}
                  onChange={(e) => setFormData({ ...formData, min_faves: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最小リプライ数 (min_replies:)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_replies}
                  onChange={(e) => setFormData({ ...formData, min_replies: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大RT数 (上限)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.max_retweets}
                  onChange={(e) => setFormData({ ...formData, max_retweets: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="無制限"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大いいね数 (上限)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.max_faves}
                  onChange={(e) => setFormData({ ...formData, max_faves: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="無制限"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大リプライ数 (上限)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.max_replies}
                  onChange={(e) => setFormData({ ...formData, max_replies: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="無制限"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.has_engagement}
                  onChange={(e) => setFormData({ ...formData, has_engagement: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">エンゲージメントがある投稿のみ (filter:has_engagement)</span>
              </label>
              <p className="mt-1 text-xs text-gray-500 ml-6">いいね・RT・リプライのいずれかがある投稿のみを対象</p>
            </div>
          </div>

          {/* アクション設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">アクション設定</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                アクションタイプ * (複数選択可)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.action_types.includes('like')}
                    onChange={() => toggleActionType('like')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">いいね</span>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.action_types.includes('retweet')}
                    onChange={() => toggleActionType('retweet')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">リツイート</span>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.action_types.includes('reply')}
                    onChange={() => toggleActionType('reply')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">リプライ</span>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.action_types.includes('follow')}
                    onChange={() => toggleActionType('follow')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">フォロー</span>
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                選択中: {formData.action_types.length > 0 ? formData.action_types.join(', ') : 'なし'}
              </p>
            </div>

            {formData.action_types.includes('reply') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  リプライテンプレート *
                </label>
                <select
                  required={formData.action_types.includes('reply')}
                  value={formData.reply_template_id}
                  onChange={(e) => setFormData({ ...formData, reply_template_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">テンプレートを選択</option>
                  {templates.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name} ({tmpl.template_type})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  リプライアクションには必ずテンプレートが必要です
                </p>
              </div>
            )}
          </div>

          {/* フィルター設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">フィルター設定</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最小フォロワー数
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_followers}
                  onChange={(e) => setFormData({ ...formData, min_followers: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大フォロワー数
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.max_followers}
                  onChange={(e) => setFormData({ ...formData, max_followers: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="無制限"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最小アカウント年齢（日）
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_account_age_days}
                  onChange={(e) => setFormData({ ...formData, min_account_age_days: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                除外キーワード（カンマ区切り）
              </label>
              <textarea
                rows={2}
                value={formData.exclude_keywords}
                onChange={(e) => setFormData({ ...formData, exclude_keywords: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="スパム, 詐欺, 広告"
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.exclude_verified}
                  onChange={(e) => setFormData({ ...formData, exclude_verified: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">認証済みアカウントを除外</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.require_verified}
                  onChange={(e) => setFormData({ ...formData, require_verified: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">認証済みアカウントのみ</span>
              </label>
            </div>
          </div>

          {/* 実行設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">実行設定</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  実行間隔（時間） *
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  required
                  value={formData.execution_interval_hours}
                  onChange={(e) => setFormData({ ...formData, execution_interval_hours: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1回の実行でのアクション数 *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={formData.max_actions_per_execution}
                  onChange={(e) => setFormData({ ...formData, max_actions_per_execution: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日次リミット *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={formData.daily_limit}
                  onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) || 100 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  実行アカウント
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllAccounts}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    すべて選択
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllAccounts}
                    className="text-xs text-gray-600 hover:text-gray-700"
                  >
                    選択解除
                  </button>
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
                {accounts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">利用可能なアカウントがありません</p>
                ) : (
                  accounts.map((account) => (
                    <label
                      key={account.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.executor_account_ids.includes(account.id)}
                        onChange={() => toggleAccountSelection(account.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        @{account.handle}
                      </span>
                      {account.name && (
                        <span className="text-xs text-gray-500">({account.name})</span>
                      )}
                    </label>
                  ))
                )}
              </div>

              <p className="mt-2 text-sm text-gray-500">
                {formData.executor_account_ids.length > 0
                  ? `${formData.executor_account_ids.length}件のアカウントを選択中`
                  : '未選択の場合はすべてのアクティブアカウントが対象'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                許可するアカウントタグ（カンマ区切り）
              </label>
              <input
                type="text"
                value={formData.allowed_account_tags}
                onChange={(e) => setFormData({ ...formData, allowed_account_tags: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: main, sub"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
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

          <div className="flex items-center justify-end gap-3 pt-4 sticky bottom-0 bg-white border-t">
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
