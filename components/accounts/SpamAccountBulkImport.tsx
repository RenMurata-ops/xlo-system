'use client';

import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SpamAccountBulkImportProps {
  onClose: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function SpamAccountBulkImport({ onClose }: SpamAccountBulkImportProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [textInput, setTextInput] = useState('');
  const supabase = createClient();

  const handleImport = async () => {
    setImporting(true);
    setResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const lines = textInput
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length === 0) {
        throw new Error('アカウント情報を入力してください');
      }

      const accounts = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          handle: parts[0].replace('@', ''),
          name: parts[1] || null,
          proxy_id: null,
          ban_status: 'unknown' as const,
          tags: parts[2] ? parts[2].split('|').map(t => t.trim()) : null,
          notes: parts[3] || null,
          is_active: true,
          user_id: user.id,
          total_engagements: 0,
          success_rate: null,
        };
      });

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const account of accounts) {
        try {
          const { error } = await supabase
            .from('spam_accounts')
            .insert([account]);

          if (error) throw error;
          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push(`@${account.handle}: ${err.message}`);
        }
      }

      setResult({
        success: successCount,
        failed: failedCount,
        errors,
      });
    } catch (err: any) {
      setResult({
        success: 0,
        failed: 0,
        errors: [err.message],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (result && result.success > 0) {
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Upload size={24} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">一括インポート</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <CheckCircle size={20} />
                    <span className="font-semibold">成功</span>
                  </div>
                  <div className="text-3xl font-bold text-green-600">
                    {result.success}件
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 mb-2">
                    <AlertCircle size={20} />
                    <span className="font-semibold">失敗</span>
                  </div>
                  <div className="text-3xl font-bold text-red-600">
                    {result.failed}件
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">エラー詳細</h4>
                  <div className="space-y-1 text-sm text-red-700 max-h-60 overflow-y-auto">
                    {result.errors.map((error, idx) => (
                      <div key={idx}>• {error}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => setResult(null)}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  再度インポート
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  完了
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">フォーマット</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>1行に1アカウント、カンマ区切りで入力してください：</p>
                  <code className="block bg-white px-3 py-2 rounded mt-2 font-mono text-xs">
                    アカウントハンドル, アカウント名, タグ(|区切り), メモ
                  </code>
                  <p className="mt-2">例：</p>
                  <code className="block bg-white px-3 py-2 rounded mt-1 font-mono text-xs">
                    spam_account1, スパム1, グループA|テスト, テスト用アカウント<br />
                    spam_account2, スパム2, グループB, 高頻度エンゲージメント用<br />
                    spam_account3, , グループA, アカウント名なし
                  </code>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  アカウント情報
                </label>
                <textarea
                  rows={12}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="spam_account1, スパム1, グループA|テスト, テスト用&#10;spam_account2, スパム2, グループB, 高頻度用&#10;spam_account3, , グループA,"
                />
                <p className="mt-2 text-sm text-gray-500">
                  {textInput.split('\n').filter(line => line.trim().length > 0).length}件のアカウント
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  disabled={importing}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || textInput.trim().length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {importing ? 'インポート中...' : 'インポート開始'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
