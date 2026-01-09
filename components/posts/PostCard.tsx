'use client';

import { Edit2, Trash2, Calendar, Heart, Image as ImageIcon, Clock, Eye, RefreshCw, Repeat2, MessageCircle, Quote, BarChart3, Send } from 'lucide-react';

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
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  impression_count?: number;
  engagement_updated_at?: string;
  error_message?: string | null;
}

interface PostCardProps {
  post: Post;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onPreview: () => void;
  onPostNow?: () => void;
  postingNow?: boolean;
  onRefreshEngagement?: () => void;
  refreshingEngagement?: boolean;
  accountLabel?: string;
}

export default function PostCard({
  post,
  onEdit,
  onDelete,
  onStatusChange,
  onPreview,
  onPostNow,
  postingNow = false,
  onRefreshEngagement,
  refreshingEngagement = false,
  accountLabel,
}: PostCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'posted': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return '下書き';
      case 'scheduled': return '予約済み';
      case 'posted': return '投稿済み';
      case 'failed': return '失敗';
      case 'processing': return '投稿中';
      default: return status;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow border border-gray-700 hover:shadow-lg transition-shadow">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-start justify-between mb-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(post.status)}`}>
            {getStatusLabel(post.status)}
          </span>
          {accountLabel && (
            <span className="text-xs text-gray-300">@{accountLabel}</span>
          )}
          {post.tags && post.tags.length > 0 && (
            <span className="px-2 py-1 rounded text-xs bg-purple-900/50 text-purple-300">
              {post.tags[0]}
            </span>
          )}
        </div>

        <p className="text-gray-100 text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {post.content}
        </p>

        {post.media_urls && post.media_urls.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
            <ImageIcon size={16} />
            <span>{post.media_urls.length}枚の画像</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-3 bg-gray-900/50">
        {post.status === 'failed' && post.error_message && (
          <div className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded p-3">
            エラー: {post.error_message}
          </div>
        )}

        {post.scheduled_at && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Calendar size={16} />
            <span>予約: {new Date(post.scheduled_at).toLocaleString('ja-JP')}</span>
          </div>
        )}

        {post.posted_at && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock size={16} />
            <span>投稿: {new Date(post.posted_at).toLocaleString('ja-JP')}</span>
          </div>
        )}

        {post.status === 'posted' && post.twitter_id && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">エンゲージメント</span>
              {onRefreshEngagement && (
                <button
                  onClick={onRefreshEngagement}
                  disabled={refreshingEngagement}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={refreshingEngagement ? 'animate-spin' : ''} />
                  更新
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div className="flex flex-col items-center p-2 bg-gray-800 rounded">
                <Heart size={14} className="text-pink-500 mb-1" />
                <span className="font-semibold text-white">{(post.like_count || 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-gray-800 rounded">
                <Repeat2 size={14} className="text-green-500 mb-1" />
                <span className="font-semibold text-white">{(post.retweet_count || 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-gray-800 rounded">
                <MessageCircle size={14} className="text-blue-500 mb-1" />
                <span className="font-semibold text-white">{(post.reply_count || 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-gray-800 rounded">
                <Quote size={14} className="text-purple-500 mb-1" />
                <span className="font-semibold text-white">{(post.quote_count || 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-gray-800 rounded">
                <BarChart3 size={14} className="text-gray-400 mb-1" />
                <span className="font-semibold text-white">{(post.impression_count || 0).toLocaleString()}</span>
              </div>
            </div>
            {post.engagement_updated_at && (
              <div className="text-xs text-gray-500 text-center">
                最終更新: {new Date(post.engagement_updated_at).toLocaleString('ja-JP')}
              </div>
            )}
          </div>
        )}

        {post.engagement_count !== null && post.engagement_count > 0 && !post.twitter_id && (
          <div className="flex items-center gap-2 text-sm text-pink-400">
            <Heart size={16} />
            <span>{(post.engagement_count || 0).toLocaleString()} エンゲージメント</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {(post.status === 'draft' || post.status === 'scheduled') && onPostNow && (
            <button
              onClick={onPostNow}
              disabled={postingNow}
              className="px-3 py-2 text-sm rounded bg-green-900/50 text-green-300 hover:bg-green-800/50 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} className={postingNow ? 'animate-pulse' : ''} />
              {postingNow ? '投稿中...' : '今すぐ投稿'}
            </button>
          )}
          {post.status === 'draft' && (
            <button
              onClick={() => onStatusChange('scheduled')}
              disabled={postingNow}
              className="px-3 py-2 text-sm rounded bg-blue-900/50 text-blue-300 hover:bg-blue-800/50 transition disabled:opacity-50"
            >
              予約
            </button>
          )}
          {post.status === 'scheduled' && (
            <button
              onClick={() => onStatusChange('draft')}
              disabled={postingNow}
              className="px-3 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition disabled:opacity-50"
            >
              下書きに戻す
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="p-2 text-purple-400 hover:bg-purple-900/50 rounded transition"
            title="プレビュー"
          >
            <Eye size={16} />
          </button>

          <button
            onClick={onEdit}
            className="p-2 text-blue-400 hover:bg-blue-900/50 rounded transition"
            title="編集"
          >
            <Edit2 size={16} />
          </button>

          <button
            onClick={onDelete}
            className="p-2 text-red-400 hover:bg-red-900/50 rounded transition"
            title="削除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700 text-xs text-gray-500">
        作成日: {new Date(post.created_at).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
