'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

export default function CallbackUrlDisplay() {
  const [copied, setCopied] = useState(false);

  // Supabase Edge Function callback URL
  const callbackUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twitter-oauth-callback-v2`;

  const handleCopy = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
      <div className="flex items-start gap-3 mb-3">
        <ExternalLink size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-blue-200 mb-1">
            Twitter Developer Portalで設定するCallback URL
          </h3>
          <p className="text-xs text-blue-300">
            このURLをTwitter Developer Portalのアプリ設定にコピーしてください
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2">
          <code className="text-sm text-gray-300 font-mono break-all">
            {callbackUrl}
          </code>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {copied ? (
            <>
              <Check size={16} />
              <span className="text-sm">コピー済み</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span className="text-sm">コピー</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-blue-800">
        <p className="text-xs text-blue-300">
          <strong>設定手順：</strong>
        </p>
        <ol className="text-xs text-blue-300 mt-1 space-y-1 ml-4 list-decimal">
          <li>Twitter Developer Portalにアクセス</li>
          <li>プロジェクトとアプリを作成</li>
          <li>App Settingsから「User authentication settings」を編集</li>
          <li>上記のCallback URLを「Callback URI」に設定</li>
          <li>API KeyとAPI Secretをコピーして下記フォームに入力</li>
        </ol>
      </div>
    </div>
  );
}
