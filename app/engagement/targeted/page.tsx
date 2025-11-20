'use client';

import { useState, useEffect } from 'react';
import { Plus, Target, Play, Pause, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface TargetedEngagement {
  id: string;
  target_url: string;
  target_tweet_id: string | null;
  enable_like: boolean;
  enable_retweet: boolean;
  enable_reply: boolean;
  enable_quote: boolean;
  enable_follow: boolean;
  account_type: 'follow' | 'spam';
  max_actions_per_hour: number;
  max_total_actions: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  actions_completed: number;
  created_at: string;
}

interface Account {
  id: string;
  account_handle: string;
  account_name: string | null;
}

export default function TargetedEngagementPage() {
  const [engagements, setEngagements] = useState<TargetedEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [followAccounts, setFollowAccounts] = useState<Account[]>([]);
  const [spamAccounts, setSpamAccounts] = useState<Account[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    target_url: '',
    enable_like: true,
    enable_retweet: false,
    enable_reply: false,
    enable_quote: false,
    enable_follow: false,
    account_type: 'follow' as 'follow' | 'spam',
    use_all_accounts: true,
    selected_account_ids: [] as string[],
    max_actions_per_hour: 10,
    max_total_actions: 100,
  });

  const supabase = createClient();

  useEffect(() => {
    loadEngagements();
    loadAccounts();
  }, []);

  async function loadEngagements() {
    try {
      const { data, error } = await supabase
        .from('targeted_engagements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEngagements(data || []);
    } catch (error) {
      console.error('Error loading engagements:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccounts() {
    try {
      const [followRes, spamRes] = await Promise.all([
        supabase.from('follow_accounts').select('id, account_handle, account_name').eq('is_active', true),
        supabase.from('spam_accounts').select('id, account_handle, account_name').eq('is_active', true),
      ]);

      if (followRes.data) setFollowAccounts(followRes.data);
      if (spamRes.data) setSpamAccounts(spamRes.data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  function extractTweetId(url: string): string | null {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const tweetId = extractTweetId(formData.target_url);
    if (!tweetId) {
      toast.error('有効なX投稿URLを入力してください');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const { error } = await supabase.from('targeted_engagements').insert({
        user_id: user.id,
        target_url: formData.target_url,
        target_tweet_id: tweetId,
        enable_like: formData.enable_like,
        enable_retweet: formData.enable_retweet,
        enable_reply: formData.enable_reply,
        enable_quote: formData.enable_quote,
        enable_follow: formData.enable_follow,
        account_type: formData.account_type,
        use_all_accounts: formData.use_all_accounts,
        selected_account_ids: formData.use_all_accounts ? null : formData.selected_account_ids,
        max_actions_per_hour: formData.max_actions_per_hour,
        max_total_actions: formData.max_total_actions,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('ターゲットエンゲージメントを作成しました');
      setShowForm(false);
      setFormData({
        target_url: '',
        enable_like: true,
        enable_retweet: false,
        enable_reply: false,
        enable_quote: false,
        enable_follow: false,
        account_type: 'follow',
        use_all_accounts: true,
        selected_account_ids: [],
        max_actions_per_hour: 10,
        max_total_actions: 100,
      });
      loadEngagements();
    } catch (error: any) {
      toast.error(error.message || '作成に失敗しました');
    }
  }

  async function handleStatusChange(id: string, newStatus: 'running' | 'paused') {
    try {
      const { error } = await supabase
        .from('targeted_engagements')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setEngagements(engagements.map(e =>
        e.id === id ? { ...e, status: newStatus } : e
      ));
      toast.success(newStatus === 'running' ? '実行を開始しました' : '一時停止しました');
    } catch (error) {
      toast.error('ステータス変更に失敗しました');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このエンゲージメントを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('targeted_engagements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEngagements(engagements.filter(e => e.id !== id));
      toast.success('削除しました');
    } catch (error) {
      toast.error('削除に失敗しました');
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      running: 'bg-green-100 text-green-800',
      paused: 'bg-gray-100 text-gray-800',
      completed: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: '待機中',
      running: '実行中',
      paused: '一時停止',
      completed: '完了',
      failed: '失敗',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ターゲットエンゲージメント</h1>
          <p className="text-gray-600 mt-2">
            特定のX投稿に対してエンゲージメントを実行します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadEngagements}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={20} />
            更新
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            新規作成
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総キャンペーン数</div>
          <div className="text-3xl font-bold text-gray-900">{engagements.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">実行中</div>
          <div className="text-3xl font-bold text-green-600">
            {engagements.filter(e => e.status === 'running').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">完了</div>
          <div className="text-3xl font-bold text-blue-600">
            {engagements.filter(e => e.status === 'completed').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総アクション数</div>
          <div className="text-3xl font-bold text-purple-600">
            {engagements.reduce((sum, e) => sum + e.actions_completed, 0)}
          </div>
        </div>
      </div>

      {/* Engagements List */}
      {engagements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Target size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            ターゲットエンゲージメントがありません
          </h3>
          <p className="text-gray-600 mb-6">
            特定のX投稿に対してエンゲージメントを実行できます
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            最初のキャンペーンを作成
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {engagements.map(engagement => (
            <div key={engagement.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(engagement.status)}
                    <span className="text-sm text-gray-500">
                      {engagement.account_type === 'follow' ? 'フォローアカウント' : 'スパムアカウント'}
                    </span>
                  </div>
                  <a
                    href={engagement.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                  >
                    {engagement.target_url.substring(0, 60)}...
                    <ExternalLink size={14} />
                  </a>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    {engagement.enable_like && <span>いいね</span>}
                    {engagement.enable_retweet && <span>RT</span>}
                    {engagement.enable_reply && <span>リプライ</span>}
                    {engagement.enable_quote && <span>引用</span>}
                    {engagement.enable_follow && <span>フォロー</span>}
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    進捗: {engagement.actions_completed} / {engagement.max_total_actions}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {engagement.status === 'running' ? (
                    <button
                      onClick={() => handleStatusChange(engagement.id, 'paused')}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                    >
                      <Pause size={20} />
                    </button>
                  ) : engagement.status === 'pending' || engagement.status === 'paused' ? (
                    <button
                      onClick={() => handleStatusChange(engagement.id, 'running')}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Play size={20} />
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleDelete(engagement.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">新規ターゲットエンゲージメント</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Target URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ターゲットURL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.target_url}
                  onChange={(e) => setFormData({ ...formData, target_url: e.target.value })}
                  placeholder="https://twitter.com/user/status/1234567890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  使用アカウント
                </label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({
                    ...formData,
                    account_type: e.target.value as 'follow' | 'spam',
                    enable_like: e.target.value === 'spam',
                    enable_retweet: e.target.value === 'spam',
                    enable_reply: e.target.value === 'spam',
                    enable_quote: e.target.value === 'spam',
                    enable_follow: true,
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="follow">フォローアカウント（フォローのみ）</option>
                  <option value="spam">スパムアカウント（全アクション可能）</option>
                </select>
              </div>

              {/* Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  実行するアクション
                </label>
                <div className="space-y-2">
                  {formData.account_type === 'spam' && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.enable_like}
                          onChange={(e) => setFormData({ ...formData, enable_like: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">いいね</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.enable_retweet}
                          onChange={(e) => setFormData({ ...formData, enable_retweet: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">リツイート</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.enable_reply}
                          onChange={(e) => setFormData({ ...formData, enable_reply: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">リプライ</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.enable_quote}
                          onChange={(e) => setFormData({ ...formData, enable_quote: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">引用ツイート</span>
                      </label>
                    </>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enable_follow}
                      onChange={(e) => setFormData({ ...formData, enable_follow: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">投稿者をフォロー</span>
                  </label>
                </div>
              </div>

              {/* Rate Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    1時間あたり最大アクション数
                  </label>
                  <input
                    type="number"
                    value={formData.max_actions_per_hour}
                    onChange={(e) => setFormData({ ...formData, max_actions_per_hour: parseInt(e.target.value) })}
                    min={1}
                    max={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    総アクション数上限
                  </label>
                  <input
                    type="number"
                    value={formData.max_total_actions}
                    onChange={(e) => setFormData({ ...formData, max_total_actions: parseInt(e.target.value) })}
                    min={1}
                    max={10000}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
