import { Socket } from 'net';
import { EventEmitter } from 'events';
import type { LyngdorfDevice, CommandResponse } from './types.js';

export class LyngdorfTransport extends EventEmitter {
  private socket: Socket | null = null;
  private device: LyngdorfDevice;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private commandQueue: Array<{ cmd: string; resolve: (value: string) => void; reject: (error: Error) => void }> = [];
  private responseBuffer = '';

  constructor(device: LyngdorfDevice) {
    super();
    this.device = device;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new Socket();

      this.socket.on('connect', () => {
        this.emit('connected');
        // Set feedback level 1 (send data on status changes)
        this.sendCommand('!VERB(1)').catch(() => {});
        resolve();
      });

      this.socket.on('data', (data) => {
        this.handleData(data.toString());
      });

      this.socket.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.socket.on('close', () => {
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.socket.connect(this.device.port, this.device.ip);
    });
  }

  private handleData(data: string): void {
    this.responseBuffer += data;

    // Process complete messages (ending with \r)
    const messages = this.responseBuffer.split('\r');
    this.responseBuffer = messages.pop() || '';

    for (const message of messages) {
      if (message.length > 0) {
        this.processMessage(message);
      }
    }
  }

  private processMessage(message: string): void {
    // Echo messages start with #, status messages with !
    if (message.startsWith('#')) {
      // Echo - ignore
      return;
    }

    if (message.startsWith('!')) {
      // Status update
      this.emit('status', message);

      // If we have pending commands, resolve the first one
      if (this.commandQueue.length > 0) {
        const pending = this.commandQueue.shift();
        if (pending) {
          pending.resolve(message);
        }
      }
    }
  }

  async sendCommand(command: string): Promise<string> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Not connected to device');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const idx = this.commandQueue.findIndex(c => c.resolve === resolve);
        if (idx >= 0) this.commandQueue.splice(idx, 1);
        reject(new Error('Command timeout'));
      }, 5000);

      this.commandQueue.push({
        cmd: command,
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Send command with \r terminator
      this.socket!.write(command + '\r', (error) => {
        if (error) {
          const pending = this.commandQueue.pop();
          if (pending) {
            clearTimeout(timeoutId);
            pending.reject(error);
          }
        }
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Retry on failure
        this.scheduleReconnect();
      });
    }, 5000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  parseVolumeResponse(response: string): number | null {
    const match = response.match(/!VOL\(([-\d.]+)\)/);
    return match ? parseFloat(match[1]) : null;
  }

  parseSourceResponse(response: string): number | null {
    const match = response.match(/!SRC\((\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  parseVoicingResponse(response: string): number | null {
    const match = response.match(/!VOI\((\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  parseRoomPerfectResponse(response: string): string | null {
    if (response.includes('!RPGLOB')) return 'Global';
    const match = response.match(/!RPFOC\((\d+)\)/);
    return match ? `Focus ${match[1]}` : null;
  }
}
