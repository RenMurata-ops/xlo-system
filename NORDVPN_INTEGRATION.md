# NordVPN Integration Guide

## Overview

This guide explains how to integrate NordVPN with the XLO Twitter Automation System to enable safe, distributed operation of up to 500 Twitter accounts simultaneously.

## Why NordVPN?

When operating hundreds of Twitter accounts, using the same IP address for all requests creates significant risks:

- **Detection Risk**: Twitter can easily identify and ban mass operations from a single IP
- **Rate Limiting**: All accounts share the same rate limits
- **Account Suspension**: High-volume activity from one IP triggers automated security measures

NordVPN provides:
- **6000+ servers** across 60+ countries
- **HTTP Proxy support** (Port 89) - compatible with Supabase Edge Functions
- **Residential IPs** option for enhanced legitimacy
- **Automatic IP rotation** capabilities
- **Reliable uptime** and fast connection speeds

## Prerequisites

1. **NordVPN Subscription**: Active NordVPN account with proxy access
2. **Service Credentials**: HTTP proxy username/password from NordVPN dashboard

## Step 1: Get NordVPN Service Credentials

### Access NordVPN Dashboard

1. Log in to your NordVPN account at https://my.nordaccount.com/
2. Navigate to **Services** → **NordVPN** → **Manual Setup**
3. Under **Service Credentials**, generate or view your:
   - **Service Username** (different from your NordVPN login)
   - **Service Password**

> **Important**: These credentials are different from your NordVPN account login credentials. They are specifically for HTTP/SOCKS proxy connections.

### Find NordVPN Server Addresses

You can find NordVPN server addresses in several ways:

#### Method 1: NordVPN Website
1. Visit https://nordvpn.com/servers/tools/
2. Select your preferred country and server type
3. Copy the server hostname (e.g., `us9999.nordvpn.com`)

#### Method 2: API Query
```bash
# Get recommended servers for a country (e.g., United States)
curl "https://api.nordvpn.com/v1/servers/recommendations?filters\[country_id\]=228&limit=10"

# Find server hostname in the response
```

#### Method 3: NordVPN App
1. Open NordVPN app
2. Click on a server location
3. View server details to see hostname

### Recommended Server Selection Strategy

For 500-account operation, distribute across multiple countries/servers:

**Tier 1: High-volume accounts (USA recommended)**
- `us9999.nordvpn.com` (replace 9999 with actual server number)
- `us8888.nordvpn.com`
- `us7777.nordvpn.com`

**Tier 2: Medium-volume accounts (Europe)**
- `uk1234.nordvpn.com`
- `de1234.nordvpn.com`
- `nl1234.nordvpn.com`

**Tier 3: Low-volume accounts (Asia)**
- `jp1234.nordvpn.com`
- `sg1234.nordvpn.com`
- `hk1234.nordvpn.com`

## Step 2: Add NordVPN Proxies in XLO System

### Via UI (Recommended)

1. Navigate to **Proxies** page in XLO system
2. Click **新規プロキシ追加** (Add New Proxy)
3. Select **NordVPN** as Provider Type
4. Fill in the form:

   ```
   プロキシ名: NordVPN US East 1
   NordVPN サーバーアドレス: us9999.nordvpn.com
   国コード: US
   都市: New York (optional)
   サービス認証情報 - ユーザー名: [Your Service Username]
   サービス認証情報 - パスワード: [Your Service Password]
   最大割り当てアカウント数: 10-20 (recommended)
   ```

5. Click **登録** (Register)

### Via Database (Advanced)

```sql
INSERT INTO proxies (
  user_id,
  name,
  provider_type,
  nordvpn_server,
  nordvpn_country,
  nordvpn_username,
  nordvpn_password,
  max_accounts,
  is_active,
  health_status
) VALUES (
  '[YOUR_USER_ID]',
  'NordVPN US East 1',
  'nordvpn',
  'us9999.nordvpn.com',
  'US',
  '[SERVICE_USERNAME]',
  '[SERVICE_PASSWORD]',
  20,
  true,
  'unknown'
);
```

## Step 3: Assign Proxies to Accounts

### Automatic Assignment

Use the built-in RPC function to automatically distribute proxies:

```sql
-- Automatically assign proxies to all accounts without proxies
SELECT * FROM rebalance_proxy_assignments('[YOUR_USER_ID]');
```

This function:
- Finds all active accounts without proxies
- Assigns them to the least-loaded, healthy proxy
- Respects `max_accounts` limit per proxy
- Balances load across all available proxies

### Manual Assignment

Via UI:
1. Go to **Main Accounts** or **Spam Accounts** page
2. Edit an account
3. Select proxy from dropdown
4. Save

Via Database:
```sql
-- Assign specific proxy to account
UPDATE main_accounts
SET proxy_id = '[PROXY_ID]'
WHERE id = '[ACCOUNT_ID]';

-- Update proxy usage count
UPDATE proxies
SET current_accounts = (
  SELECT COUNT(*) FROM (
    SELECT proxy_id FROM main_accounts WHERE proxy_id = '[PROXY_ID]'
    UNION ALL
    SELECT proxy_id FROM spam_accounts WHERE proxy_id = '[PROXY_ID]'
  ) AS combined
)
WHERE id = '[PROXY_ID]';
```

## Step 4: Verify Proxy Functionality

### Test Individual Proxy

Use the twitter-api-proxy function with a proxy-assigned account:

```javascript
const response = await fetch('/api/supabase/functions/v1/twitter-api-proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    account_id: 'your-account-id',
    endpoint: '/2/users/me',
    method: 'GET'
  })
});

const data = await response.json();
console.log('Proxy used:', data.proxy_used); // Should be true
```

### Monitor Proxy Health

1. Navigate to **Dashboard** → **Mass Operations**
2. View **プロキシ使用状況** (Proxy Usage) section
3. Check:
   - Utilization percentage (should be balanced)
   - Request count
   - Error rate (should be <5%)
   - Health status

## Step 5: Scale to 500 Accounts

### Recommended Proxy Distribution

For 500 accounts, we recommend:

**50 Proxies × 10 accounts each = 500 accounts**

Distribution example:
```
20 proxies in US (200 accounts)
15 proxies in Europe (150 accounts)
10 proxies in Asia (100 accounts)
5 proxies in other regions (50 accounts)
```

### Cost Estimation

- **NordVPN Standard Plan**: $3.99/month (1 subscription needed)
- **Total Cost**: ~$4/month for unlimited proxy servers
- **Cost per Account**: $0.008/month

> **Note**: One NordVPN subscription provides access to all 6000+ servers. You don't need multiple subscriptions.

### Setup Script for 50 Proxies

```javascript
// Example: Add 20 US proxies
const usServers = [
  'us9999', 'us9998', 'us9997', 'us9996', 'us9995',
  'us9994', 'us9993', 'us9992', 'us9991', 'us9990',
  'us9989', 'us9988', 'us9987', 'us9986', 'us9985',
  'us9984', 'us9983', 'us9982', 'us9981', 'us9980'
];

for (const server of usServers) {
  await supabase.from('proxies').insert({
    user_id: userId,
    name: `NordVPN ${server.toUpperCase()}`,
    provider_type: 'nordvpn',
    nordvpn_server: `${server}.nordvpn.com`,
    nordvpn_country: 'US',
    nordvpn_username: serviceUsername,
    nordvpn_password: servicePassword,
    max_accounts: 10,
    is_active: true
  });
}
```

## Best Practices

### 1. **Geographic Distribution**
- Distribute accounts across multiple countries
- Match account language/content with proxy location
- Use local proxies for location-specific content

### 2. **Load Balancing**
- Keep proxy utilization below 80%
- Monitor `current_accounts / max_accounts` ratio
- Add new proxies before reaching capacity

### 3. **Health Monitoring**
- Check Mass Operations Dashboard daily
- Investigate proxies with >10% error rate
- Replace unhealthy proxies promptly

### 4. **Account Assignment Strategy**
```
High-Value Accounts (Main):
- 1-2 accounts per proxy
- Premium country servers (US, UK, DE)
- Regular rotation

Medium-Value Accounts:
- 5-10 accounts per proxy
- Standard servers

Low-Value Accounts (Spam):
- 10-20 accounts per proxy
- Any available servers
```

### 5. **Security**
- Store NordVPN credentials securely in database (encrypted)
- Never commit credentials to version control
- Rotate service credentials every 3 months
- Use different proxies for different account types

## Troubleshooting

### Issue: Proxy connection fails

**Symptoms**: Requests fail with "proxy connection error"

**Solutions**:
1. Verify service credentials are correct
2. Check if NordVPN subscription is active
3. Test server availability: `ping us9999.nordvpn.com`
4. Try different server: some servers may be temporarily down
5. Ensure port 89 is not blocked by firewall

### Issue: High error rate on specific proxy

**Symptoms**: One proxy shows >10% error rate

**Solutions**:
1. Check server status on NordVPN
2. Temporarily disable proxy: `UPDATE proxies SET is_active = false WHERE id = '...'`
3. Reassign accounts to different proxy
4. Replace with different server

### Issue: Twitter detecting proxy usage

**Symptoms**: Accounts suspended despite using proxies

**Solutions**:
1. **Reduce volume**: Lower `max_accounts` per proxy to 5-10
2. **Add delays**: Increase time between requests
3. **Rotate servers**: Change NordVPN servers weekly
4. **Use residential IPs**: Consider NordVPN's residential IP option
5. **Diversify behavior**: Vary request patterns, timing, content

### Issue: Slow response times

**Symptoms**: Requests take >3 seconds

**Solutions**:
1. Choose geographically closer servers
2. Use NordVPN's recommended servers (lower load)
3. Check NordVPN server load at https://nordvpn.com/servers/tools/
4. Increase timeout in Edge Function if needed

## Advanced Configuration

### Dynamic Server Selection

For advanced users, implement dynamic server rotation:

```typescript
// Auto-rotate servers every 24 hours
async function rotateProxyServers(userId: string) {
  const proxies = await supabase
    .from('proxies')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_type', 'nordvpn');

  for (const proxy of proxies.data || []) {
    // Get new server from same country
    const newServer = await getRecommendedServer(proxy.nordvpn_country);

    await supabase
      .from('proxies')
      .update({ nordvpn_server: newServer })
      .eq('id', proxy.id);
  }
}
```

### Residential IP Proxies

For maximum legitimacy:

1. Subscribe to NordVPN with residential IP add-on
2. Use residential servers (different configuration)
3. Lower `max_accounts` to 1-3 per proxy
4. Higher cost but much safer for valuable accounts

## Monitoring Queries

### Check proxy utilization
```sql
SELECT
  name,
  nordvpn_server,
  current_accounts,
  max_accounts,
  ROUND((current_accounts::NUMERIC / max_accounts) * 100, 1) as utilization_percent
FROM proxies
WHERE provider_type = 'nordvpn'
ORDER BY utilization_percent DESC;
```

### Find accounts without proxies
```sql
SELECT COUNT(*) as accounts_without_proxy
FROM (
  SELECT id FROM main_accounts WHERE proxy_id IS NULL
  UNION ALL
  SELECT id FROM spam_accounts WHERE proxy_id IS NULL
) as combined;
```

### Proxy performance stats
```sql
SELECT * FROM get_proxy_usage_summary('[YOUR_USER_ID]');
```

## Support & Resources

- **NordVPN Support**: https://support.nordvpn.com/
- **NordVPN Server List**: https://nordvpn.com/servers/tools/
- **NordVPN API Docs**: https://sleeplessbeastie.eu/2019/02/21/how-to-use-public-nordvpn-api/
- **XLO System Docs**: See MASS_OPERATION_GUIDE.md

## Summary

With proper NordVPN integration:

✅ **Safe 500-account operation**
✅ **Distributed IP addresses** across 50+ proxies
✅ **Reduced detection risk** via geographic distribution
✅ **Automatic load balancing** and health monitoring
✅ **Low cost** (~$4/month total)
✅ **Easy management** via UI and dashboard

Follow this guide to set up robust, scalable Twitter automation that can safely handle hundreds of accounts simultaneously.
