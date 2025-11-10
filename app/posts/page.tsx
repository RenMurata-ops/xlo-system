'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Calendar, FileText, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import PostCard from '@/components/posts/PostCard';
import PostForm from '@/components/posts/PostForm';

interface Post {
  id: string;
  content: string;
  media_urls: string[] | null;
  account_id: string;
  scheduled_at: string | null;
  posted_at: string | null;
  engagement_count: number | null;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('削除に失敗しました');
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
    } catch (error) {
      console.error('Error updating status:', error);
      alert('ステータス変更に失敗しました');
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">投稿管理</h1>
          <p className="text-gray-600 mt-2">
            Twitter投稿を作成・管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPosts}
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
            新規投稿
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">下書き</div>
          <div className="text-3xl font-bold text-gray-900">{draftCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">予約済み</div>
          <div className="text-3xl font-bold text-blue-600">{scheduledCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">投稿済み</div>
          <div className="text-3xl font-bold text-green-600">{postedCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">失敗</div>
          <div className="text-3xl font-bold text-red-600">{failedCount}</div>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Filter size={20} className="text-gray-600" />
        <div className="flex items-center gap-2 flex-wrap">
          {statuses.map(status => (
            <button
              key={status.value}
              onClick={() => setFilterStatus(status.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === status.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {filterStatus === 'all' ? '投稿がありません' : `${statuses.find(s => s.value === filterStatus)?.label}の投稿がありません`}
          </h3>
          <p className="text-gray-600 mb-6">
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
    </div>
  );
}
