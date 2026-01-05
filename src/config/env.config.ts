import { isBooleanString } from 'class-validator';
import dotenv from 'dotenv';

dotenv.config();

export type HttpServer = {
  NAME: string;
  TYPE: 'http' | 'https';
  PORT: number;
  URL: string;
  DISABLE_DOCS: boolean;
  DISABLE_MANAGER: boolean;
};

export type HttpMethods = 'POST' | 'GET' | 'PUT' | 'DELETE';
export type Cors = {
  ORIGIN: string[];
  METHODS: HttpMethods[];
  CREDENTIALS: boolean;
};

export type LogBaileys =
  | 'fatal'
  | 'error'
  | 'warn'
  | 'info'
  | 'debug'
  | 'trace';

export type LogLevel =
  | 'ERROR'
  | 'WARN'
  | 'DEBUG'
  | 'INFO'
  | 'LOG'
  | 'VERBOSE'
  | 'DARK'
  | 'WEBHOOKS'
  | 'WEBSOCKET';

export type Log = {
  LEVEL: LogLevel[];
  COLOR: boolean;
  BAILEYS: LogBaileys;
};

export type ProviderSession = {
  ENABLED: boolean;
  HOST: string;
  PORT: string;
  PREFIX: string;
};

export type SaveData = {
  INSTANCE: boolean;
  HISTORIC: boolean;
  NEW_MESSAGE: boolean;
  MESSAGE_UPDATE: boolean;
  CONTACTS: boolean;
  CHATS: boolean;
  LABELS: boolean;
  IS_ON_WHATSAPP: boolean;
  IS_ON_WHATSAPP_DAYS: number;
};

export type DBConnection = {
  URI: string;
  CLIENT_NAME: string;
};
export type Database = {
  CONNECTION: DBConnection;
  PROVIDER: string;
  SAVE_DATA: SaveData;
  DELETE_DATA: DeleteData;
};

export type DeleteData = {
  LOGICAL_MESSAGE_DELETE: boolean;
};

export type WaBusiness = {
  TOKEN_WEBHOOK: string;
  URL: string;
  VERSION: string;
  LANGUAGE: string;
};

export type EventsWebhook = {
  APPLICATION_STARTUP: boolean;
  INSTANCE_CREATE: boolean;
  INSTANCE_DELETE: boolean;
  QRCODE_UPDATED: boolean;
  MESSAGES_SET: boolean;
  MESSAGES_UPSERT: boolean;
  MESSAGES_EDITED: boolean;
  MESSAGES_UPDATE: boolean;
  MESSAGES_DELETE: boolean;
  SEND_MESSAGE: boolean;
  SEND_MESSAGE_UPDATE: boolean;
  CONTACTS_SET: boolean;
  CONTACTS_UPDATE: boolean;
  CONTACTS_UPSERT: boolean;
  PRESENCE_UPDATE: boolean;
  CHATS_SET: boolean;
  CHATS_UPDATE: boolean;
  CHATS_DELETE: boolean;
  CHATS_UPSERT: boolean;
  CONNECTION_UPDATE: boolean;
  LABELS_EDIT: boolean;
  LABELS_ASSOCIATION: boolean;
  GROUPS_UPSERT: boolean;
  GROUP_UPDATE: boolean;
  GROUP_PARTICIPANTS_UPDATE: boolean;
  CALL: boolean;
  TYPEBOT_START: boolean;
  TYPEBOT_CHANGE_STATUS: boolean;
  ERRORS: boolean;
  ERRORS_WEBHOOK: string;
};

export type ApiKey = { KEY: string };

export type Auth = {
  API_KEY: ApiKey;
  EXPOSE_IN_FETCH_INSTANCES: boolean;
};

export type DelInstance = number | boolean;

export type Language = string | 'en';

export type GlobalWebhook = {
  URL: string;
  ENABLED: boolean;
  WEBHOOK_BY_EVENTS: boolean;
};

export type CacheConfRedis = {
  ENABLED: boolean;
  URI: string;
  PREFIX_KEY: string;
  TTL: number;
  SAVE_INSTANCES: boolean;
};
export type CacheConfLocal = {
  ENABLED: boolean;
  TTL: number;
};
export type SslConf = { PRIVKEY: string; FULLCHAIN: string };
export type Webhook = {
  GLOBAL?: GlobalWebhook;
  EVENTS: EventsWebhook;
  REQUEST?: {
    TIMEOUT_MS?: number;
  };
  RETRY?: {
    MAX_ATTEMPTS?: number;
    INITIAL_DELAY_SECONDS?: number;
    USE_EXPONENTIAL_BACKOFF?: boolean;
    MAX_DELAY_SECONDS?: number;
    JITTER_FACTOR?: number;
    NON_RETRYABLE_STATUS_CODES?: number[];
  };
};
export type ConfigSessionPhone = { CLIENT: string; NAME: string };
export type QrCode = { LIMIT: number; COLOR: string };
export type Typebot = {
  ENABLED: boolean;
  API_VERSION: string;
  SEND_MEDIA_BASE64: boolean;
};
export type Chatwoot = {
  ENABLED: boolean;
  MESSAGE_DELETE: boolean;
  MESSAGE_READ: boolean;
  BOT_CONTACT: boolean;
  IMPORT: {
    DATABASE: {
      CONNECTION: {
        URI: string;
      };
    };
    PLACEHOLDER_MEDIA_MESSAGE: boolean;
  };
};
export type Openai = { ENABLED: boolean; API_KEY_GLOBAL?: string };
export type Dify = { ENABLED: boolean };
export type N8n = { ENABLED: boolean };
export type Evoai = { ENABLED: boolean };
export type Flowise = { ENABLED: boolean };

export type CacheConf = { REDIS: CacheConfRedis; LOCAL: CacheConfLocal };
export type Metrics = {
  ENABLED: boolean;
  AUTH_REQUIRED: boolean;
  USER?: string;
  PASSWORD?: string;
  ALLOWED_IPS?: string;
};

export type Telemetry = {
  ENABLED: boolean;
  URL?: string;
};

export type Proxy = {
  HOST?: string;
  PORT?: string;
  PROTOCOL?: string;
  USERNAME?: string;
  PASSWORD?: string;
};

export type AudioConverter = {
  API_URL?: string;
  API_KEY?: string;
};

export type Facebook = {
  APP_ID?: string;
  CONFIG_ID?: string;
  USER_TOKEN?: string;
};

export type Sentry = {
  DSN?: string;
};

export type EventEmitter = {
  MAX_LISTENERS: number;
};

export type Production = boolean;

export interface Env {
  SERVER: HttpServer;
  CORS: Cors;
  SSL_CONF: SslConf;
  PROVIDER: ProviderSession;
  DATABASE: Database;
  WA_BUSINESS: WaBusiness;
  LOG: Log;
  DEL_INSTANCE: DelInstance;
  DEL_TEMP_INSTANCES: boolean;
  LANGUAGE: Language;
  WEBHOOK: Webhook;
  CONFIG_SESSION_PHONE: ConfigSessionPhone;
  QRCODE: QrCode;
  TYPEBOT: Typebot;
  CHATWOOT: Chatwoot;
  OPENAI: Openai;
  DIFY: Dify;
  N8N: N8n;
  EVOAI: Evoai;
  FLOWISE: Flowise;
  CACHE: CacheConf;
  AUTHENTICATION: Auth;
  METRICS: Metrics;
  TELEMETRY: Telemetry;
  PROXY: Proxy;
  AUDIO_CONVERTER: AudioConverter;
  FACEBOOK: Facebook;
  SENTRY: Sentry;
  EVENT_EMITTER: EventEmitter;
  PRODUCTION?: Production;
}

export type Key = keyof Env;

export class ConfigService {
  constructor() {
    this.loadEnv();
  }

  private env: Env;

  public get<T = any>(key: Key) {
    return this.env[key] as T;
  }

  private loadEnv() {
    this.env = this.envProcess();
    this.env.PRODUCTION = process.env?.NODE_ENV === 'PROD';
    if (process.env?.DOCKER_ENV === 'true') {
      this.env.SERVER.TYPE = process.env.SERVER_TYPE as 'http' | 'http';
      this.env.SERVER.PORT = Number.parseInt(process.env.SERVER_PORT) || 8080;
    }
  }

  private envProcess(): Env {
    return {
      SERVER: {
        NAME: process.env?.SERVER_NAME || 'evolution',
        TYPE: (process.env.SERVER_TYPE as 'http' | 'https') || 'http',
        PORT: Number.parseInt(process.env.SERVER_PORT) || 8080,
        URL: process.env.SERVER_URL,
        DISABLE_DOCS: process.env?.SERVER_DISABLE_DOCS === 'true',
        DISABLE_MANAGER: process.env?.SERVER_DISABLE_MANAGER === 'true',
      },
      CORS: {
        ORIGIN: process.env.CORS_ORIGIN?.split(',') || ['*'],
        METHODS:
          (process.env.CORS_METHODS?.split(',') as HttpMethods[]) ||
          (['POST', 'GET', 'PUT', 'DELETE'] as HttpMethods[]),
        CREDENTIALS: process.env?.CORS_CREDENTIALS === 'true',
      },
      SSL_CONF: {
        PRIVKEY: process.env?.SSL_CONF_PRIVKEY || '',
        FULLCHAIN: process.env?.SSL_CONF_FULLCHAIN || '',
      },
      PROVIDER: {
        ENABLED: process.env?.PROVIDER_ENABLED === 'true',
        HOST: process.env.PROVIDER_HOST,
        PORT: process.env?.PROVIDER_PORT || '5656',
        PREFIX: process.env?.PROVIDER_PREFIX || 'evolution',
      },
      DATABASE: {
        CONNECTION: {
          URI: process.env.DATABASE_CONNECTION_URI || '',
          CLIENT_NAME:
            process.env.DATABASE_CONNECTION_CLIENT_NAME || 'evolution',
        },
        PROVIDER: process.env.DATABASE_PROVIDER || 'postgresql',
        SAVE_DATA: {
          INSTANCE: process.env?.DATABASE_SAVE_DATA_INSTANCE === 'true',
          NEW_MESSAGE: process.env?.DATABASE_SAVE_DATA_NEW_MESSAGE === 'true',
          MESSAGE_UPDATE: process.env?.DATABASE_SAVE_MESSAGE_UPDATE === 'true',
          CONTACTS: process.env?.DATABASE_SAVE_DATA_CONTACTS === 'true',
          CHATS: process.env?.DATABASE_SAVE_DATA_CHATS === 'true',
          HISTORIC: process.env?.DATABASE_SAVE_DATA_HISTORIC === 'true',
          LABELS: process.env?.DATABASE_SAVE_DATA_LABELS === 'true',
          IS_ON_WHATSAPP: process.env?.DATABASE_SAVE_IS_ON_WHATSAPP === 'true',
          IS_ON_WHATSAPP_DAYS: Number.parseInt(
            process.env?.DATABASE_SAVE_IS_ON_WHATSAPP_DAYS ?? '7'
          ),
        },
        DELETE_DATA: {
          LOGICAL_MESSAGE_DELETE:
            process.env?.DATABASE_DELETE_MESSAGE === 'true',
        },
      },
      WA_BUSINESS: {
        TOKEN_WEBHOOK: process.env.WA_BUSINESS_TOKEN_WEBHOOK || 'evolution',
        URL: process.env.WA_BUSINESS_URL || 'https://graph.facebook.com',
        VERSION: process.env.WA_BUSINESS_VERSION || 'v18.0',
        LANGUAGE: process.env.WA_BUSINESS_LANGUAGE || 'en',
      },
      LOG: {
        LEVEL:
          (process.env?.LOG_LEVEL?.split(',') as LogLevel[]) ||
          ([
            'ERROR',
            'WARN',
            'DEBUG',
            'INFO',
            'LOG',
            'VERBOSE',
            'DARK',
            'WEBHOOKS',
            'WEBSOCKET',
          ] as LogLevel[]),
        COLOR: process.env?.LOG_COLOR === 'true',
        BAILEYS: (process.env?.LOG_BAILEYS as LogBaileys) || 'error',
      },
      DEL_INSTANCE: isBooleanString(process.env?.DEL_INSTANCE)
        ? process.env.DEL_INSTANCE === 'true'
        : Number.parseInt(process.env.DEL_INSTANCE) || false,
      DEL_TEMP_INSTANCES: isBooleanString(process.env?.DEL_TEMP_INSTANCES)
        ? process.env.DEL_TEMP_INSTANCES === 'true'
        : true,
      LANGUAGE: process.env?.LANGUAGE || 'en',
      WEBHOOK: {
        GLOBAL: {
          URL: process.env?.WEBHOOK_GLOBAL_URL || '',
          ENABLED: process.env?.WEBHOOK_GLOBAL_ENABLED === 'true',
          WEBHOOK_BY_EVENTS:
            process.env?.WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS === 'true',
        },
        EVENTS: {
          APPLICATION_STARTUP:
            process.env?.WEBHOOK_EVENTS_APPLICATION_STARTUP === 'true',
          INSTANCE_CREATE:
            process.env?.WEBHOOK_EVENTS_INSTANCE_CREATE === 'true',
          INSTANCE_DELETE:
            process.env?.WEBHOOK_EVENTS_INSTANCE_DELETE === 'true',
          QRCODE_UPDATED: process.env?.WEBHOOK_EVENTS_QRCODE_UPDATED === 'true',
          MESSAGES_SET: process.env?.WEBHOOK_EVENTS_MESSAGES_SET === 'true',
          MESSAGES_UPSERT:
            process.env?.WEBHOOK_EVENTS_MESSAGES_UPSERT === 'true',
          MESSAGES_EDITED:
            process.env?.WEBHOOK_EVENTS_MESSAGES_EDITED === 'true',
          MESSAGES_UPDATE:
            process.env?.WEBHOOK_EVENTS_MESSAGES_UPDATE === 'true',
          MESSAGES_DELETE:
            process.env?.WEBHOOK_EVENTS_MESSAGES_DELETE === 'true',
          SEND_MESSAGE: process.env?.WEBHOOK_EVENTS_SEND_MESSAGE === 'true',
          SEND_MESSAGE_UPDATE:
            process.env?.WEBHOOK_EVENTS_SEND_MESSAGE_UPDATE === 'true',
          CONTACTS_SET: process.env?.WEBHOOK_EVENTS_CONTACTS_SET === 'true',
          CONTACTS_UPDATE:
            process.env?.WEBHOOK_EVENTS_CONTACTS_UPDATE === 'true',
          CONTACTS_UPSERT:
            process.env?.WEBHOOK_EVENTS_CONTACTS_UPSERT === 'true',
          PRESENCE_UPDATE:
            process.env?.WEBHOOK_EVENTS_PRESENCE_UPDATE === 'true',
          CHATS_SET: process.env?.WEBHOOK_EVENTS_CHATS_SET === 'true',
          CHATS_UPDATE: process.env?.WEBHOOK_EVENTS_CHATS_UPDATE === 'true',
          CHATS_UPSERT: process.env?.WEBHOOK_EVENTS_CHATS_UPSERT === 'true',
          CHATS_DELETE: process.env?.WEBHOOK_EVENTS_CHATS_DELETE === 'true',
          CONNECTION_UPDATE:
            process.env?.WEBHOOK_EVENTS_CONNECTION_UPDATE === 'true',
          LABELS_EDIT: process.env?.WEBHOOK_EVENTS_LABELS_EDIT === 'true',
          LABELS_ASSOCIATION:
            process.env?.WEBHOOK_EVENTS_LABELS_ASSOCIATION === 'true',
          GROUPS_UPSERT: process.env?.WEBHOOK_EVENTS_GROUPS_UPSERT === 'true',
          GROUP_UPDATE: process.env?.WEBHOOK_EVENTS_GROUPS_UPDATE === 'true',
          GROUP_PARTICIPANTS_UPDATE:
            process.env?.WEBHOOK_EVENTS_GROUP_PARTICIPANTS_UPDATE === 'true',
          CALL: process.env?.WEBHOOK_EVENTS_CALL === 'true',
          TYPEBOT_START: process.env?.WEBHOOK_EVENTS_TYPEBOT_START === 'true',
          TYPEBOT_CHANGE_STATUS:
            process.env?.WEBHOOK_EVENTS_TYPEBOT_CHANGE_STATUS === 'true',
          ERRORS: process.env?.WEBHOOK_EVENTS_ERRORS === 'true',
          ERRORS_WEBHOOK: process.env?.WEBHOOK_EVENTS_ERRORS_WEBHOOK || '',
        },
        REQUEST: {
          TIMEOUT_MS:
            Number.parseInt(process.env?.WEBHOOK_REQUEST_TIMEOUT_MS) || 30000,
        },
        RETRY: {
          MAX_ATTEMPTS:
            Number.parseInt(process.env?.WEBHOOK_RETRY_MAX_ATTEMPTS) || 10,
          INITIAL_DELAY_SECONDS:
            Number.parseInt(process.env?.WEBHOOK_RETRY_INITIAL_DELAY_SECONDS) ||
            5,
          USE_EXPONENTIAL_BACKOFF:
            process.env?.WEBHOOK_RETRY_USE_EXPONENTIAL_BACKOFF !== 'false',
          MAX_DELAY_SECONDS:
            Number.parseInt(process.env?.WEBHOOK_RETRY_MAX_DELAY_SECONDS) ||
            300,
          JITTER_FACTOR:
            Number.parseFloat(process.env?.WEBHOOK_RETRY_JITTER_FACTOR) || 0.2,
          NON_RETRYABLE_STATUS_CODES:
            process.env?.WEBHOOK_RETRY_NON_RETRYABLE_STATUS_CODES?.split(
              ','
            ).map(Number) || [400, 401, 403, 404, 422],
        },
      },
      CONFIG_SESSION_PHONE: {
        CLIENT: process.env?.CONFIG_SESSION_PHONE_CLIENT || 'Evolution API',
        NAME: process.env?.CONFIG_SESSION_PHONE_NAME || 'Chrome',
      },
      QRCODE: {
        LIMIT: Number.parseInt(process.env.QRCODE_LIMIT) || 30,
        COLOR: process.env.QRCODE_COLOR || '#198754',
      },
      TYPEBOT: {
        ENABLED: process.env?.TYPEBOT_ENABLED === 'true',
        API_VERSION: process.env?.TYPEBOT_API_VERSION || 'old',
        SEND_MEDIA_BASE64: process.env?.TYPEBOT_SEND_MEDIA_BASE64 === 'true',
      },
      CHATWOOT: {
        ENABLED: process.env?.CHATWOOT_ENABLED === 'true',
        MESSAGE_DELETE: process.env.CHATWOOT_MESSAGE_DELETE === 'true',
        MESSAGE_READ: process.env.CHATWOOT_MESSAGE_READ === 'true',
        BOT_CONTACT:
          !process.env.CHATWOOT_BOT_CONTACT ||
          process.env.CHATWOOT_BOT_CONTACT === 'true',
        IMPORT: {
          DATABASE: {
            CONNECTION: {
              URI: process.env.CHATWOOT_IMPORT_DATABASE_CONNECTION_URI || '',
            },
          },
          PLACEHOLDER_MEDIA_MESSAGE:
            process.env?.CHATWOOT_IMPORT_PLACEHOLDER_MEDIA_MESSAGE === 'true',
        },
      },
      OPENAI: {
        ENABLED: process.env?.OPENAI_ENABLED === 'true',
        API_KEY_GLOBAL: process.env?.OPENAI_API_KEY_GLOBAL || null,
      },
      DIFY: {
        ENABLED: process.env?.DIFY_ENABLED === 'true',
      },
      N8N: {
        ENABLED: process.env?.N8N_ENABLED === 'true',
      },
      EVOAI: {
        ENABLED: process.env?.EVOAI_ENABLED === 'true',
      },
      FLOWISE: {
        ENABLED: process.env?.FLOWISE_ENABLED === 'true',
      },
      CACHE: {
        REDIS: {
          ENABLED: process.env?.CACHE_REDIS_ENABLED === 'true',
          URI: process.env?.CACHE_REDIS_URI || '',
          PREFIX_KEY: process.env?.CACHE_REDIS_PREFIX_KEY || 'evolution-cache',
          TTL: Number.parseInt(process.env?.CACHE_REDIS_TTL) || 604800,
          SAVE_INSTANCES: process.env?.CACHE_REDIS_SAVE_INSTANCES === 'true',
        },
        LOCAL: {
          ENABLED: process.env?.CACHE_LOCAL_ENABLED === 'true',
          TTL: Number.parseInt(process.env?.CACHE_REDIS_TTL) || 86400,
        },
      },
      AUTHENTICATION: {
        API_KEY: {
          KEY: (() => {
            const key = process.env.AUTHENTICATION_API_KEY;
            if (!key || key === 'BQYHJGJHJ') {
              console.error(
                '\x1b[31m[SECURITY WARNING]\x1b[0m AUTHENTICATION_API_KEY is not set or using default value! ' +
                  'Set a secure API key in environment variables.'
              );
            }
            return key || '';
          })(),
        },
        EXPOSE_IN_FETCH_INSTANCES:
          process.env?.AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES === 'true',
      },
      METRICS: {
        ENABLED: process.env?.PROMETHEUS_METRICS === 'true',
        AUTH_REQUIRED: process.env?.METRICS_AUTH_REQUIRED === 'true',
        USER: process.env?.METRICS_USER,
        PASSWORD: process.env?.METRICS_PASSWORD,
        ALLOWED_IPS: process.env?.METRICS_ALLOWED_IPS,
      },
      TELEMETRY: {
        ENABLED:
          process.env?.TELEMETRY_ENABLED === undefined ||
          process.env?.TELEMETRY_ENABLED === 'true',
        URL: process.env?.TELEMETRY_URL,
      },
      PROXY: {
        HOST: process.env?.PROXY_HOST,
        PORT: process.env?.PROXY_PORT,
        PROTOCOL: process.env?.PROXY_PROTOCOL,
        USERNAME: process.env?.PROXY_USERNAME,
        PASSWORD: process.env?.PROXY_PASSWORD,
      },
      AUDIO_CONVERTER: {
        API_URL: process.env?.API_AUDIO_CONVERTER,
        API_KEY: process.env?.API_AUDIO_CONVERTER_KEY,
      },
      FACEBOOK: {
        APP_ID: process.env?.FACEBOOK_APP_ID,
        CONFIG_ID: process.env?.FACEBOOK_CONFIG_ID,
        USER_TOKEN: process.env?.FACEBOOK_USER_TOKEN,
      },
      SENTRY: {
        DSN: process.env?.SENTRY_DSN,
      },
      EVENT_EMITTER: {
        MAX_LISTENERS:
          Number.parseInt(process.env?.EVENT_EMITTER_MAX_LISTENERS) || 50,
      },
    };
  }
}

export const configService = new ConfigService();
