import { InstanceDto, SetPresenceDto } from '@api/dto/instance.dto';
import { ChatwootService } from '@api/integrations/chatbot/chatwoot/services/chatwoot.service';
import { ProviderFiles } from '@api/provider/sessions';
import { PrismaRepository } from '@api/repository/repository.service';
import { channelController, eventManager } from '@api/server.module';
import { CacheService } from '@api/services/cache.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { SettingsService } from '@api/services/settings.service';
import { Events, Integration, wa } from '@api/types/wa.types';
import {
  Auth,
  Chatwoot,
  ConfigService,
  HttpServer,
  WaBusiness,
} from '@config/env.config';
import { Logger } from '@config/logger.config';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@exceptions';
import { delay } from 'baileys';
import { isArray, isURL } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import EventEmitter2 from 'eventemitter2';
import { v4 } from 'uuid';

import { ProxyController } from './proxy.controller';

// Timing-safe string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  // Validate inputs to prevent null/undefined issues
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    // For different lengths, we need to use a dummy comparison to prevent timing attacks
    if (bufA.length !== bufB.length) {
      // Create a buffer of same length as a, filled with zeros for timing-safe comparison
      const dummyBuffer = Buffer.alloc(bufA.length, 0);
      timingSafeEqual(bufA, dummyBuffer);
      return false;
    }

    return timingSafeEqual(bufA, bufB);
  } catch (error) {
    // Log error securely without exposing sensitive data
    console.warn(
      'Timing-safe comparison failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  }
}

export class InstanceController {
  constructor(
    private readonly waMonitor: WAMonitoringService,
    private readonly configService: ConfigService,
    private readonly prismaRepository: PrismaRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly chatwootService: ChatwootService,
    private readonly settingsService: SettingsService,
    private readonly proxyService: ProxyController,
    private readonly cache: CacheService,
    private readonly chatwootCache: CacheService,
    private readonly baileysCache: CacheService,
    private readonly providerFiles: ProviderFiles
  ) {}

  private readonly logger = new Logger('InstanceController');

  // Instance-level locks to prevent race conditions
  private readonly instanceLocks = new Map<string, Promise<void>>();
  private readonly lockTimeouts = new Map<string, NodeJS.Timeout>();

  // Helper method to acquire instance lock with timeout
  private async acquireInstanceLock(
    instanceName: string,
    timeoutMs: number = 30000
  ): Promise<() => void> {
    const lockKey = `instance_${instanceName}`;

    // Check if lock already exists
    if (this.instanceLocks.has(lockKey)) {
      // Wait for existing lock to be released
      await this.instanceLocks.get(lockKey);
    }

    const lockPromise = new Promise<void>((resolve) => {
      // Store resolve function for timeout cleanup
      this.lockTimeouts.set(
        lockKey,
        setTimeout(() => {
          this.logger.warn(
            `Instance lock timeout for ${instanceName}, releasing lock`
          );
          this.releaseInstanceLock(instanceName);
          resolve();
        }, timeoutMs)
      );
    });

    this.instanceLocks.set(lockKey, lockPromise);

    // Set timeout to prevent deadlocks
    const timeoutHandle = setTimeout(() => {
      this.logger.warn(
        `Instance lock timeout for ${instanceName}, releasing lock`
      );
      this.releaseInstanceLock(instanceName);
    }, timeoutMs);

    this.lockTimeouts.set(lockKey, timeoutHandle);

    return () => this.releaseInstanceLock(instanceName);
  }

  private releaseInstanceLock(instanceName: string): void {
    const lockKey = `instance_${instanceName}`;

    // Clear timeout
    const timeoutHandle = this.lockTimeouts.get(lockKey);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.lockTimeouts.delete(lockKey);
    }

    // Resolve and remove lock
    const lockPromise = this.instanceLocks.get(lockKey);
    if (lockPromise) {
      (lockPromise as any)(); // Resolve the promise
      this.instanceLocks.delete(lockKey);
    }
  }

  public async createInstance(instanceData: InstanceDto) {
    // Validate input parameters
    if (!instanceData || typeof instanceData !== 'object') {
      throw new BadRequestException('Instance data is required');
    }

    if (
      !instanceData.instanceName ||
      typeof instanceData.instanceName !== 'string' ||
      instanceData.instanceName.trim().length === 0
    ) {
      throw new BadRequestException('Valid instanceName is required');
    }

    if (
      !instanceData.integration ||
      typeof instanceData.integration !== 'string'
    ) {
      throw new BadRequestException('Valid integration type is required');
    }

    // Acquire lock to prevent race conditions
    const releaseLock = await this.acquireInstanceLock(
      instanceData.instanceName
    );

    try {
      const instance = channelController.init(instanceData, {
        configService: this.configService,
        eventEmitter: this.eventEmitter,
        prismaRepository: this.prismaRepository,
        cache: this.cache,
        chatwootCache: this.chatwootCache,
        baileysCache: this.baileysCache,
        providerFiles: this.providerFiles,
      });

      if (!instance) {
        throw new BadRequestException('Invalid integration type specified');
      }

      const instanceId = v4();
      instanceData.instanceId = instanceId;

      // Generate secure token if not provided
      let hash: string;
      if (
        !instanceData.token ||
        typeof instanceData.token !== 'string' ||
        instanceData.token.trim().length === 0
      ) {
        hash = v4().toUpperCase();
      } else {
        // Validate provided token
        if (instanceData.token.length < 8) {
          throw new BadRequestException(
            'Token must be at least 8 characters long'
          );
        }
        hash = instanceData.token.trim();
      }

      await this.waMonitor.saveInstance({
        instanceId,
        integration: instanceData.integration,
        instanceName: instanceData.instanceName,
        ownerJid: instanceData.ownerJid,
        profileName: instanceData.profileName,
        profilePicUrl: instanceData.profilePicUrl,
        hash,
        number: instanceData.number,
        businessId: instanceData.businessId,
        status: instanceData.status,
      });

      instance.setInstance({
        instanceName: instanceData.instanceName,
        instanceId,
        integration: instanceData.integration,
        token: hash,
        number: instanceData.number,
        businessId: instanceData.businessId,
      });

      // Thread-safe assignment with validation
      this.waMonitor.waInstances[instance.instanceName] = instance;
      this.waMonitor.delInstanceTime(instance.instanceName);

      // Set up events safely
      try {
        await eventManager.setInstance(instance.instanceName, instanceData);
      } catch (eventError) {
        this.logger.error(
          `Failed to set events for instance ${instance.instanceName}:`,
          eventError
        );
        // Continue with creation even if event setup fails
      }

      // Send webhook notification safely
      try {
        instance.sendDataWebhook(Events.INSTANCE_CREATE, {
          instanceName: instanceData.instanceName,
          instanceId: instanceId,
        });
      } catch (webhookError) {
        this.logger.error(
          `Failed to send create webhook for ${instance.instanceName}:`,
          webhookError
        );
        // Don't fail creation if webhook fails
      }

      const instanceDto: InstanceDto = {
        instanceName: instance.instanceName,
        instanceId: instance.instanceId,
        connectionStatus:
          typeof instance.connectionStatus === 'string'
            ? instance.connectionStatus
            : instance.connectionStatus?.state || 'unknown',
      };

      if (
        instanceData.proxyHost &&
        instanceData.proxyPort &&
        instanceData.proxyProtocol
      ) {
        const testProxy = await this.proxyService.testProxy({
          host: instanceData.proxyHost,
          port: instanceData.proxyPort,
          protocol: instanceData.proxyProtocol,
          username: instanceData.proxyUsername,
          password: instanceData.proxyPassword,
        });
        if (!testProxy) {
          throw new BadRequestException('Invalid proxy');
        }
        await this.proxyService.createProxy(instanceDto, {
          enabled: true,
          host: instanceData.proxyHost,
          port: instanceData.proxyPort,
          protocol: instanceData.proxyProtocol,
          username: instanceData.proxyUsername,
          password: instanceData.proxyPassword,
        });
      }

      // Validate webhook URL if provided
      if (instanceData.webhook?.url) {
        if (!isURL(instanceData.webhook.url, { require_tld: false })) {
          throw new BadRequestException('Invalid webhook URL format');
        }

        try {
          const webhookUrl = new URL(instanceData.webhook.url);
          if (
            webhookUrl.protocol !== 'https:' &&
            webhookUrl.protocol !== 'http:'
          ) {
            throw new BadRequestException(
              'Webhook URL must use HTTP or HTTPS protocol'
            );
          }

          // Prevent localhost/private IP access
          const hostname = webhookUrl.hostname.toLowerCase();
          if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.')
          ) {
            throw new BadRequestException(
              'Webhook URL cannot point to local/private networks'
            );
          }
        } catch (urlError) {
          if (urlError instanceof BadRequestException) {
            throw urlError;
          }
          throw new BadRequestException('Invalid webhook URL format');
        }
      }

      // Validate webhook headers if provided
      if (instanceData.webhook?.headers) {
        if (typeof instanceData.webhook.headers !== 'object') {
          throw new BadRequestException('Webhook headers must be an object');
        }

        // Check for potentially dangerous headers
        const dangerousHeaders = [
          'host',
          'authorization',
          'cookie',
          'set-cookie',
        ];
        const headerKeys = Object.keys(instanceData.webhook.headers).map((k) =>
          k.toLowerCase()
        );

        for (const header of dangerousHeaders) {
          if (headerKeys.includes(header)) {
            throw new BadRequestException(
              `Dangerous header '${header}' not allowed in webhook configuration`
            );
          }
        }
      }

      const settings: wa.LocalSettings = {
        rejectCall: instanceData.rejectCall === true,
        msgCall: instanceData.msgCall || '',
        groupsIgnore: instanceData.groupsIgnore === true,
        alwaysOnline: instanceData.alwaysOnline === true,
        readMessages: instanceData.readMessages === true,
        readStatus: instanceData.readStatus === true,
        syncFullHistory: instanceData.syncFullHistory === true,
        wavoipToken: instanceData.wavoipToken || '',
      };

      await this.settingsService.create(instanceDto, settings);

      let webhookWaBusiness = null,
        accessTokenWaBusiness = '';

      if (instanceData.integration === Integration.WHATSAPP_BUSINESS) {
        if (!instanceData.number) {
          throw new BadRequestException('number is required');
        }
        const urlServer = this.configService.get<HttpServer>('SERVER').URL;
        webhookWaBusiness = `${urlServer}/webhook/meta`;
        accessTokenWaBusiness =
          this.configService.get<WaBusiness>('WA_BUSINESS').TOKEN_WEBHOOK;
      }

      if (
        !instanceData.chatwootAccountId ||
        !instanceData.chatwootToken ||
        !instanceData.chatwootUrl
      ) {
        let getQrcode: wa.QrCode;

        if (
          instanceData.qrcode &&
          instanceData.integration === Integration.WHATSAPP_BAILEYS
        ) {
          await instance.connectToWhatsapp(instanceData.number);
          await delay(5000);
          getQrcode = instance.qrCode;
        }

        const result = {
          instance: {
            instanceName: instance.instanceName,
            instanceId: instanceId,
            integration: instanceData.integration,
            webhookWaBusiness,
            accessTokenWaBusiness,
            status:
              typeof instance.connectionStatus === 'string'
                ? instance.connectionStatus
                : instance.connectionStatus?.state || 'unknown',
          },
          hash,
          webhook: {
            webhookUrl: instanceData?.webhook?.url,
            webhookHeaders: instanceData?.webhook?.headers,
            webhookByEvents: instanceData?.webhook?.byEvents,
            webhookBase64: instanceData?.webhook?.base64,
          },
          settings,
          qrcode: getQrcode,
        };

        return result;
      }

      if (!this.configService.get<Chatwoot>('CHATWOOT').ENABLED)
        throw new BadRequestException('Chatwoot is not enabled');

      if (!instanceData.chatwootAccountId) {
        throw new BadRequestException('accountId is required');
      }

      if (!instanceData.chatwootToken) {
        throw new BadRequestException('token is required');
      }

      if (!instanceData.chatwootUrl) {
        throw new BadRequestException('Chatwoot URL is required');
      }

      // Validate and sanitize URL
      if (!isURL(instanceData.chatwootUrl, { require_tld: false })) {
        throw new BadRequestException('Invalid Chatwoot URL format');
      }

      // Additional URL validation - prevent SSRF and ensure HTTPS in production
      try {
        const url = new URL(instanceData.chatwootUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new BadRequestException(
            'Chatwoot URL must use HTTP or HTTPS protocol'
          );
        }

        // Prevent localhost/private IP access for security
        const hostname = url.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          throw new BadRequestException(
            'Chatwoot URL cannot point to local/private networks'
          );
        }
      } catch (urlError) {
        if (urlError instanceof BadRequestException) {
          throw urlError;
        }
        throw new BadRequestException('Invalid Chatwoot URL format');
      }

      if (
        instanceData.chatwootSignMsg !== true &&
        instanceData.chatwootSignMsg !== false
      ) {
        throw new BadRequestException('signMsg is required');
      }

      if (
        instanceData.chatwootReopenConversation !== true &&
        instanceData.chatwootReopenConversation !== false
      ) {
        throw new BadRequestException('reopenConversation is required');
      }

      if (
        instanceData.chatwootConversationPending !== true &&
        instanceData.chatwootConversationPending !== false
      ) {
        throw new BadRequestException('conversationPending is required');
      }

      const urlServer = this.configService.get<HttpServer>('SERVER').URL;

      try {
        this.chatwootService.create(instanceDto, {
          enabled: true,
          accountId: instanceData.chatwootAccountId,
          token: instanceData.chatwootToken,
          url: instanceData.chatwootUrl,
          signMsg: instanceData.chatwootSignMsg || false,
          nameInbox:
            instanceData.chatwootNameInbox ??
            instance.instanceName.split('-cwId-')[0],
          number: instanceData.number,
          reopenConversation: instanceData.chatwootReopenConversation || false,
          conversationPending:
            instanceData.chatwootConversationPending || false,
          importContacts: instanceData.chatwootImportContacts ?? true,
          mergeBrazilContacts:
            instanceData.chatwootMergeBrazilContacts ?? false,
          importMessages: instanceData.chatwootImportMessages ?? true,
          daysLimitImportMessages:
            instanceData.chatwootDaysLimitImportMessages ?? 60,
          organization: instanceData.chatwootOrganization,
          logo: instanceData.chatwootLogo,
          autoCreate: instanceData.chatwootAutoCreate !== false,
        });
      } catch (error) {
        this.logger.log(error);
      }

      return {
        instance: {
          instanceName: instance.instanceName,
          instanceId: instanceId,
          integration: instanceData.integration,
          webhookWaBusiness,
          accessTokenWaBusiness,
          status:
            typeof instance.connectionStatus === 'string'
              ? instance.connectionStatus
              : instance.connectionStatus?.state || 'unknown',
        },
        hash,
        webhook: {
          webhookUrl: instanceData?.webhook?.url,
          webhookHeaders: instanceData?.webhook?.headers,
          webhookByEvents: instanceData?.webhook?.byEvents,
          webhookBase64: instanceData?.webhook?.base64,
        },
        settings,
        chatwoot: {
          enabled: true,
          accountId: instanceData.chatwootAccountId,
          token: instanceData.chatwootToken,
          url: instanceData.chatwootUrl,
          signMsg: instanceData.chatwootSignMsg || false,
          reopenConversation: instanceData.chatwootReopenConversation || false,
          conversationPending:
            instanceData.chatwootConversationPending || false,
          mergeBrazilContacts:
            instanceData.chatwootMergeBrazilContacts ?? false,
          importContacts: instanceData.chatwootImportContacts ?? true,
          importMessages: instanceData.chatwootImportMessages ?? true,
          daysLimitImportMessages:
            instanceData.chatwootDaysLimitImportMessages || 60,
          number: instanceData.number,
          nameInbox: instanceData.chatwootNameInbox ?? instance.instanceName,
          webhookUrl: `${urlServer}/chatwoot/webhook/${encodeURIComponent(instance.instanceName)}`,
        },
      };
    } catch (error: unknown) {
      try {
        this.waMonitor.deleteInstance(instanceData.instanceName);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to cleanup instance ${instanceData.instanceName} after error:`,
          cleanupError
        );
      }

      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? error.message
          : 'Unknown error';
      const message = isArray(errorMessage)
        ? errorMessage[0]
        : String(errorMessage);
      this.logger.error(
        `Create instance error for ${instanceData.instanceName}: ${message}`
      );
      throw new BadRequestException(message);
    } finally {
      // Ensure lock is always released
      releaseLock();
    }
  }

  public async connectToWhatsapp({ instanceName, number = null }: InstanceDto) {
    // Validate input parameters
    if (
      !instanceName ||
      typeof instanceName !== 'string' ||
      instanceName.trim().length === 0
    ) {
      throw new BadRequestException('Invalid instanceName provided');
    }

    // Acquire lock to prevent concurrent connection attempts
    const releaseLock = await this.acquireInstanceLock(instanceName);

    try {
      const instance = this.waMonitor.waInstances[instanceName];

      // Check if instance exists with proper validation
      if (!instance || !instance.connectionStatus) {
        throw new BadRequestException(
          `The "${instanceName}" instance does not exist or is not properly initialized`
        );
      }

      const state = instance.connectionStatus.state;

      // Use strict equality and validate state
      if (state === 'open') {
        return await this.connectionState({ instanceName });
      }

      if (state === 'connecting') {
        return instance.qrCode;
      }

      if (state === 'close') {
        // Validate number parameter if provided
        if (number && (typeof number !== 'string' || !/^\d+$/.test(number))) {
          throw new BadRequestException('Invalid phone number format');
        }

        await instance.connectToWhatsapp(number);
        await delay(2000);

        // Re-validate instance after connection attempt
        if (!instance.qrCode) {
          throw new BadRequestException(
            'Failed to generate QR code for WhatsApp connection'
          );
        }

        return instance.qrCode;
      }

      // Handle unknown states gracefully
      this.logger.warn(
        `Unknown connection state for instance ${instanceName}: ${state}`
      );
      return {
        instance: {
          instanceName: instanceName,
          status: state || 'unknown',
        },
        qrcode: instance?.qrCode || null,
      };
    } catch (error: unknown) {
      // Log error securely without exposing sensitive data
      this.logger.error(
        `connectToWhatsapp error for ${instanceName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Return sanitized error message - don't expose internal details
      const safeMessage = 'Failed to connect to WhatsApp. Please try again.';

      return { error: true, message: safeMessage };
    } finally {
      // Ensure lock is always released
      releaseLock();
    }
  }

  public async restartInstance({ instanceName }: InstanceDto) {
    // Validate input parameters
    if (
      !instanceName ||
      typeof instanceName !== 'string' ||
      instanceName.trim().length === 0
    ) {
      throw new BadRequestException('Invalid instanceName provided');
    }

    // Acquire lock to prevent concurrent restart attempts
    const releaseLock = await this.acquireInstanceLock(instanceName);

    try {
      const instance = this.waMonitor.waInstances[instanceName];

      // Check if instance exists with proper validation
      if (!instance || !instance.connectionStatus) {
        throw new BadRequestException(
          `The "${instanceName}" instance does not exist or is not properly initialized`
        );
      }

      const state = instance.connectionStatus.state;

      // Validate that instance is not closed
      if (state === 'close') {
        throw new BadRequestException(
          `The "${instanceName}" instance is not connected`
        );
      }

      this.logger.info(`Restarting instance: ${instanceName}`);

      // Primary restart method if available
      if (typeof instance.restart === 'function') {
        await instance.restart();
        // Wait for reconnection with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Restart timeout'));
          }, 10000); // 10 second timeout

          // Check connection status periodically
          const checkConnection = () => {
            if (instance.connectionStatus?.state === 'open') {
              clearTimeout(timeout);
              resolve(void 0);
            } else if (instance.connectionStatus?.state === 'close') {
              clearTimeout(timeout);
              reject(new Error('Connection closed during restart'));
            } else {
              setTimeout(checkConnection, 500);
            }
          };

          setTimeout(checkConnection, 2000);
        });

        return {
          instance: {
            instanceName: instanceName,
            status: instance.connectionStatus?.state || 'connecting',
          },
        };
      }

      // Fallback for Baileys (uses different mechanism)
      if (state === 'open' || state === 'connecting') {
        try {
          if (
            this.configService.get<Chatwoot>('CHATWOOT').ENABLED &&
            typeof instance.clearCacheChatwoot === 'function'
          ) {
            instance.clearCacheChatwoot();
          }

          // Close connections safely with error handling
          if (instance.client?.ws) {
            await Promise.race([
              new Promise<void>((resolve) => {
                instance.client.ws.close();
                resolve();
              }),
              new Promise<void>((_, reject) =>
                setTimeout(
                  () => reject(new Error('WebSocket close timeout')),
                  5000
                )
              ),
            ]);
          }

          if (instance.client?.end) {
            instance.client.end(new Error('restart'));
          }

          return await this.connectToWhatsapp({ instanceName });
        } catch (fallbackError) {
          this.logger.error(
            `Fallback restart failed for ${instanceName}:`,
            fallbackError
          );
          throw new InternalServerErrorException(
            'Failed to restart instance using fallback method'
          );
        }
      }

      // Handle unexpected states
      this.logger.warn(
        `Unexpected state for restart: ${state} on instance ${instanceName}`
      );
      return {
        instance: {
          instanceName: instanceName,
          status: state,
        },
      };
    } catch (error: unknown) {
      // Log error securely without exposing sensitive data
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `restartInstance error for ${instanceName}: ${errorMessage}`
      );

      // Return sanitized error message - don't expose internal details
      const safeMessage = 'Failed to restart instance. Please try again.';

      return { error: true, message: safeMessage };
    } finally {
      // Ensure lock is always released
      releaseLock();
    }
  }

  public async connectionState({ instanceName }: InstanceDto) {
    // Validate input parameters
    if (
      !instanceName ||
      typeof instanceName !== 'string' ||
      instanceName.trim().length === 0
    ) {
      throw new BadRequestException('Invalid instanceName provided');
    }

    const instance = this.waMonitor.waInstances[instanceName];

    // Validate instance exists
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    // Safely access connection status with fallback
    const state = instance.connectionStatus?.state || 'unknown';

    return {
      instance: {
        instanceName: instanceName,
        state: state,
      },
    };
  }

  public async fetchInstances(
    { instanceName, instanceId, number }: InstanceDto,
    key: string
  ) {
    // Validate input parameters
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new BadRequestException('API key is required');
    }

    // Validate instanceName if provided
    if (
      instanceName &&
      (typeof instanceName !== 'string' || instanceName.trim().length === 0)
    ) {
      throw new BadRequestException('Invalid instanceName provided');
    }

    // Validate instanceId if provided
    if (
      instanceId &&
      (typeof instanceId !== 'string' || !/^[a-f0-9-]+$/i.test(instanceId))
    ) {
      throw new BadRequestException('Invalid instanceId format');
    }

    // Validate number if provided
    if (number && (typeof number !== 'string' || !/^\d+$/.test(number))) {
      throw new BadRequestException('Invalid phone number format');
    }

    const env = this.configService.get<Auth>('AUTHENTICATION').API_KEY;

    // Use timing-safe comparison to prevent timing attacks
    if (!safeCompare(env.KEY, key)) {
      try {
        const instancesByKey = await (
          this.prismaRepository as any
        ).instance.findMany({
          where: {
            token: key,
            ...(instanceName && { name: instanceName }),
            ...(instanceId && { id: instanceId }),
          },
        });

        if (instancesByKey.length > 0) {
          const names = instancesByKey
            .map((instance) => instance.name)
            .filter(Boolean);

          if (names.length === 0) {
            throw new NotFoundException(
              'No valid instances found for the provided key'
            );
          }

          return this.waMonitor.instanceInfo(names);
        } else {
          throw new UnauthorizedException(
            'Invalid API key or instance not found'
          );
        }
      } catch (error) {
        if (
          error instanceof UnauthorizedException ||
          error instanceof NotFoundException
        ) {
          throw error;
        }
        this.logger.error('Database error in fetchInstances:', error);
        throw new InternalServerErrorException('Failed to fetch instances');
      }
    }

    // Admin access with master key
    try {
      if (instanceId || number) {
        return this.waMonitor.instanceInfoById(instanceId, number);
      }

      const instanceNames = instanceName ? [instanceName] : null;
      return this.waMonitor.instanceInfo(instanceNames);
    } catch (error) {
      this.logger.error('Error fetching instances with admin key:', error);
      throw new InternalServerErrorException('Failed to fetch instances');
    }
  }

  public async setPresence(
    { instanceName }: InstanceDto,
    data: SetPresenceDto
  ) {
    // Validate input parameters
    if (
      !instanceName ||
      typeof instanceName !== 'string' ||
      instanceName.trim().length === 0
    ) {
      throw new BadRequestException('Invalid instanceName provided');
    }

    // Validate presence data
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Presence data is required');
    }

    const instance = this.waMonitor.waInstances[instanceName];

    // Check if instance exists and is connected
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    if (
      !instance.connectionStatus ||
      instance.connectionStatus.state !== 'open'
    ) {
      throw new BadRequestException(
        `Instance "${instanceName}" is not connected`
      );
    }

    // Validate presence method exists
    if (typeof instance.setPresence !== 'function') {
      throw new InternalServerErrorException(
        'Presence functionality not available for this instance'
      );
    }

    try {
      return await instance.setPresence(data);
    } catch (error) {
      this.logger.error(`Failed to set presence for ${instanceName}:`, error);
      throw new InternalServerErrorException('Failed to update presence');
    }
  }

  public async logout({ instanceName }: InstanceDto) {
    // Validate input parameters
    if (
      !instanceName ||
      typeof instanceName !== 'string' ||
      instanceName.trim().length === 0
    ) {
      throw new BadRequestException('Invalid instanceName provided');
    }

    // Acquire lock to prevent concurrent logout operations
    const releaseLock = await this.acquireInstanceLock(instanceName);

    try {
      const { instance } = await this.connectionState({ instanceName });

      if (instance.state === 'close') {
        throw new BadRequestException(
          `The "${instanceName}" instance is not connected`
        );
      }

      const waInstance = this.waMonitor.waInstances[instanceName];

      // Additional validation
      if (!waInstance) {
        throw new NotFoundException(`Instance "${instanceName}" not found`);
      }

      try {
        // Validate logout method exists
        if (typeof waInstance.logoutInstance !== 'function') {
          throw new InternalServerErrorException(
            'Logout functionality not available for this instance'
          );
        }

        await waInstance.logoutInstance();

        return {
          status: 'SUCCESS',
          error: false,
          response: { message: 'Instance logged out successfully' },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Logout error for ${instanceName}: ${errorMessage}`);

        if (error instanceof InternalServerErrorException) {
          throw error;
        }

        throw new InternalServerErrorException('Failed to logout instance');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Logout error for ${instanceName}: ${errorMessage}`);

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to logout instance');
    } finally {
      // Ensure lock is always released
      releaseLock();
    }
  }

  public async deleteInstance({ instanceName }: InstanceDto) {
    // Validate input parameters
    if (
      !instanceName ||
      typeof instanceName !== 'string' ||
      instanceName.trim().length === 0
    ) {
      throw new BadRequestException('Invalid instanceName provided');
    }

    // Acquire lock to prevent concurrent deletion operations
    const releaseLock = await this.acquireInstanceLock(instanceName);

    try {
      const { instance } = await this.connectionState({ instanceName });

      try {
        const waInstances = this.waMonitor.waInstances[instanceName];

        // Additional validation
        if (!waInstances) {
          throw new NotFoundException(`Instance "${instanceName}" not found`);
        }

        // Clear Chatwoot cache safely
        if (
          this.configService.get<Chatwoot>('CHATWOOT').ENABLED &&
          typeof waInstances.clearCacheChatwoot === 'function'
        ) {
          try {
            waInstances.clearCacheChatwoot();
          } catch (cacheError) {
            this.logger.warn(
              `Failed to clear Chatwoot cache for ${instanceName}:`,
              cacheError
            );
            // Continue with deletion even if cache clear fails
          }
        }

        // Logout if instance is connected
        if (instance.state === 'connecting' || instance.state === 'open') {
          try {
            await this.logout({ instanceName });
          } catch (logoutError) {
            this.logger.warn(
              `Failed to logout instance ${instanceName} during deletion:`,
              logoutError
            );
            // Continue with deletion even if logout fails
          }
        }

        // Send webhook notification safely
        try {
          if (typeof waInstances.sendDataWebhook === 'function') {
            await waInstances.sendDataWebhook(Events.INSTANCE_DELETE, {
              instanceName,
              instanceId: waInstances.instanceId,
            });
          }
        } catch (webhookError) {
          this.logger.error(
            `Failed to send delete webhook for ${instanceName}:`,
            webhookError
          );
          // Don't fail the deletion if webhook fails
        }

        // Emit removal event
        this.eventEmitter.emit('remove.instance', instanceName, 'inner');

        return {
          status: 'SUCCESS',
          error: false,
          response: { message: 'Instance deleted successfully' },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Delete instance error for ${instanceName}: ${errorMessage}`
        );

        if (
          error instanceof NotFoundException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }

        throw new InternalServerErrorException('Failed to delete instance');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Delete instance error for ${instanceName}: ${errorMessage}`
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete instance');
    } finally {
      // Ensure lock is always released
      releaseLock();
    }
  }
}
