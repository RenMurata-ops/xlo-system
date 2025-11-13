'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Repeat, PlayCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import LoopCard from '@/components/loops/LoopCard';
import LoopForm from '@/components/loops/LoopForm';
import LoopExecutionLogs from '@/components/loops/LoopExecutionLogs';

interface Loop {
  id: string;
  loop_name: string;
  description: string | null;
  is_active: boolean;
  execution_interval_hours: number;
  min_accounts: number;
  max_accounts: number;
  executor_account_ids: string[] | null;
  allowed_account_tags: string[] | null;
  reply_template_id: string | null;
  reply_delay_min_minutes: number | null;
  reply_delay_max_minutes: number | null;
  jitter_min_minutes: number | null;
  jitter_max_minutes: number | null;
  last_executed_at: string | null;
  next_run_at: string | null;
  post_count: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export default function LoopsPage() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLoop, setEditingLoop] = useState<Loop | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    loadLoops();
  }, []);

  async function loadLoops() {
    try {
      const { data, error } = await supabase
        .from('loops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoops(data || []);
    } catch (error) {
      console.error('Error loading loops:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このループを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('loops')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLoops(loops.filter(loop => loop.id !== id));
    } catch (error) {
      console.error('Error deleting loop:', error);
      alert('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('loops')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setLoops(loops.map(loop =>
        loop.id === id ? { ...loop, is_active: !currentStatus } : loop
      ));
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('ステータス変更に失敗しました');
    }
  }

  function handleEdit(loop: Loop) {
    setEditingLoop(loop);
    setShowForm(true);
  }

  async function handleExecuteNow() {
    try {
      setExecuting(true);
      setExecuteResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-loop`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('ループ実行に失敗しました');
      }

      const result = await response.json();
      setExecuteResult(result);

      if (result.ok && result.count > 0) {
        loadLoops(); // Reload loops to update stats
      }

      // Auto-clear result after 10 seconds
      setTimeout(() => setExecuteResult(null), 10000);
    } catch (error) {
      console.error('Execute loop error:', error);
      alert('ループ実行に失敗しました');
    } finally {
      setExecuting(false);
    }
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingLoop(null);
    loadLoops();
  }

  function handleShowLogs(loopId: string) {
    setSelectedLoopId(loopId);
    setShowLogs(true);
  }

  const activeLoops = loops.filter(l => l.is_active).length;
  const totalPosts = loops.reduce((sum, l) => sum + l.post_count, 0);
  const scheduledLoops = loops.filter(l => l.next_run_at && new Date(l.next_run_at) > new Date()).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {executeResult && (
        <div className={`mb-6 p-4 rounded-lg border ${
          executeResult.ok
            ? 'bg-green-900/20 border-green-700 text-green-400'
            : 'bg-red-900/20 border-red-700 text-red-400'
        }`}>
          <p className="font-semibold mb-2">ループ実行結果</p>
          <p className="text-sm">
            実行数: {executeResult.count || 0}
          </p>
          {executeResult.results && executeResult.results.length > 0 && (
            <div className="mt-2 text-xs">
              {executeResult.results.slice(0, 3).map((result: any, idx: number) => (
                <p key={idx} className="ml-2">
                  {result.ok ? '✓' : '✗'} ループID: {result.loop_id.slice(0, 8)}... ({result.posts_created}件投稿)
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-200">
          <strong>🔄 ループシステム：</strong> すべてのループ投稿は、指定されたアカウントに紐づけられたTwitter Appの認証情報を使用してX（Twitter）プラットフォーム上で自動実行されます。
        </p>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">ループ管理</h1>
          <p className="text-gray-400 mt-2">
            自動投稿ループシステムを管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExecuteNow}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {executing ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                実行中...
              </>
            ) : (
              <>
                <PlayCircle size={20} />
                今すぐ実行
              </>
            )}
          </button>
          <button
            onClick={loadLoops}
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
            新規ループ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総ループ数</div>
          <div className="text-3xl font-bold text-gray-900">{loops.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeLoops}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">予約済み</div>
          <div className="text-3xl font-bold text-blue-600">{scheduledLoops}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総投稿数</div>
          <div className="text-3xl font-bold text-purple-600">{totalPosts.toLocaleString()}</div>
        </div>
      </div>

      {loops.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Repeat size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            ループがありません
          </h3>
          <p className="text-gray-600 mb-6">
            自動投稿ループを作成してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            最初のループを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loops.map(loop => (
            <LoopCard
              key={loop.id}
              loop={loop}
              onEdit={() => handleEdit(loop)}
              onDelete={() => handleDelete(loop.id)}
              onToggleActive={() => handleToggleActive(loop.id, loop.is_active)}
              onShowLogs={() => handleShowLogs(loop.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <LoopForm
          loop={editingLoop}
          onClose={handleFormClose}
        />
      )}

      {showLogs && selectedLoopId && (
        <LoopExecutionLogs
          loopId={selectedLoopId}
          onClose={() => setShowLogs(false)}
        />
      )}
    </div>
  );
}
