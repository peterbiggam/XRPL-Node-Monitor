import { type ConnectionConfig } from "@shared/schema";

export interface IStorage {
  getConnectionConfig(): Promise<ConnectionConfig>;
  setConnectionConfig(config: ConnectionConfig): Promise<ConnectionConfig>;
}

export class MemStorage implements IStorage {
  private connectionConfig: ConnectionConfig;

  constructor() {
    this.connectionConfig = {
      host: "localhost",
      wsPort: 6006,
      httpPort: 5005,
      adminPort: 8080,
    };
  }

  async getConnectionConfig(): Promise<ConnectionConfig> {
    return { ...this.connectionConfig };
  }

  async setConnectionConfig(config: ConnectionConfig): Promise<ConnectionConfig> {
    this.connectionConfig = { ...config };
    return this.connectionConfig;
  }
}

export const storage = new MemStorage();
