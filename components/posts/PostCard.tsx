'use client';

import { Edit2, Trash2, Calendar, Heart, Image as ImageIcon, Clock, Eye } from 'lucide-react';

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

interface PostCardProps {
  post: Post;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onPreview: () => void;
}

export default function PostCard({
  post,
  onEdit,
  onDelete,
  onStatusChange,
  onPreview
}: PostCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'posted': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return '下書き';
      case 'scheduled': return '予約済み';
      case 'posted': return '投稿済み';
      case 'failed': return '失敗';
      default: return status;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(post.status)}`}>
            {getStatusLabel(post.status)}
          </span>
          {post.tags && post.tags.length > 0 && (
            <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
              {post.tags[0]}
            </span>
          )}
        </div>

        <p className="text-gray-900 text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {post.content}
        </p>

        {post.media_urls && post.media_urls.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <ImageIcon size={16} />
            <span>{post.media_urls.length}枚の画像</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-3 bg-gray-50">
        {post.scheduled_at && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={16} />
            <span>予約: {new Date(post.scheduled_at).toLocaleString('ja-JP')}</span>
          </div>
        )}

        {post.posted_at && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={16} />
            <span>投稿: {new Date(post.posted_at).toLocaleString('ja-JP')}</span>
          </div>
        )}

        {post.engagement_count !== null && post.engagement_count > 0 && (
          <div className="flex items-center gap-2 text-sm text-pink-600">
            <Heart size={16} />
            <span>{post.engagement_count.toLocaleString()} エンゲージメント</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {post.status === 'draft' && (
            <button
              onClick={() => onStatusChange('scheduled')}
              className="px-3 py-2 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
            >
              予約
            </button>
          )}
          {post.status === 'scheduled' && (
            <button
              onClick={() => onStatusChange('draft')}
              className="px-3 py-2 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
            >
              下書きに戻す
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded transition"
            title="プレビュー"
          >
            <Eye size={16} />
          </button>

          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
            title="編集"
          >
            <Edit2 size={16} />
          </button>

          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
            title="削除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        作成日: {new Date(post.created_at).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
