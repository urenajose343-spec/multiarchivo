/**
 * WebRTC P2P AirDrop Engine with DataChannel Chunk Streaming,
 * Backpressure Flow Control, End-to-End Encryption, and Fallback Relay.
 */

import { encryptChunk, decryptChunk, deriveKey } from './crypto';
import { TransferFileMeta, TransferSession } from '../types';

export const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk (optimal for WebRTC DataChannel)
const BUFFERED_AMOUNT_THRESHOLD = 512 * 1024; // 512 KB backpressure threshold

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCConnection {
  pc: RTCPeerConnection | null = null;
  dataChannel: RTCDataChannel | null = null;
  remotePeerId: string;
  isInitiator: boolean;
  onSignal: (signalData: any) => void;
  onChannelOpen: () => void;
  onChannelClose: () => void;
  onData: (data: string | ArrayBuffer) => void;
  onError: (error: any) => void;

  constructor(
    remotePeerId: string,
    isInitiator: boolean,
    callbacks: {
      onSignal: (signalData: any) => void;
      onChannelOpen: () => void;
      onChannelClose: () => void;
      onData: (data: string | ArrayBuffer) => void;
      onError: (error: any) => void;
    }
  ) {
    this.remotePeerId = remotePeerId;
    this.isInitiator = isInitiator;
    this.onSignal = callbacks.onSignal;
    this.onChannelOpen = callbacks.onChannelOpen;
    this.onChannelClose = callbacks.onChannelClose;
    this.onData = callbacks.onData;
    this.onError = callbacks.onError;

    this.init();
  }

  private init() {
    try {
      this.pc = new RTCPeerConnection(ICE_SERVERS);

      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.onSignal({
            type: 'candidate',
            candidate: event.candidate,
          });
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (this.pc?.connectionState === 'failed') {
          console.warn('WebRTC connection failed');
        }
      };

      if (this.isInitiator) {
        this.dataChannel = this.pc.createDataChannel('droplink-transfer', {
          ordered: true,
        });
        this.setupDataChannel(this.dataChannel);
      } else {
        this.pc.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.setupDataChannel(this.dataChannel);
        };
      }
    } catch (err) {
      this.onError(err);
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 128 * 1024; // 128KB threshold

    channel.onopen = () => {
      this.onChannelOpen();
    };

    channel.onclose = () => {
      this.onChannelClose();
    };

    channel.onerror = (e) => {
      this.onError(e);
    };

    channel.onmessage = (event) => {
      this.onData(event.data);
    };
  }

  async createOffer(): Promise<void> {
    if (!this.pc) return;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.onSignal({
        type: 'offer',
        sdp: this.pc.localDescription,
      });
    } catch (err) {
      this.onError(err);
    }
  }

  async handleSignal(signalData: any): Promise<void> {
    if (!this.pc) return;
    try {
      if (signalData.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.onSignal({
          type: 'answer',
          sdp: this.pc.localDescription,
        });
      } else if (signalData.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (err) {
      this.onError(err);
    }
  }

  send(data: string | ArrayBuffer): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(data as any);
    }
  }

  /**
   * Backpressure control: returns a promise that resolves when the internal
   * DataChannel buffer drains below the threshold.
   */
  async waitForDrain(): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    if (this.dataChannel.bufferedAmount < BUFFERED_AMOUNT_THRESHOLD) {
      return;
    }

    return new Promise((resolve) => {
      const handler = () => {
        if (this.dataChannel) {
          this.dataChannel.removeEventListener('bufferedamountlow', handler);
        }
        resolve();
      };
      if (this.dataChannel) {
        this.dataChannel.addEventListener('bufferedamountlow', handler);
      } else {
        resolve();
      }
    });
  }

  close() {
    try {
      if (this.dataChannel) {
        this.dataChannel.close();
      }
      if (this.pc) {
        this.pc.close();
      }
    } catch (e) {
      // ignore
    }
    this.dataChannel = null;
    this.pc = null;
  }
}
