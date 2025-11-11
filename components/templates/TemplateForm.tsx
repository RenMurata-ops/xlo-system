'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Template {
  id: string;
  template_name: string;
  template_type: 'post' | 'reply' | 'cta';
  content: string;
  variables: string[] | null;
  category: string | null;
  tags: string[] | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateFormProps {
  template?: Template | null;
  onClose: () => void;
}

export default function TemplateForm({ template, onClose }: TemplateFormProps) {
  const [formData, setFormData] = useState({
    template_name: '',
    template_type: 'post' as 'post' | 'reply' | 'cta',
    content: '',
    variables: '',
    category: '',
    tags: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (template) {
      setFormData({
        template_name: template.template_name,
        template_type: template.template_type,
        content: template.content,
        variables: template.variables ? template.variables.join(', ') : '',
        category: template.category || '',
        tags: template.tags ? template.tags.join(', ') : '',
        is_active: template.is_active,
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const variables = formData.variables
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);

      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const payload = {
        template_name: formData.template_name,
        template_type: formData.template_type,
        content: formData.content,
        variables: variables.length > 0 ? variables : null,
        category: formData.category || null,
        tags: tags.length > 0 ? tags : null,
        is_active: formData.is_active,
        user_id: user.id,
      };

      if (template) {
        const { error: updateError } = await supabase
          .from('templates')
          .update(payload)
          .eq('id', template.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('templates')
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

  const charCount = formData.content.length;
  const maxChars = formData.template_type === 'reply' ? 280 : 280;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {template ? 'テンプレート編集' : '新規テンプレート作成'}
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
              テンプレート名 *
            </label>
            <input
              type="text"
              required
              value={formData.template_name}
              onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: デイリー投稿テンプレート"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              テンプレートタイプ *
            </label>
            <select
              required
              value={formData.template_type}
              onChange={(e) => setFormData({ ...formData, template_type: e.target.value as 'post' | 'reply' | 'cta' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="post">投稿</option>
              <option value="reply">リプライ</option>
              <option value="cta">CTA</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              コンテンツ *
            </label>
            <textarea
              required
              rows={6}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isOverLimit ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="テンプレートの内容を入力してください。変数は {{variable_name}} の形式で使用できます。"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                変数は {'{{'} と {'}}' } で囲んで使用してください
              </p>
              <p className={`text-sm ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                {charCount} / {maxChars}
              </p>
            </div>
            {isOverLimit && (
              <p className="text-xs text-red-600 mt-1">
                文字数制限を超えています
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              変数（カンマ区切り）
            </label>
            <input
              type="text"
              value={formData.variables}
              onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="user_name, product_name, date"
            />
            <p className="mt-1 text-xs text-gray-500">
              コンテンツ内で使用する変数を入力してください
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カテゴリ
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: プロモーション"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="デイリー, エンゲージメント"
            />
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
              このテンプレートを有効化する
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
              disabled={loading || isOverLimit}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '保存中...' : template ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
