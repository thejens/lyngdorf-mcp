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
        // VERB command doesn't return a response, so write directly
        this.socket!.write('!VERB(1)\r');
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

    // Process complete messages (ending with \r or \r\n)
    // Split on \r and strip any leading \n from messages
    const messages = this.responseBuffer.split('\r');
    this.responseBuffer = messages.pop() || '';

    for (const message of messages) {
      // Strip leading \n if present
      const cleaned = message.replace(/^\n/, '');
      if (cleaned.length > 0) {
        this.processMessage(cleaned);
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

  // Send command without waiting for response (for commands that don't return data)
  async sendCommandNoResponse(command: string): Promise<void> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Not connected to device');
    }

    return new Promise((resolve, reject) => {
      this.socket!.write(command + '\r', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
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
    const match = response.match(/!RP\((\d+)\)/);
    if (!match) return null;

    const position = parseInt(match[1], 10);
    if (position === 0) return 'Bypass';
    if (position === 9) return 'Global';
    if (position >= 1 && position <= 8) return `Focus ${position}`;
    return null;
  }

  parseMuteResponse(response: string): boolean | null {
    if (response.includes('!MUTE(ON)')) return true;
    if (response.includes('!MUTE(OFF)')) return false;
    return null;
  }

  parseStreamTypeResponse(response: string): string | null {
    const match = response.match(/!STREAMTYPE\((\d+)\)/);
    if (!match) return null;

    const streamTypeMap: { [key: string]: string } = {
      '0': 'None',
      '1': 'vTuner',
      '2': 'Spotify',
      '3': 'AirPlay',
      '4': 'uPnP',
      '5': 'USB File',
      '6': 'Roon Ready',
      '7': 'Bluetooth',
      '8': 'GoogleCast',
      '9': 'Unknown'
    };

    return streamTypeMap[match[1]] || 'Unknown';
  }

  parseBassResponse(response: string): number | null {
    const match = response.match(/!BASS\(([-\d]+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  parseBassFreqResponse(response: string): number | null {
    const match = response.match(/!BASSFREQ\((\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  parseTrebleResponse(response: string): number | null {
    const match = response.match(/!TREBLE\(([-\d]+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  parseTrebleFreqResponse(response: string): number | null {
    const match = response.match(/!TREBLEFREQ\((\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  parseBalanceResponse(response: string): string | null {
    const match = response.match(/!BAL\(([LR]?\d+|0)\)/);
    return match ? match[1] : null;
  }

  parseListResponse(multilineResponse: string): Array<{ number: number; name: string }> {
    const lines = multilineResponse.split(/\r\n|\r|\n/).filter(line => line.trim());
    const items: Array<{ number: number; name: string }> = [];

    for (const line of lines) {
      // Parse lines like: !SRCNAME(1,"HDMI ARC") or !RPNAME(1,"Living Room") or !VOINAME(1,"Neutral")
      const match = line.match(/!(SRCNAME|RPNAME|VOINAME)\((\d+),"([^"]*)"\)/);
      if (match) {
        items.push({
          number: parseInt(match[2], 10),
          name: match[3]
        });
      }
    }

    return items;
  }
}
