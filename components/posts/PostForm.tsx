'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Post {
  id: string;
  content: string;
  media_urls: string[] | null;
  account_id: string;
  scheduled_at: string | null;
  status: 'draft' | 'scheduled' | 'posted' | 'failed' | 'processing';
  tags: string[] | null;
}

interface PostFormProps {
  post?: Post | null;
  onClose: () => void;
}

interface UploadedMedia {
  url: string;
  name: string;
}

export default function PostForm({ post, onClose }: PostFormProps) {
  const [formData, setFormData] = useState({
    content: '',
    media_urls: '',
    account_ids: [] as string[],
    scheduled_at: '',
    tags: '',
    status: 'draft' as 'draft' | 'scheduled' | 'posted' | 'failed' | 'processing',
    use_interval: false,
    interval_hours: 1,
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
    if (post) {
      // Convert UTC time to local time for datetime-local input
      let scheduledAtLocal = '';
      if (post.scheduled_at) {
        const date = new Date(post.scheduled_at);
        // Get timezone offset and convert to local time
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        scheduledAtLocal = localDate.toISOString().slice(0, 16);
      }

      setFormData({
        content: post.content,
        media_urls: post.media_urls ? post.media_urls.join('\n') : '',
        account_ids: [post.account_id],
        scheduled_at: scheduledAtLocal,
        tags: post.tags ? post.tags.join(', ') : '',
        status: post.status,
        use_interval: false,
        interval_hours: 1,
      });
      setCharCount(post.content.length);
      if (post.media_urls) {
        setUploadedMedia(post.media_urls.map((url, i) => ({ url, name: `画像 ${i + 1}` })));
      }
    }
  }, [post]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedMedia.length + files.length > 4) {
      toast.error('画像は最大4枚までです');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const newMedia: UploadedMedia[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} は画像ファイルではありません`);
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} は5MBを超えています`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`${file.name} のアップロードに失敗しました`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName);

        newMedia.push({ url: publicUrl, name: file.name });
      }

      setUploadedMedia([...uploadedMedia, ...newMedia]);
      toast.success(`${newMedia.length}枚の画像をアップロードしました`);
    } catch (err: any) {
      toast.error(err.message || 'アップロードに失敗しました');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeMedia = (index: number) => {
    setUploadedMedia(uploadedMedia.filter((_, i) => i !== index));
  };

  const toggleAccountSelection = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      account_ids: prev.account_ids.includes(accountId)
        ? prev.account_ids.filter(id => id !== accountId)
        : [...prev.account_ids, accountId]
    }));
  };

  const selectAllAccounts = () => {
    setFormData(prev => ({
      ...prev,
      account_ids: accounts.map(a => a.id)
    }));
  };

  const deselectAllAccounts = () => {
    setFormData(prev => ({
      ...prev,
      account_ids: []
    }));
  };

  async function loadAccounts() {
    try {
      const { data, error } = await supabase
        .from('main_accounts')
        .select('id, handle, is_active')
        .eq('is_active', true)
        .order('handle');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error('Error loading accounts:', error);
      toast.error('アカウントの読み込みに失敗しました');
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

      if (formData.account_ids.length === 0) {
        throw new Error('アカウントを選択してください');
      }

      const mediaUrls = uploadedMedia.map(m => m.url);

      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      if (post) {
        // 編集モード（単一アカウント）
        // Convert local datetime to UTC for database storage
        let scheduledAtUTC = null;
        if (formData.scheduled_at) {
          const localDate = new Date(formData.scheduled_at);
          scheduledAtUTC = localDate.toISOString();
        }

        const payload = {
          content: formData.content,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          account_id: formData.account_ids[0],
          scheduled_at: scheduledAtUTC,
          status: scheduledAtUTC ? 'scheduled' : formData.status,
          tags: tags.length > 0 ? tags : null,
          user_id: user.id,
        };

        const { error: updateError } = await supabase
          .from('posts')
          .update(payload)
          .eq('id', post.id);

        if (updateError) throw updateError;
        toast.success('投稿を更新しました');
      } else {
        // 新規作成（複数アカウント対応）
        const posts = formData.account_ids.map((accountId, index) => {
          let scheduledAt = null;

          // Convert local datetime to UTC
          if (formData.scheduled_at) {
            const localDate = new Date(formData.scheduled_at);

            // 複数アカウントかつ予約投稿の場合、1時間ずつずらす
            if (formData.use_interval && formData.account_ids.length > 1) {
              localDate.setHours(localDate.getHours() + (index * formData.interval_hours));
            }

            scheduledAt = localDate.toISOString();
          }

          return {
            content: formData.content,
            media_urls: mediaUrls.length > 0 ? mediaUrls : null,
            account_id: accountId,
            scheduled_at: scheduledAt,
            status: scheduledAt ? 'scheduled' : 'draft',
            tags: tags.length > 0 ? tags : null,
            user_id: user.id,
          };
        });

        const { error: insertError } = await supabase
          .from('posts')
          .insert(posts);

        if (insertError) throw insertError;
        toast.success(`${posts.length}件の投稿を作成しました`);
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
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">
            {post ? '投稿編集' : '新規投稿'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                投稿アカウント * ({formData.account_ids.length}件選択中)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllAccounts}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={deselectAllAccounts}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  全解除
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-600 rounded-lg p-2 space-y-1 bg-gray-900">
              {accounts.map(account => (
                <label
                  key={account.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-700 ${
                    formData.account_ids.includes(account.id) ? 'bg-blue-900/50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.account_ids.includes(account.id)}
                    onChange={() => toggleAccountSelection(account.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-200">@{account.handle}</span>
                </label>
              ))}
              {accounts.length === 0 && (
                <p className="text-sm text-gray-500 p-2">アクティブなアカウントがありません</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                投稿内容 *
              </label>
              <span className={`text-sm ${isOverLimit ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
                {charCount} / {maxChars}
              </span>
            </div>
            <textarea
              rows={6}
              required
              value={formData.content}
              onChange={handleContentChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-white placeholder-gray-500 ${
                isOverLimit ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="ツイート内容を入力..."
            />
            {isOverLimit && (
              <p className="mt-1 text-sm text-red-400">
                文字数制限を超えています
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <ImageIcon size={16} className="inline mr-1" />
              メディア（最大4枚）
            </label>
            <div className="space-y-3">
              {/* アップロード済み画像一覧 */}
              {uploadedMedia.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {uploadedMedia.map((media, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={media.url}
                        alt={media.name}
                        className="w-full h-24 object-cover rounded-lg border border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                      <p className="text-xs text-gray-400 truncate mt-1">{media.name}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ファイルアップロード */}
              {uploadedMedia.length < 4 && (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="media-upload"
                  />
                  <label
                    htmlFor="media-upload"
                    className={`flex items-center gap-2 px-4 py-2 border border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700 text-gray-300 transition ${
                      uploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload size={16} />
                    {uploading ? 'アップロード中...' : '画像を追加'}
                  </label>
                  <span className="text-xs text-gray-500">
                    {4 - uploadedMedia.length}枚追加可能 (最大5MB/枚)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar size={16} className="inline mr-1" />
              予約投稿日時
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-white"
            />
            <p className="mt-1 text-sm text-gray-500">
              空白の場合は下書きとして保存されます
            </p>

            {/* 複数アカウント選択時の時間間隔オプション */}
            {formData.account_ids.length > 1 && formData.scheduled_at && (
              <div className="mt-3 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.use_interval}
                    onChange={(e) => setFormData({ ...formData, use_interval: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-blue-300">
                    アカウントごとに時間をずらす
                  </span>
                </label>
                {formData.use_interval && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.interval_hours}
                      onChange={(e) => setFormData({ ...formData, interval_hours: parseInt(e.target.value) || 1 })}
                      className="w-16 px-2 py-1 border border-blue-600 rounded text-sm bg-gray-800 text-white"
                    />
                    <span className="text-sm text-blue-300">時間おきに投稿</span>
                  </div>
                )}
                {formData.use_interval && (
                  <p className="mt-2 text-xs text-blue-400">
                    1番目: {formData.scheduled_at.replace('T', ' ')}、
                    2番目: +{formData.interval_hours}時間、
                    3番目: +{formData.interval_hours * 2}時間...
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-white placeholder-gray-500"
              placeholder="マーケティング, プロモーション, お知らせ"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || isOverLimit || uploading || formData.account_ids.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '保存中...' : post ? '更新' : formData.scheduled_at
                ? `${formData.account_ids.length}件を予約`
                : `${formData.account_ids.length}件を下書き保存`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
