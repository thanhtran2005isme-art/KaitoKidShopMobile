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
  const backendMode = (process.env.EXPO_PUBLIC_BACKEND_MODE || 'csharp').trim().toLowerCase();
  const explicitNodeApiUrl = process.env.EXPO_PUBLIC_NODE_API_URL?.trim().replace(/\/+$/, '') || null;
  const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || null;
  const explicitAuthApiUrl = process.env.EXPO_PUBLIC_AUTH_API_URL?.trim().replace(/\/+$/, '') || null;
  const lanIpv4 = process.env.EAS_BUILD === 'true' ? null : detectLanIpv4();
  const autoNodeApiUrl = backendMode === 'node' && lanIpv4 ? `http://${lanIpv4}:5300` : null;
  const nodeApiUrl = explicitNodeApiUrl || autoNodeApiUrl;
  const autoApiUrl = lanIpv4 ? `http://${lanIpv4}:5265` : null;
  const autoAuthApiUrl = lanIpv4 ? `http://${lanIpv4}:5053` : null;
  const apiUrl = explicitApiUrl || nodeApiUrl || autoApiUrl;
  const authApiUrl = explicitAuthApiUrl || nodeApiUrl || autoAuthApiUrl;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[KaitoKid] Backend mode: ${nodeApiUrl ? 'node' : 'csharp'}`);
    console.log(`[KaitoKid] API.Customer: ${apiUrl || 'platform fallback'}`);
    console.log(`[KaitoKid] API.Auth: ${authApiUrl || 'platform fallback'}`);
  }

  return {
    ...baseConfig,
    plugins: [
      ...(baseConfig.plugins || []),
      [
        'expo-image-picker',
        {
          photosPermission: 'Cho phép KaitoKid truy cập ảnh để cập nhật avatar và gửi ảnh đánh giá.',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
    ],
    extra: {
      ...(baseConfig.extra || {}),
      apiUrl,
      authApiUrl,
      backendMode: nodeApiUrl ? 'node' : 'csharp',
      apiUrlSource: explicitApiUrl
        ? 'env-api'
        : nodeApiUrl
          ? explicitNodeApiUrl ? 'env-node' : 'lan-node'
          : autoApiUrl ? 'lan-auto' : 'platform-fallback',
      authApiUrlSource: explicitAuthApiUrl
        ? 'env-auth'
        : nodeApiUrl
          ? explicitNodeApiUrl ? 'env-node' : 'lan-node'
          : autoAuthApiUrl ? 'lan-auto' : 'platform-fallback',
    },
  };
};
