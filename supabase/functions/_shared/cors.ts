// CORS設定ユーティリティ
// セキュリティ: 環境変数ベースでOriginを制限

export function getCorsHeaders(): Record<string, string> {
  // SECURITY: ALLOWED_ORIGINS must be set in production
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;

  if (!allowedOrigins) {
    if (isProduction) {
      throw new Error('SECURITY ERROR: ALLOWED_ORIGINS environment variable must be set in production');
    }
    console.warn('WARNING: ALLOWED_ORIGINS not set. Using * for local development only.');
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
  }

  const originsArray = allowedOrigins.split(',').map(o => o.trim());

  return {
    'Access-Control-Allow-Origin': originsArray[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// リクエストOriginに基づいた動的CORS（複数Origin対応）
export function getCorsHeadersForRequest(req: Request): Record<string, string> {
  // SECURITY: ALLOWED_ORIGINS must be set in production
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;

  if (!allowedOrigins) {
    if (isProduction) {
      throw new Error('SECURITY ERROR: ALLOWED_ORIGINS environment variable must be set in production');
    }
    console.warn('WARNING: ALLOWED_ORIGINS not set. Using * for local development only.');
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
  }

  const originsArray = allowedOrigins.split(',').map(o => o.trim());
  const requestOrigin = req.headers.get('origin');
  const allowedOrigin = requestOrigin && originsArray.includes(requestOrigin)
    ? requestOrigin
    : originsArray[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
