import { DeviceOS, DeviceType } from '../types';

export function detectDevice(): { os: DeviceOS; deviceType: DeviceType; defaultName: string } {
  if (typeof window === 'undefined') {
    return { os: 'other', deviceType: 'desktop', defaultName: 'Dispositivo Web' };
  }

  const userAgent = navigator.userAgent || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

  let os: DeviceOS = 'other';
  let deviceType: DeviceType = 'desktop';

  if (/iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    os = 'ios';
    deviceType = /iPad/.test(userAgent) || navigator.maxTouchPoints > 1 ? 'tablet' : 'mobile';
  } else if (/Android/.test(userAgent)) {
    os = 'android';
    deviceType = /Mobile/.test(userAgent) ? 'mobile' : 'tablet';
  } else if (/Mac/.test(platform) || /Macintosh/.test(userAgent)) {
    os = 'macos';
    deviceType = 'desktop';
  } else if (/Win/.test(platform) || /Windows/.test(userAgent)) {
    os = 'windows';
    deviceType = 'desktop';
  } else if (/Linux/.test(platform) || /Linux/.test(userAgent)) {
    os = 'linux';
    deviceType = 'desktop';
  }

  // Friendly default names like Apple AirDrop
  const adjectives = ['Rápido', 'Seguro', 'Cifrado', 'Ágil', 'Pro', 'Ultra', 'Directo'];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];

  let defaultName = 'Dispositivo';
  switch (os) {
    case 'ios':
      defaultName = deviceType === 'tablet' ? `iPad ${randomAdj}` : `iPhone ${randomAdj}`;
      break;
    case 'android':
      defaultName = deviceType === 'tablet' ? `Tablet Android ${randomAdj}` : `Android ${randomAdj}`;
      break;
    case 'macos':
      defaultName = `MacBook ${randomAdj}`;
      break;
    case 'windows':
      defaultName = `PC Windows ${randomAdj}`;
      break;
    case 'linux':
      defaultName = `Estación Linux ${randomAdj}`;
      break;
    default:
      defaultName = `Dispositivo ${randomAdj}`;
  }

  return { os, deviceType, defaultName };
}

export function getOrCreatePeerId(): string {
  if (typeof window === 'undefined') return 'peer-' + Math.random().toString(36).slice(2, 9);
  let id = localStorage.getItem('droplink_peer_id');
  if (!id) {
    id = 'peer-' + Math.random().toString(36).slice(2, 9) + '-' + Date.now().toString(36);
    localStorage.setItem('droplink_peer_id', id);
  }
  return id;
}

export function getStoredDeviceName(defaultName: string): string {
  if (typeof window === 'undefined') return defaultName;
  const stored = localStorage.getItem('droplink_device_name');
  if (stored && stored.trim()) return stored.trim();
  localStorage.setItem('droplink_device_name', defaultName);
  return defaultName;
}

export function setStoredDeviceName(name: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('droplink_device_name', name.trim());
  }
}
