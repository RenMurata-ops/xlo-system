'use client';

import { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface CSVImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  accountType: 'main' | 'spam' | 'follow';
}

interface ParsedAccount {
  screen: string;
  password: string;
  mail: string;
  mailpw: string;
  reg_number: string;
  auth: string;
  two_factor_url: string;
  backup_codes: string;
}

export default function CSVImportModal({ onClose, onImportComplete, accountType }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const supabase = createClient();

  const getTableName = () => {
    switch (accountType) {
      case 'main': return 'main_accounts';
      case 'spam': return 'spam_accounts';
      case 'follow': return 'follow_accounts';
    }
  };

  const getHandleField = () => {
    return accountType === 'follow' ? 'target_handle' : 'handle';
  };

  const getNameField = () => {
    return accountType === 'follow' ? 'target_name' : 'name';
  };

  const parseCsv = (text: string): ParsedAccount[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header - support both tab and comma
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim());

    // Find column indices
    const indices = {
      screen: headers.findIndex(h => h === 'screen'),
      password: headers.findIndex(h => h === 'password'),
      mail: headers.findIndex(h => h === 'mail'),
      mailpw: headers.findIndex(h => h === 'mailpw'),
      reg_number: headers.findIndex(h => h === 'reg_number'),
      auth: headers.findIndex(h => h === 'auth'),
      two_factor_url: headers.findIndex(h => h === '二段階認証コード取得URL'),
      backup_codes: headers.findIndex(h => h === 'バックアップコード'),
    };

    // Helper function for safe array access
    const safeGet = (arr: string[], index: number): string => {
      if (index < 0 || index >= arr.length) return '';
      return arr[index] || '';
    };

    // Parse data rows
    const accounts: ParsedAccount[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      if (values.length < 2) continue;

      accounts.push({
        screen: safeGet(values, indices.screen),
        password: safeGet(values, indices.password),
        mail: safeGet(values, indices.mail),
        mailpw: safeGet(values, indices.mailpw),
        reg_number: safeGet(values, indices.reg_number),
        auth: safeGet(values, indices.auth),
        two_factor_url: safeGet(values, indices.two_factor_url),
        backup_codes: safeGet(values, indices.backup_codes),
      });
    }

    return accounts.filter(a => a.screen);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    try {
      const text = await selectedFile.text();
      const parsed = parseCsv(text);
      setPreview(parsed);

      if (parsed.length === 0) {
        toast.error('有効なアカウントが見つかりません');
      } else {
        toast.success(`${parsed.length}件のアカウントを読み込みました`);
      }
    } catch (error) {
      console.error('CSV parse error:', error);
      toast.error('CSVの解析に失敗しました');
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setLoading(true);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const tableName = getTableName();
      const handleField = getHandleField();
      const nameField = getNameField();

      for (const account of preview) {
        try {
          const insertData: any = {
            user_id: user.id,
            [handleField]: account.screen,
            [nameField]: account.screen, // Use screen as default name
            email: account.mail || null,
            password: account.password || null,
            mail_password: account.mailpw || null,
            two_factor_url: account.two_factor_url || null,
            backup_codes: account.backup_codes || null,
            reg_number: account.reg_number || null,
            auth_token: account.auth || null,
            is_active: true,
          };

          const { error } = await supabase
            .from(tableName)
            .insert(insertData);

          if (error) {
            if (error.code === '23505') {
              errors.push(`${account.screen}: 既に存在します`);
            } else {
              errors.push(`${account.screen}: ${error.message}`);
            }
            failed++;
          } else {
            success++;
          }
        } catch (err: any) {
          errors.push(`${account.screen}: ${err.message}`);
          failed++;
        }
      }

      setResult({ success, failed, errors });

      if (success > 0) {
        toast.success(`${success}件のアカウントをインポートしました`);
        onImportComplete();
      }

      if (failed > 0 && success === 0) {
        toast.error('インポートに失敗しました');
      }
    } catch (error: any) {
      toast.error(error.message || 'インポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            CSVインポート - {accountType === 'main' ? 'メイン' : accountType === 'spam' ? 'スパム' : 'フォロー'}アカウント
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Format Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">CSVフォーマット</h3>
                <p className="text-sm text-blue-800">
                  タブ区切りまたはカンマ区切りに対応
                </p>
                <p className="text-xs text-blue-700 mt-1 font-mono">
                  screen, password, mail, mailpw, 二段階認証コード取得URL, バックアップコード
                </p>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <span className="block text-sm font-medium text-gray-700 mb-2">
              CSVファイル
            </span>
            <label
              htmlFor="csv-file-input"
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition block"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600">
                {file ? file.name : 'クリックしてファイルを選択'}
              </p>
            </label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                プレビュー ({preview.length}件)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">screen</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">mail</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">password</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">2FA URL</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">backup codes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {preview.slice(0, 10).map((account, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{account.screen}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 truncate max-w-[150px]">{account.mail}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{'•'.repeat(Math.min(8, account.password.length))}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 truncate max-w-[150px]">{account.two_factor_url || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 truncate max-w-[100px]">{account.backup_codes ? '設定済' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 10 && (
                  <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500">
                    他 {preview.length - 10} 件...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                {result.success > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle size={20} />
                    <span>成功: {result.success}件</span>
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle size={20} />
                    <span>失敗: {result.failed}件</span>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <h4 className="text-sm font-medium text-red-800 mb-2">エラー詳細:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            閉じる
          </button>
          <button
            onClick={handleImport}
            disabled={loading || preview.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                インポート中...
              </>
            ) : (
              <>
                <FileText size={20} />
                {preview.length}件をインポート
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
