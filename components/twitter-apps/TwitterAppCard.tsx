'use client';

import { useState } from 'react';
import { Edit2, Trash2, Eye, EyeOff, CheckCircle, XCircle, Zap } from 'lucide-react';

interface TwitterApp {
  id: string;
  app_name: string;
  api_key: string;
  api_secret: string;
  bearer_token: string | null;
  callback_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TwitterAppCardProps {
  app: TwitterApp;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onTestConnection: () => void;
}

export default function TwitterAppCard({
  app,
  onEdit,
  onDelete,
  onToggleActive,
  onTestConnection
}: TwitterAppCardProps) {
  const [showSecrets, setShowSecrets] = useState(false);

  const maskSecret = (secret: string) => {
    if (!secret) return '';
    return secret.substring(0, 4) + '••••••••' + secret.substring(secret.length - 4);
  };

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
      !app.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{app.app_name}</h3>
          {app.is_active ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <XCircle size={20} className="text-gray-400" />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-1 rounded ${
            app.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {app.is_active ? 'アクティブ' : '非アクティブ'}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">API Key</div>
          <div className="text-sm font-mono text-gray-900 truncate">
            {showSecrets ? app.api_key : maskSecret(app.api_key)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">API Secret</div>
          <div className="text-sm font-mono text-gray-900 truncate">
            {showSecrets ? app.api_secret : maskSecret(app.api_secret)}
          </div>
        </div>
        {app.bearer_token && (
          <div>
            <div className="text-xs text-gray-500 mb-1">Bearer Token</div>
            <div className="text-sm font-mono text-gray-900 truncate">
              {showSecrets ? app.bearer_token : maskSecret(app.bearer_token)}
            </div>
          </div>
        )}
        {app.callback_url && (
          <div>
            <div className="text-xs text-gray-500 mb-1">Callback URL</div>
            <div className="text-xs font-mono text-gray-700 break-all">
              {app.callback_url}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            {showSecrets ? (
              <>
                <EyeOff size={16} />
                非表示
              </>
            ) : (
              <>
                <Eye size={16} />
                表示
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleActive}
              className={`px-3 py-2 text-sm rounded transition ${
                app.is_active
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {app.is_active ? '無効化' : '有効化'}
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

        {app.bearer_token && (
          <button
            onClick={onTestConnection}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition text-sm font-medium"
          >
            <Zap size={16} />
            接続テスト
          </button>
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        登録日: {new Date(app.created_at).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
