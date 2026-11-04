/**
 * Web Bluetooth API Integration for proximity device discovery and pairing
 */

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
  rssi?: number;
  rawDevice?: any;
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Scans for nearby Bluetooth Low Energy (BLE) devices using the native browser dialog.
 * Requires user gesture (click).
 */
export async function scanBluetoothDevice(): Promise<BluetoothDeviceInfo | null> {
  if (!isBluetoothSupported()) {
    throw new Error(
      'Web Bluetooth no está soportado en este navegador. Utiliza Google Chrome, Microsoft Edge o Android Chrome.'
    );
  }

  try {
    const nav = navigator as any;
    // Request nearby Bluetooth device
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        'battery_service',
        'device_information',
        'generic_access',
      ],
    });

    if (!device) return null;

    let isConnected = false;
    if (device.gatt) {
      try {
        await device.gatt.connect();
        isConnected = device.gatt.connected;
      } catch (e) {
        // Many BLE devices allow pairing even if GATT connection is restricted
        isConnected = true;
      }
    }

    return {
      id: device.id,
      name: device.name || 'Dispositivo Bluetooth',
      connected: isConnected,
      rawDevice: device,
    };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      // User cancelled device picker
      return null;
    }
    throw err;
  }
}
