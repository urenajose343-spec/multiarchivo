export type DeviceType = 'desktop' | 'mobile' | 'tablet';
export type DeviceOS = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other';

export interface PeerInfo {
  peerId: string;
  name: string;
  deviceType: DeviceType;
  os: DeviceOS;
  roomCode: string;
  joinedAt?: number;
}

export interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  sha256?: string;
  isHashing?: boolean;
}

export interface TransferFileMeta {
  name: string;
  size: number;
  type: string;
  sha256?: string;
}

export type TransferStatus =
  | 'idle'
  | 'requesting'
  | 'waiting_accept'
  | 'connecting'
  | 'transferring'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'error';

export interface TransferSession {
  id: string;
  direction: 'send' | 'receive';
  peerId: string;
  peerName: string;
  peerOs: DeviceOS;
  peerDeviceType: DeviceType;
  files: TransferFileMeta[];
  currentFileIndex: number;
  totalSize: number;
  transferredBytes: number;
  speedBps: number;
  etaSeconds: number;
  startTime: number;
  status: TransferStatus;
  errorMessage?: string;
  isEncrypted: boolean;
  authFingerprint: string;
  transport: 'webrtc' | 'relay';
}

export interface IncomingTransferRequest {
  transferId: string;
  fromPeerId: string;
  sender: {
    name: string;
    os: DeviceOS;
    deviceType: DeviceType;
  };
  files: TransferFileMeta[];
  totalSize: number;
  isEncrypted: boolean;
  authFingerprint: string;
}

export interface CloudVaultFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  isEncrypted: boolean;
  sha256?: string;
  senderName: string;
  senderOs: DeviceOS;
  roomCode: string;
  createdAt: number;
  expiresAt: number;
  downloadCount: number;
}
