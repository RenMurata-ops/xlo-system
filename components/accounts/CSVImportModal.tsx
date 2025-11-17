'use client';

import { useState } from 'react';
import { X, Upload, Download, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface CSVImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  accountType: 'main' | 'spam' | 'follow';
}

interface ParsedAccount {
  account_handle?: string;
  account_name?: string;
  username?: string;
  password?: string;
  email?: string;
  proxy_id?: string;
  tags?: string;
  follower_count?: number;
  following_count?: number;
}

export default function CSVImportModal({ onClose, onImportComplete, accountType }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedAccount[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const supabase = createClient();

  const getTableName = () => {
    switch (accountType) {
      case 'main': return 'main_accounts';
      case 'spam': return 'spam_accounts';
      case 'follow': return 'follow_accounts';
    }
  };

  const getTemplateCSV = () => {
    switch (accountType) {
      case 'main':
        return `account_handle,account_name,tags
@example1,Example User 1,"tag1,tag2"
@example2,Example User 2,"tag3"`;
      case 'spam':
        return `username,password,email,proxy_id,tags
spamuser1,password123,spam1@example.com,proxy-uuid-1,"tag1,tag2"
spamuser2,password456,spam2@example.com,proxy-uuid-2,"tag3"`;
      case 'follow':
        return `username,password,email,tags
followuser1,password789,follow1@example.com,"tag1"
followuser2,passwordabc,follow2@example.com,"tag2,tag3"`;
    }
  };

  const downloadTemplate = () => {
    const csv = getTemplateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${accountType}_accounts_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('テンプレートをダウンロードしました');
  };

  const parseCSV = async (file: File): Promise<ParsedAccount[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());

          if (lines.length < 2) {
            reject(new Error('CSVファイルが空です'));
            return;
          }

          const headers = lines[0].split(',').map(h => h.trim());
          const accounts: ParsedAccount[] = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const account: any = {};

            headers.forEach((header, index) => {
              const value = values[index];
              if (value) {
                if (header === 'tags') {
                  account[header] = value.split('|').map(t => t.trim());
                } else if (header === 'follower_count' || header === 'following_count') {
                  account[header] = parseInt(value) || 0;
                } else {
                  account[header] = value;
                }
              }
            });

            accounts.push(account);
          }

          resolve(accounts);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('CSVファイルを選択してください');
      return;
    }

    setFile(selectedFile);

    try {
      const accounts = await parseCSV(selectedFile);
      setPreview(accounts);
      setShowPreview(true);
      toast.success(`${accounts.length}件のアカウントを読み込みました`);
    } catch (error: any) {
      console.error('CSV parse error:', error);
      toast.error('CSVの解析に失敗しました', {
        description: error.message,
      });
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file || preview.length === 0) return;

    setImporting(true);
    const loadingToast = toast.loading('インポート中...', {
      description: `${preview.length}件のアカウントを処理しています`,
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const tableName = getTableName();
      const accountsWithUserId = preview.map(account => ({
        ...account,
        user_id: user.id,
      }));

      const { data, error } = await supabase
        .from(tableName)
        .insert(accountsWithUserId)
        .select();

      if (error) throw error;

      toast.success('インポート完了', {
        id: loadingToast,
        description: `${data?.length || 0}件のアカウントを登録しました`,
      });

      onImportComplete();
      onClose();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('インポートに失敗しました', {
        id: loadingToast,
        description: error.message,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            CSV一括インポート - {accountType === 'main' ? 'メインアカウント' : accountType === 'spam' ? 'スパムアカウント' : 'フォローアカウント'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Template Download */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">CSVフォーマット</h3>
                <p className="text-sm text-blue-800 mb-3">
                  テンプレートをダウンロードして、正しい形式でデータを入力してください
                </p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  <Download size={16} />
                  テンプレートをダウンロード
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSVファイルを選択
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
            </div>
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                選択されたファイル: {file.name}
              </p>
            )}
          </div>

          {/* Preview */}
          {showPreview && preview.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                プレビュー ({preview.length}件)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(preview[0]).map((key) => (
                          <th
                            key={key}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.slice(0, 5).map((account, index) => (
                        <tr key={index}>
                          {Object.values(account).map((value, i) => (
                            <td key={i} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              {Array.isArray(value) ? value.join(', ') : String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 5 && (
                  <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 text-center">
                    他 {preview.length - 5} 件...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            キャンセル
          </button>
          <button
            onClick={handleImport}
            disabled={!file || preview.length === 0 || importing}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={20} />
            {importing ? 'インポート中...' : `インポート (${preview.length}件)`}
          </button>
        </div>
      </div>
    </div>
  );
}
