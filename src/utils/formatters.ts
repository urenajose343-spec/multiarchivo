/**
 * Number and string formatting utilities for high-throughput transfer displays
 */

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0.0 MB/s';
  const mbps = bytesPerSec / (1024 * 1024);
  if (mbps < 0.1) {
    const kbps = bytesPerSec / 1024;
    return `${kbps.toFixed(1)} KB/s`;
  }
  return `${mbps.toFixed(1)} MB/s`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
  const sec = Math.round(seconds);
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  if (mins < 60) return `${mins}m ${remainingSec.toString().padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

export function formatTimeRemaining(expiryTimestamp: number): string {
  const diff = expiryTimestamp - Date.now();
  if (diff <= 0) return 'Expirado';
  const hours = Math.floor(diff / (3600 * 1000));
  const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins}m restantes`;
  return `${mins}m restantes`;
}

export function truncateFilename(name: string, maxLen = 28): string {
  if (!name || name.length <= maxLen) return name;
  const extIndex = name.lastIndexOf('.');
  if (extIndex > 0 && extIndex > name.length - 8) {
    const ext = name.slice(extIndex);
    const base = name.slice(0, extIndex);
    const leftLen = maxLen - ext.length - 3;
    return `${base.slice(0, Math.max(leftLen, 4))}...${ext}`;
  }
  return `${name.slice(0, maxLen - 3)}...`;
}
