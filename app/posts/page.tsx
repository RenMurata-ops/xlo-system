'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Calendar, FileText, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import PostCard from '@/components/posts/PostCard';
import PostForm from '@/components/posts/PostForm';
import PostPreview from '@/components/posts/PostPreview';

interface Post {
  id: string;
  content: string;
  media_urls: string[] | null;
  account_id: string;
  scheduled_at: string | null;
  posted_at: string | null;
  engagement_count: number | null;
  status: 'draft' | 'scheduled' | 'posted' | 'failed' | 'processing';
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  twitter_id?: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [bulkExecuting, setBulkExecuting] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [dryRun, setDryRun] = useState(false);
  const [postingNow, setPostingNow] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('この投稿を削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPosts(posts.filter(post => post.id !== id));
      toast.success('投稿を削除しました');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('削除に失敗しました');
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setPosts(posts.map(post =>
        post.id === id ? { ...post, status: newStatus as any } : post
      ));
      toast.success('ステータスを変更しました');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('ステータス変更に失敗しました');
    }
  }

  function handleEdit(post: Post) {
    setEditingPost(post);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingPost(null);
    loadPosts();
  }

  function handlePreview(post: Post) {
    setPreviewPost(post);
    setShowPreview(true);
  }

  async function handlePostNow(postId: string) {
    if (!confirm('この投稿を今すぐ投稿しますか？')) return;

    try {
      setPostingNow(prev => ({ ...prev, [postId]: true }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('ログインが必要です');
        return;
      }

      const loadingToast = toast.loading('投稿中...', {
        description: 'しばらくお待ちください',
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-single-post`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: postId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '投稿に失敗しました');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('投稿が完了しました', {
          id: loadingToast,
          description: `Tweet ID: ${result.tweet_id}`,
        });
        loadPosts(); // Reload posts to show updated status
      } else {
        throw new Error(result.error || '投稿に失敗しました');
      }
    } catch (error: any) {
      console.error('Post now error:', error);
      toast.error('投稿に失敗しました', {
        description: error.message,
      });
    } finally {
      setPostingNow(prev => ({ ...prev, [postId]: false }));
    }
  }

  async function handleBulkExecute(batchSize: number = 10) {
    try {
      setBulkExecuting(true);
      setBulkResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('ログインが必要です');
        setBulkExecuting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('ユーザー情報の取得に失敗しました');
        setBulkExecuting(false);
        return;
      }

      const loadingToast = toast.loading(dryRun ? 'プレビュー中...' : '一括投稿実行中...', {
        description: 'しばらくお待ちください',
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-bulk-posts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            batch_size: batchSize,
            dryRun,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('一括投稿の実行に失敗しました');
      }

      const result = await response.json();
      setBulkResult(result);

      if (!dryRun && result.succeeded > 0) {
        toast.success('一括投稿実行完了', {
          id: loadingToast,
          description: `${result.succeeded}件成功 / ${result.failed}件失敗`,
        });
        loadPosts(); // Reload posts after successful execution
      } else if (dryRun) {
        toast.info('プレビュー完了', {
          id: loadingToast,
          description: `処理予定: ${result.processed}件`,
        });
      } else {
        toast.info('投稿する内容がありません', {
          id: loadingToast,
        });
      }

      // Auto-clear result after 10 seconds
      setTimeout(() => setBulkResult(null), 10000);
    } catch (error: any) {
      console.error('Bulk execution error:', error);
      toast.error('一括投稿の実行に失敗しました', {
        description: error.message,
      });
    } finally {
      setBulkExecuting(false);
    }
  }

  const statuses = [
    { value: 'all', label: 'すべて' },
    { value: 'draft', label: '下書き' },
    { value: 'scheduled', label: '予約済み' },
    { value: 'posted', label: '投稿済み' },
    { value: 'failed', label: '失敗' },
  ];

  const filteredPosts = filterStatus === 'all'
    ? posts
    : posts.filter(post => post.status === filterStatus);

  const draftCount = posts.filter(p => p.status === 'draft').length;
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;
  const postedCount = posts.filter(p => p.status === 'posted').length;
  const failedCount = posts.filter(p => p.status === 'failed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {bulkResult && (
        <div className={`mb-6 p-4 rounded-lg border ${
          bulkResult.success
            ? 'bg-green-900/20 border-green-700 text-green-400'
            : 'bg-red-900/20 border-red-700 text-red-400'
        }`}>
          <p className="font-semibold mb-2">
            {bulkResult.dryRun ? 'プレビュー結果' : '一括投稿実行結果'}
          </p>
          <p className="text-sm">
            処理数: {bulkResult.processed} | 成功: {bulkResult.succeeded} | 失敗: {bulkResult.failed}
          </p>
          {bulkResult.samples && bulkResult.samples.length > 0 && (
            <div className="mt-2 text-xs">
              <p className="font-semibold">サンプル:</p>
              {bulkResult.samples.slice(0, 3).map((sample: any, idx: number) => (
                <p key={idx} className="ml-2 truncate">
                  {sample.status === 'success' ? '✓' : '✗'} {sample.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">投稿管理</h1>
          <p className="text-gray-400 mt-2">
            Twitter投稿を作成・管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="dryRun" className="text-sm text-gray-300">
              プレビューのみ
            </label>
          </div>
          <button
            onClick={() => handleBulkExecute(10)}
            disabled={bulkExecuting}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {bulkExecuting ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                実行中...
              </>
            ) : (
              <>
                <FileText size={20} />
                一括投稿実行
              </>
            )}
          </button>
          <button
            onClick={loadPosts}
            className="flex items-center gap-2 px-4 py-2 text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition"
          >
            <RefreshCw size={20} />
            更新
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            新規投稿
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">下書き</div>
          <div className="text-3xl font-bold text-white">{draftCount}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">予約済み</div>
          <div className="text-3xl font-bold text-blue-400">{scheduledCount}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">投稿済み</div>
          <div className="text-3xl font-bold text-green-400">{postedCount}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">失敗</div>
          <div className="text-3xl font-bold text-red-400">{failedCount}</div>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Filter size={20} className="text-gray-400" />
        <div className="flex items-center gap-2 flex-wrap">
          {statuses.map(status => (
            <button
              key={status.value}
              onClick={() => setFilterStatus(status.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === status.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="bg-gray-800 rounded-lg shadow border border-gray-700 p-12 text-center">
          <FileText size={64} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {filterStatus === 'all' ? '投稿がありません' : `${statuses.find(s => s.value === filterStatus)?.label}の投稿がありません`}
          </h3>
          <p className="text-gray-400 mb-6">
            新しい投稿を作成してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            最初の投稿を作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onEdit={() => handleEdit(post)}
              onDelete={() => handleDelete(post.id)}
              onStatusChange={(status) => handleStatusChange(post.id, status)}
              onPreview={() => handlePreview(post)}
              onPostNow={() => handlePostNow(post.id)}
              postingNow={postingNow[post.id] || false}
            />
          ))}
        </div>
      )}

      {showForm && (
        <PostForm
          post={editingPost}
          onClose={handleFormClose}
        />
      )}

      {showPreview && previewPost && (
        <PostPreview
          post={previewPost}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
