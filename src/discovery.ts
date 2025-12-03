import { spawn } from 'node:child_process';
import type { LyngdorfDevice, DeviceModel } from './types.js';

const SERVICE_TYPE = '_slactrl._tcp';
const DEFAULT_PORT = 84;

export class LyngdorfDiscovery {
  async discover(timeoutMs = 3000): Promise<LyngdorfDevice[]> {
    const devices: LyngdorfDevice[] = [];

    try {
      // Use native dns-sd command via child_process instead of node-dns-sd
      // which fails with network interface enumeration on macOS
      const services = await this.discoverViaDnsSd(timeoutMs);
      devices.push(...services);
    } catch (error) {
      console.error('Discovery error:', error);
    }

    return devices;
  }

  private async discoverViaDnsSd(timeoutMs: number): Promise<LyngdorfDevice[]> {
    const devices: LyngdorfDevice[] = [];

    // Browse for services with built-in timeout
    const timeoutSec = Math.ceil(timeoutMs / 1000);
    const proc = spawn('dns-sd', ['-t', timeoutSec.toString(), '-B', SERVICE_TYPE, 'local']);

    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Wait for process to exit naturally after timeout
    await new Promise<void>((resolve) => {
      proc.on('exit', () => resolve());
      proc.on('error', () => resolve());
    });

    const instanceNames = this.parseBrowseOutput(stdout);

    // For each instance, lookup details
    for (const instanceName of instanceNames) {
      try {
        const device = await this.lookupDevice(instanceName);
        if (device) {
          devices.push(device);
        }
      } catch (err) {
        console.error(`Failed to lookup ${instanceName}:`, err);
      }
    }

    return devices;
  }

  private parseBrowseOutput(stdout: string): string[] {
    const instanceNames: string[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      // Look for "Add" lines with instance names
      // Format: "Timestamp     A/R    Flags  if Domain               Service Type         Instance Name"
      // Example: "23:22:25.690  Add        2  14 local.               _slactrl._tcp.       Stereo"
      if (line.includes('Add') && line.includes(SERVICE_TYPE)) {
        const parts = line.split(/\s+/);
        // Instance name is the last part
        const instanceName = parts[parts.length - 1];
        if (instanceName && instanceName !== 'Name') {
          instanceNames.push(instanceName);
        }
      }
    }

    return instanceNames;
  }

  private async lookupDevice(instanceName: string): Promise<LyngdorfDevice | null> {
    try {
      const proc = spawn('dns-sd', ['-t', '2', '-L', instanceName, SERVICE_TYPE, 'local']);

      let stdout = '';
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Wait for process to exit naturally
      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve());
        proc.on('error', () => resolve());
      });

      // Parse output to get hostname
      // Format: "Stereo._slactrl._tcp.local. can be reached at tdai1120.local.:84 (interface 14)"
      const match = stdout.match(/can be reached at ([^:]+):(\d+)/);
      if (!match) {
        return null;
      }

      const hostname = match[1];
      const port = parseInt(match[2], 10);

      // Resolve hostname to IP
      const ip = await this.resolveHostname(hostname);
      if (!ip) {
        return null;
      }

      return {
        model: this.extractModel(hostname),
        ip,
        hostname,
        port,
        name: instanceName // Store the custom device name
      };
    } catch (error) {
      console.error(`Failed to lookup ${instanceName}:`, error);
      return null;
    }
  }

  private async resolveHostname(hostname: string): Promise<string | null> {
    try {
      const proc = spawn('dns-sd', ['-t', '2', '-G', 'v4', hostname]);

      let stdout = '';
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Wait for process to exit naturally
      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve());
        proc.on('error', () => resolve());
      });

      // Parse output to get IP address
      // Format: "Timestamp     A/R  Flags         IF  Hostname                               Address                                      TTL"
      // Example: "23:24:50.807  Add  40000002      14  tdai1120.local.                        192.168.86.35                                120"
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('Add') && line.includes(hostname)) {
          const parts = line.split(/\s+/);
          // IP address is typically 5th or 6th field after hostname
          for (let i = 0; i < parts.length; i++) {
            if (parts[i].includes(hostname.replace(/\.$/, ''))) {
              // IP should be next field
              const ip = parts[i + 1];
              if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
                return ip;
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error(`Failed to resolve ${hostname}:`, error);
      return null;
    }
  }

  private extractModel(hostname: string): DeviceModel {
    const upper = hostname.toUpperCase();

    if (upper.includes('TDAI-1120') || upper.includes('TDAI1120')) return 'TDAI-1120';
    if (upper.includes('TDAI-2170') || upper.includes('TDAI2170')) return 'TDAI-2170';
    if (upper.includes('TDAI-3400') || upper.includes('TDAI3400')) return 'TDAI-3400';
    if (upper.includes('MP-40') || upper.includes('MP40')) return 'MP-40';
    if (upper.includes('MP-50') || upper.includes('MP50')) return 'MP-50';
    if (upper.includes('MP-60') || upper.includes('MP60')) return 'MP-60';
    if (upper.includes('CD-1') || upper.includes('CD1')) return 'CD-1';

    return 'Unknown';
  }

  async findDevice(modelOrIp: string): Promise<LyngdorfDevice | null> {
    // If it looks like an IP, use it directly
    if (/^\d+\.\d+\.\d+\.\d+$/.test(modelOrIp)) {
      return {
        model: 'Unknown',
        ip: modelOrIp,
        hostname: modelOrIp,
        port: DEFAULT_PORT
      };
    }

    // Otherwise, discover devices and find matching model
    const devices = await this.discover();
    const model = modelOrIp.toUpperCase();

    return devices.find(d => d.model.toUpperCase().includes(model)) || null;
  }
}
