'use client';

import { X, Calendar, Image as ImageIcon, Hash, User, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

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
}

interface PostPreviewProps {
  post: Post;
  onClose: () => void;
}

export default function PostPreview({ post, onClose }: PostPreviewProps) {
  const [accountHandle, setAccountHandle] = useState<string>('');
  const supabase = createClient();

  useEffect(() => {
    loadAccountInfo();
  }, [post.account_id]);

  async function loadAccountInfo() {
    try {
      const { data, error } = await supabase
        .from('main_accounts')
        .select('handle')
        .eq('id', post.account_id)
        .single();

      if (error) throw error;
      setAccountHandle(data?.handle || 'Unknown');
    } catch (error) {
      console.error('Error loading account:', error);
      setAccountHandle('Unknown');
    }
  }

  const charCount = post.content.length;
  const maxChars = 280;
  const isOverLimit = charCount > maxChars;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ImageIcon size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">投稿プレビュー</h2>
              <p className="text-sm text-gray-600">投稿内容を確認できます</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(post.status)}`}>
              {getStatusLabel(post.status)}
            </span>
            <span className={`text-sm font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-600'}`}>
              {charCount} / {maxChars} 文字
              {isOverLimit && <span className="ml-2 text-red-600">(制限超過)</span>}
            </span>
          </div>

          {/* Twitter-like Preview Card */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Account Header */}
            <div className="p-4 flex items-center gap-3 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                {accountHandle.charAt(1).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-gray-900">@{accountHandle}</div>
                <div className="text-sm text-gray-500">
                  {post.scheduled_at
                    ? `予約: ${new Date(post.scheduled_at).toLocaleString('ja-JP')}`
                    : '下書き'
                  }
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div className="p-4">
              <p className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap break-words">
                {post.content}
              </p>
            </div>

            {/* Media Preview */}
            {post.media_urls && post.media_urls.length > 0 && (
              <div className="px-4 pb-4">
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {post.media_urls.length === 1 && (
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <ImageIcon size={48} className="text-gray-400" />
                    </div>
                  )}
                  {post.media_urls.length > 1 && (
                    <div className="grid grid-cols-2 gap-1 bg-gray-100 p-2">
                      {post.media_urls.slice(0, 4).map((url, idx) => (
                        <div key={idx} className="aspect-square bg-gray-200 flex items-center justify-center rounded">
                          <ImageIcon size={32} className="text-gray-400" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-3 bg-gray-50 border-t border-gray-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">メディアURL:</div>
                    {post.media_urls.map((url, idx) => (
                      <div key={idx} className="text-xs text-gray-600 font-mono truncate mb-1">
                        {idx + 1}. {url}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Engagement Stats (if posted) */}
            {post.status === 'posted' && post.engagement_count !== null && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-gray-900">{(post.engagement_count || 0).toLocaleString()}</span>
                    <span>エンゲージメント</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User size={16} />
                <span>投稿アカウント</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">@{accountHandle}</div>
            </div>

            {/* Scheduled Time */}
            {post.scheduled_at && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-2">
                  <Calendar size={16} />
                  <span>予約投稿日時</span>
                </div>
                <div className="text-lg font-semibold text-blue-900">
                  {new Date(post.scheduled_at).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            )}

            {/* Posted Time */}
            {post.posted_at && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2">
                  <Clock size={16} />
                  <span>投稿日時</span>
                </div>
                <div className="text-lg font-semibold text-green-900">
                  {new Date(post.posted_at).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 mb-2">
                  <Hash size={16} />
                  <span>タグ</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-500 mb-1">作成日時</div>
              <div className="text-sm text-gray-900">
                {new Date(post.created_at).toLocaleString('ja-JP')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">更新日時</div>
              <div className="text-sm text-gray-900">
                {new Date(post.updated_at).toLocaleString('ja-JP')}
              </div>
            </div>
          </div>

          {/* Warning if over character limit */}
          {isOverLimit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-red-600 mt-0.5">⚠️</div>
                <div>
                  <div className="font-semibold text-red-900 mb-1">文字数制限超過</div>
                  <div className="text-sm text-red-700">
                    この投稿は280文字を超えています。Twitterに投稿する前に内容を短くしてください。
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
