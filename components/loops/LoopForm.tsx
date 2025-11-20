'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Loop {
  id: string;
  loop_name: string;
  loop_type: 'post' | 'reply' | 'cta';
  description: string | null;
  is_active: boolean;
  template_ids: string[] | null;
  selection_mode: 'random' | 'sequential';
  execution_interval_hours: number;
  execution_interval_minutes: number | null;
  min_accounts: number;
  max_accounts: number;
  executor_account_ids: string[] | null;
  allowed_account_tags: string[] | null;
  target_type: 'search' | 'account_url' | 'tweet_url' | null;
  target_value: string | null;
  execution_count: number;
  monitor_account_handle: string | null;
  tags: string[] | null;
}

interface LoopFormProps {
  loop?: Loop | null;
  onClose: () => void;
}

export default function LoopForm({ loop, onClose }: LoopFormProps) {
  const [formData, setFormData] = useState({
    loop_name: '',
    loop_type: 'post' as 'post' | 'reply' | 'cta',
    description: '',
    template_ids: [] as string[],
    selection_mode: 'random' as 'random' | 'sequential',
    execution_interval_minutes: 60,
    min_accounts: 1,
    max_accounts: 3,
    executor_account_ids: [] as string[],
    allowed_account_tags: '',
    target_type: 'search' as 'search' | 'account_url' | 'tweet_url',
    target_value: '',
    execution_count: 5,
    monitor_account_handle: '',
    tags: '',
    is_active: true,
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
    loadTemplates();
    if (loop) {
      setFormData({
        loop_name: loop.loop_name,
        loop_type: loop.loop_type || 'post',
        description: loop.description || '',
        template_ids: loop.template_ids || [],
        selection_mode: loop.selection_mode || 'random',
        execution_interval_minutes: loop.execution_interval_minutes || (loop.execution_interval_hours * 60),
        min_accounts: loop.min_accounts,
        max_accounts: loop.max_accounts,
        executor_account_ids: loop.executor_account_ids || [],
        allowed_account_tags: loop.allowed_account_tags ? loop.allowed_account_tags.join(', ') : '',
        target_type: loop.target_type || 'search',
        target_value: loop.target_value || '',
        execution_count: loop.execution_count || 5,
        monitor_account_handle: loop.monitor_account_handle || '',
        tags: loop.tags ? loop.tags.join(', ') : '',
        is_active: loop.is_active,
      });
    }
  }, [loop]);

  useEffect(() => {
    loadTemplates();
  }, [formData.loop_type]);

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

  async function loadTemplates() {
    try {
      // Load templates based on loop type
      let templateType = 'post';
      if (formData.loop_type === 'reply' || formData.loop_type === 'cta') {
        templateType = 'reply';
      }

      const { data, error } = await supabase
        .from('post_templates')
        .select('id, name, description, template_type')
        .eq('is_active', true)
        .eq('template_type', templateType)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  const toggleAccountSelection = (accountId: string) => {
    if (formData.loop_type === 'cta') {
      // CTA loop: only one account allowed
      setFormData(prev => ({
        ...prev,
        executor_account_ids: prev.executor_account_ids.includes(accountId) ? [] : [accountId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        executor_account_ids: prev.executor_account_ids.includes(accountId)
          ? prev.executor_account_ids.filter(id => id !== accountId)
          : [...prev.executor_account_ids, accountId]
      }));
    }
  };

  const toggleTemplateSelection = (templateId: string) => {
    setFormData(prev => ({
      ...prev,
      template_ids: prev.template_ids.includes(templateId)
        ? prev.template_ids.filter(id => id !== templateId)
        : [...prev.template_ids, templateId]
    }));
  };

  const selectAllAccounts = () => {
    if (formData.loop_type === 'cta') return; // CTA: can't select all
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

  const selectAllTemplates = () => {
    setFormData(prev => ({
      ...prev,
      template_ids: templates.map(t => t.id)
    }));
  };

  const deselectAllTemplates = () => {
    setFormData(prev => ({
      ...prev,
      template_ids: []
    }));
  };

  const handleLoopTypeChange = (newType: 'post' | 'reply' | 'cta') => {
    setFormData(prev => ({
      ...prev,
      loop_type: newType,
      template_ids: [], // Reset template selection when type changes
      executor_account_ids: newType === 'cta' ? (prev.executor_account_ids.slice(0, 1)) : prev.executor_account_ids,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      // Validation
      if (!formData.loop_name) throw new Error('ループ名は必須です');
      if (formData.template_ids.length === 0) throw new Error('少なくとも1つのテンプレートを選択してください');

      if (formData.loop_type === 'reply') {
        if (!formData.target_value) throw new Error('リプライループにはターゲット値が必要です');
        if (formData.execution_count < 1) throw new Error('実行回数は1以上である必要があります');
      }

      if (formData.loop_type === 'cta') {
        if (!formData.monitor_account_handle) throw new Error('CTAループには監視アカウントハンドルが必要です');
        if (formData.executor_account_ids.length !== 1) throw new Error('CTAループには実行アカウントを1つだけ選択してください');
      }

      const allowedAccountTags = formData.allowed_account_tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const payload: any = {
        loop_name: formData.loop_name,
        loop_type: formData.loop_type,
        description: formData.description || null,
        template_ids: formData.template_ids,
        selection_mode: formData.selection_mode,
        is_active: formData.is_active,
        user_id: user.id,
        tags: tags.length > 0 ? tags : null,
      };

      // Common fields for post and reply loops
      if (formData.loop_type !== 'cta') {
        payload.execution_interval_minutes = formData.execution_interval_minutes;
        payload.min_accounts = formData.min_accounts;
        payload.max_accounts = formData.max_accounts;
        payload.executor_account_ids = formData.executor_account_ids.length > 0 ? formData.executor_account_ids : null;
        payload.allowed_account_tags = allowedAccountTags.length > 0 ? allowedAccountTags : null;
      }

      // Reply loop specific fields
      if (formData.loop_type === 'reply') {
        payload.target_type = formData.target_type;
        payload.target_value = formData.target_value;
        payload.execution_count = formData.execution_count;
      }

      // CTA loop specific fields
      if (formData.loop_type === 'cta') {
        payload.monitor_account_handle = formData.monitor_account_handle;
        payload.executor_account_ids = formData.executor_account_ids.length > 0 ? formData.executor_account_ids : null;
      }

      if (loop) {
        const { error: updateError } = await supabase
          .from('loops')
          .update(payload)
          .eq('id', loop.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('loops')
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
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-gray-200 z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {loop ? 'ループ編集' : '新規ループ作成'}
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

          {/* ループタイプ選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              ループタイプ *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition ${
                formData.loop_type === 'post'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="loop_type"
                  value="post"
                  checked={formData.loop_type === 'post'}
                  onChange={() => handleLoopTypeChange('post')}
                  className="sr-only"
                />
                <span className="text-lg font-bold">📝</span>
                <span className="text-sm font-semibold">投稿ループ</span>
                <span className="text-xs text-gray-600 text-center">定期的に投稿を実行</span>
              </label>

              <label className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition ${
                formData.loop_type === 'reply'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="loop_type"
                  value="reply"
                  checked={formData.loop_type === 'reply'}
                  onChange={() => handleLoopTypeChange('reply')}
                  className="sr-only"
                />
                <span className="text-lg font-bold">💬</span>
                <span className="text-sm font-semibold">リプライループ</span>
                <span className="text-xs text-gray-600 text-center">指定条件の投稿にリプライ</span>
              </label>

              <label className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition ${
                formData.loop_type === 'cta'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="loop_type"
                  value="cta"
                  checked={formData.loop_type === 'cta'}
                  onChange={() => handleLoopTypeChange('cta')}
                  className="sr-only"
                />
                <span className="text-lg font-bold">🎯</span>
                <span className="text-sm font-semibold">CTAループ</span>
                <span className="text-xs text-gray-600 text-center">特定アカウント監視</span>
              </label>
            </div>
          </div>

          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">基本情報</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ループ名 *
              </label>
              <input
                type="text"
                required
                value={formData.loop_name}
                onChange={(e) => setFormData({ ...formData, loop_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: デイリー投稿ループ"
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
                placeholder="このループの目的や内容を記述"
              />
            </div>
          </div>

          {/* テンプレート選択（複数可） */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">
              {formData.loop_type === 'post' ? '投稿テンプレート' : 'リプライテンプレート'} *
            </h3>

            {formData.loop_type === 'post' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  選択モード
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="random"
                      checked={formData.selection_mode === 'random'}
                      onChange={(e) => setFormData({ ...formData, selection_mode: e.target.value as any })}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">ランダム選択</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="sequential"
                      checked={formData.selection_mode === 'sequential'}
                      onChange={(e) => setFormData({ ...formData, selection_mode: e.target.value as any })}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">順番に選択</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  テンプレート選択 ({formData.template_ids.length}件選択中)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllTemplates}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    すべて選択
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllTemplates}
                    className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                  >
                    選択解除
                  </button>
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto bg-gray-50">
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    利用可能なテンプレートがありません
                  </p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <label
                        key={template.id}
                        className="flex items-start gap-3 p-3 hover:bg-gray-100 rounded cursor-pointer border border-gray-200"
                      >
                        <input
                          type="checkbox"
                          checked={formData.template_ids.includes(template.id)}
                          onChange={() => toggleTemplateSelection(template.id)}
                          className="w-4 h-4 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900 block">
                            {template.name}
                          </span>
                          {template.description && (
                            <span className="text-xs text-gray-500 block mt-1">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 投稿ループとリプライループ共通：実行設定 */}
          {formData.loop_type !== 'cta' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">実行設定</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  実行間隔（分） *
                </label>
                <input
                  type="number"
                  min="1"
                  max="10080"
                  required
                  value={formData.execution_interval_minutes}
                  onChange={(e) => setFormData({ ...formData, execution_interval_minutes: parseInt(e.target.value) || 60 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  1分〜10080分（7日）の範囲で設定してください
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最小アカウント数 *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.min_accounts}
                    onChange={(e) => setFormData({ ...formData, min_accounts: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最大アカウント数 *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.max_accounts}
                    onChange={(e) => setFormData({ ...formData, max_accounts: parseInt(e.target.value) || 3 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* リプライループ専用：ターゲット設定 */}
          {formData.loop_type === 'reply' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">ターゲット設定</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ターゲットタイプ *
                </label>
                <select
                  required
                  value={formData.target_type}
                  onChange={(e) => setFormData({ ...formData, target_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="search">検索条件（キーワード、ハッシュタグ）</option>
                  <option value="account_url">アカウントホームURL</option>
                  <option value="tweet_url">特定の投稿URL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ターゲット値 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={
                    formData.target_type === 'search' ? '例: AI OR プログラミング' :
                    formData.target_type === 'account_url' ? '例: https://x.com/username' :
                    '例: https://x.com/username/status/123456789'
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  実行回数 *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={formData.execution_count}
                  onChange={(e) => setFormData({ ...formData, execution_count: parseInt(e.target.value) || 5 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  1回の実行で何回リプライを行うか
                </p>
              </div>
            </div>
          )}

          {/* CTAループ専用：監視設定 */}
          {formData.loop_type === 'cta' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">監視設定</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  監視するアカウントハンドル *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">@</span>
                  <input
                    type="text"
                    required
                    value={formData.monitor_account_handle}
                    onChange={(e) => setFormData({ ...formData, monitor_account_handle: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例: elonmusk"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  このアカウントが投稿した際に自動的にCTAリプライを実行します
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ CTAループは実行間隔がなく、監視アカウントの新規投稿に即座に反応します。実行アカウントは1つだけ選択してください。
                </p>
              </div>
            </div>
          )}

          {/* 実行アカウント選択 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b">
              実行アカウント {formData.loop_type === 'cta' && '（1つだけ選択）'}
            </h3>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  アカウント選択 ({formData.executor_account_ids.length}件選択中)
                </label>
                {formData.loop_type !== 'cta' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllAccounts}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      すべて選択
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllAccounts}
                      className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                    >
                      選択解除
                    </button>
                  </div>
                )}
              </div>

              <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
                {accounts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    有効なアカウントがありません
                  </p>
                ) : (
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <label
                        key={account.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"
                      >
                        <input
                          type={formData.loop_type === 'cta' ? 'radio' : 'checkbox'}
                          checked={formData.executor_account_ids.includes(account.id)}
                          onChange={() => toggleAccountSelection(account.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-900">
                          @{account.handle}
                        </span>
                        {account.name && (
                          <span className="text-xs text-gray-500">
                            ({account.name})
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {formData.loop_type !== 'cta' && (
                <>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      許可アカウントタグ（カンマ区切り）
                    </label>
                    <input
                      type="text"
                      value={formData.allowed_account_tags}
                      onChange={(e) => setFormData({ ...formData, allowed_account_tags: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="メイン, 公式"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* タグ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="デイリー, プロモーション"
            />
          </div>

          {/* 有効化 */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              このループを有効化する
            </label>
          </div>

          {/* ボタン */}
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
              {loading ? '保存中...' : loop ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
