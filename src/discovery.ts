import dnssd from 'node-dns-sd';
import type { LyngdorfDevice, DeviceModel } from './types.js';

const SERVICE_TYPE = '_slactrl._tcp.local';
const DEFAULT_PORT = 84;

export class LyngdorfDiscovery {
  async discover(timeoutMs = 3000): Promise<LyngdorfDevice[]> {
    const devices: LyngdorfDevice[] = [];

    try {
      const services = await dnssd.discover({
        name: SERVICE_TYPE,
        wait: timeoutMs
      });

      for (const service of services) {
        if (service.address && service.fqdn) {
          const device: LyngdorfDevice = {
            model: this.extractModel(service.fqdn),
            ip: service.address,
            hostname: service.fqdn,
            port: service.port || DEFAULT_PORT
          };
          devices.push(device);
        }
      }
    } catch (error) {
      // Discovery failed or no devices found
      console.error('Discovery error:', error);
    }

    return devices;
  }

  private extractModel(hostname: string): DeviceModel {
    const upper = hostname.toUpperCase();

    if (upper.includes('TDAI-1120')) return 'TDAI-1120';
    if (upper.includes('TDAI-2170')) return 'TDAI-2170';
    if (upper.includes('TDAI-3400')) return 'TDAI-3400';
    if (upper.includes('MP-40')) return 'MP-40';
    if (upper.includes('MP-50')) return 'MP-50';
    if (upper.includes('MP-60')) return 'MP-60';
    if (upper.includes('CD-1')) return 'CD-1';

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
