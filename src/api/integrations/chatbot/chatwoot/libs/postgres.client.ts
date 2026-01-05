import { Chatwoot, configService } from '@config/env.config';
import { Logger } from '@config/logger.config';
import postgresql from 'pg';

const { Pool } = postgresql;

class Postgres {
  private logger = new Logger('Postgres');
  private pool;
  private connected = false;

  getConnection(connectionString: string) {
    if (this.connected && this.pool) {
      return this.pool;
    }

    // Parse connection string to check if SSL should be enabled
    const useSSL =
      connectionString.includes('sslmode=require') ||
      connectionString.includes('ssl=true');

    this.pool = new Pool({
      connectionString,
      // Pool configuration for production
      max: 20, // Maximum pool size
      min: 2, // Minimum pool size
      idleTimeoutMillis: 30000, // Close idle clients after 30s
      connectionTimeoutMillis: 10000, // Connection timeout 10s
      ...(useSSL && {
        ssl: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      }),
    });

    this.pool.on('error', (err) => {
      this.logger.error(`PostgreSQL pool error: ${err.message}`);
      this.connected = false;
    });

    this.pool.on('connect', () => {
      this.connected = true;
    });

    this.connected = true;
    return this.pool;
  }

  getChatwootConnection() {
    const uri =
      configService.get<Chatwoot>('CHATWOOT').IMPORT.DATABASE.CONNECTION.URI;

    return this.getConnection(uri);
  }
}

export const postgresClient = new Postgres();
