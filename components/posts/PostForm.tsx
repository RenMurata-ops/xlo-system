'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Post {
  id: string;
  content: string;
  media_urls: string[] | null;
  account_id: string;
  scheduled_at: string | null;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  tags: string[] | null;
}

interface PostFormProps {
  post?: Post | null;
  onClose: () => void;
}

export default function PostForm({ post, onClose }: PostFormProps) {
  const [formData, setFormData] = useState({
    content: '',
    media_urls: '',
    account_id: '',
    scheduled_at: '',
    tags: '',
    status: 'draft' as 'draft' | 'scheduled' | 'posted' | 'failed',
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [charCount, setCharCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
    if (post) {
      setFormData({
        content: post.content,
        media_urls: post.media_urls ? post.media_urls.join('\n') : '',
        account_id: post.account_id,
        scheduled_at: post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '',
        tags: post.tags ? post.tags.join(', ') : '',
        status: post.status,
      });
      setCharCount(post.content.length);
    }
  }, [post]);

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('main_accounts')
        .select('id, account_handle, is_active')
        .eq('is_active', true)
        .order('account_handle');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, content: value });
    setCharCount(value.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      if (!formData.account_id) {
        throw new Error('アカウントを選択してください');
      }

      const mediaUrls = formData.media_urls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const payload = {
        content: formData.content,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        account_id: formData.account_id,
        scheduled_at: formData.scheduled_at || null,
        status: formData.scheduled_at ? 'scheduled' : formData.status,
        tags: tags.length > 0 ? tags : null,
        user_id: user.id,
      };

      if (post) {
        const { error: updateError } = await supabase
          .from('posts')
          .update(payload)
          .eq('id', post.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('posts')
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

  const maxChars = 280;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {post ? '投稿編集' : '新規投稿'}
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
              投稿アカウント *
            </label>
            <select
              required
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">アカウントを選択</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  @{account.account_handle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                投稿内容 *
              </label>
              <span className={`text-sm ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                {charCount} / {maxChars}
              </span>
            </div>
            <textarea
              rows={6}
              required
              value={formData.content}
              onChange={handleContentChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isOverLimit ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="ツイート内容を入力..."
            />
            {isOverLimit && (
              <p className="mt-1 text-sm text-red-600">
                文字数制限を超えています
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ImageIcon size={16} className="inline mr-1" />
              メディアURL（1行に1つ）
            </label>
            <textarea
              rows={3}
              value={formData.media_urls}
              onChange={(e) => setFormData({ ...formData, media_urls: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-1" />
              予約投稿日時
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              空白の場合は下書きとして保存されます
            </p>
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
              placeholder="マーケティング, プロモーション, お知らせ"
            />
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
              {loading ? '保存中...' : post ? '更新' : formData.scheduled_at ? '予約' : '下書き保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
