'use client';

import { X, CheckCircle, XCircle, Clock } from 'lucide-react';

interface TestResult {
  success: boolean;
  response_time_ms: number | null;
  error_message: string | null;
  tested_at: string;
}

interface ProxyTestResultProps {
  proxyName: string;
  result: TestResult;
  onClose: () => void;
}

export default function ProxyTestResult({ proxyName, result, onClose }: ProxyTestResultProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">接続テスト結果</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            {result.success ? (
              <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            ) : (
              <XCircle size={64} className="mx-auto text-red-500 mb-4" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {proxyName}
            </h3>
            <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              {result.success ? '接続成功' : '接続失敗'}
            </p>
          </div>

          <div className="space-y-3">
            {result.response_time_ms !== null && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={16} />
                    <span className="text-sm">応答時間</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {result.response_time_ms}ms
                  </span>
                </div>
              </div>
            )}

            {result.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>エラー:</strong> {result.error_message}
                </p>
              </div>
            )}

            <div className="text-xs text-gray-500 text-center pt-4">
              テスト実行: {new Date(result.tested_at).toLocaleString('ja-JP')}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6">
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
