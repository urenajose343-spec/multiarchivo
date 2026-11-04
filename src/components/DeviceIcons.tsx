import React from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  HardDrive,
  FileText,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
  FileImage,
  File as FileGeneric,
} from 'lucide-react';
import { DeviceOS, DeviceType } from '../types';

export function DeviceIcon({
  os,
  deviceType,
  className = 'w-6 h-6',
}: {
  os?: DeviceOS;
  deviceType?: DeviceType;
  className?: string;
}) {
  if (deviceType === 'mobile') {
    return <Smartphone className={className} />;
  }
  if (deviceType === 'tablet') {
    return <Tablet className={className} />;
  }
  if (os === 'macos') {
    return <Laptop className={className} />;
  }
  if (os === 'windows') {
    return <Monitor className={className} />;
  }
  if (os === 'linux') {
    return <HardDrive className={className} />;
  }
  return <Laptop className={className} />;
}

export function FileTypeIcon({
  mimeType,
  name,
  className = 'w-5 h-5',
}: {
  mimeType?: string;
  name?: string;
  className?: string;
}) {
  const ext = name ? name.split('.').pop()?.toLowerCase() : '';
  const type = mimeType || '';

  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'].includes(ext || '')) {
    return <FileImage className={className} />;
  }
  if (type.startsWith('video/') || ['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext || '')) {
    return <FileVideo className={className} />;
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext || '')) {
    return <FileAudio className={className} />;
  }
  if (
    type.includes('zip') ||
    type.includes('tar') ||
    type.includes('rar') ||
    type.includes('compressed') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso'].includes(ext || ''))
  {
    return <FileArchive className={className} />;
  }
  if (
    type.includes('javascript') ||
    type.includes('json') ||
    type.includes('typescript') ||
    ['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'html', 'css', 'go', 'rs', 'c', 'cpp'].includes(ext || '')
  ) {
    return <FileCode className={className} />;
  }
  if (
    type.includes('pdf') ||
    type.includes('text') ||
    type.includes('document') ||
    ['pdf', 'txt', 'doc', 'docx', 'md', 'rtf'].includes(ext || '')
  ) {
    return <FileText className={className} />;
  }
  return <FileGeneric className={className} />;
}
