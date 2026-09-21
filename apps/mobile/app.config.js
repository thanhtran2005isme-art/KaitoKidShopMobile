const os = require('os');
const { expo: baseConfig } = require('./app.json');

const VIRTUAL_ADAPTER_PATTERN = /(virtual|vmware|vbox|hyper-v|wsl|docker|tailscale|zerotier|loopback|bluetooth)/i;

function isPrivateIpv4(address) {
  if (!address) return false;
  if (/^10\./.test(address)) return true;
  if (/^192\.168\./.test(address)) return true;

  const match = address.match(/^172\.(\d{1,3})\./);
  if (!match) return false;

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function detectLanIpv4() {
  const candidates = [];

  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const item of addresses || []) {
      const family = String(item.family);
      const isIpv4 = family === 'IPv4' || family === '4';

      if (!isIpv4 || item.internal || !isPrivateIpv4(item.address)) continue;

      candidates.push({
        address: item.address,
        score: VIRTUAL_ADAPTER_PATTERN.test(name) ? 0 : 10,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address || null;
}

module.exports = () => {
  const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || null;
  const lanIpv4 = process.env.EAS_BUILD === 'true' ? null : detectLanIpv4();
  const autoApiUrl = lanIpv4 ? `http://${lanIpv4}:5265` : null;
  const apiUrl = explicitApiUrl || autoApiUrl;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[KaitoKid] API.Customer: ${apiUrl || 'platform fallback'}`);
  }

  return {
    ...baseConfig,
    extra: {
      ...(baseConfig.extra || {}),
      apiUrl,
      apiUrlSource: explicitApiUrl ? 'env' : autoApiUrl ? 'lan-auto' : 'platform-fallback',
    },
  };
};
