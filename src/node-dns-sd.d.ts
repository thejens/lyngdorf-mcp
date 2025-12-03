declare module 'node-dns-sd' {
  export interface DiscoveryOptions {
    name: string;
    wait?: number;
  }

  export interface Service {
    address?: string;
    fqdn?: string;
    port?: number;
    [key: string]: any;
  }

  export function discover(options: DiscoveryOptions): Promise<Service[]>;

  export default { discover };
}
