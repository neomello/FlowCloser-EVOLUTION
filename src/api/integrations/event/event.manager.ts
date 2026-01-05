import { WebhookController } from '@api/integrations/event/webhook/webhook.controller';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Server } from 'http';

export class EventManager {
  private prismaRepository: PrismaRepository;
  private waMonitor: WAMonitoringService;
  private webhookController: WebhookController;

  constructor(prismaRepository: PrismaRepository, waMonitor: WAMonitoringService) {
    this.prisma = prismaRepository;
    this.monitor = waMonitor;

    this.webhook = new WebhookController(prismaRepository, waMonitor);
  }

  public set prisma(prisma: PrismaRepository) {
    this.prismaRepository = prisma;
  }

  public get prisma() {
    return this.prismaRepository;
  }

  public set monitor(waMonitor: WAMonitoringService) {
    this.waMonitor = waMonitor;
  }

  public get monitor() {
    return this.waMonitor;
  }

  public set webhook(webhook: WebhookController) {
    this.webhookController = webhook;
  }

  public get webhook() {
    return this.webhookController;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public init(_httpServer: Server): void {
    // Webhook doesn't need initialization
  }

  public async emit(eventData: {
    instanceName: string;
    origin: string;
    event: string;
    data: object;
    serverUrl: string;
    dateTime: string;
    sender: string;
    apiKey?: string;
    local?: boolean;
    integration?: string[];
    extra?: Record<string, any>;
  }): Promise<void> {
    await this.webhook.emit(eventData);
  }

  public async setInstance(instanceName: string, data: any): Promise<any> {
    if (data.webhook) {
      await this.webhook.set(instanceName, {
        webhook: {
          enabled: true,
          events: data.webhook?.events,
          url: data.webhook?.url,
          headers: data.webhook?.headers,
          base64: data.webhook?.base64,
          byEvents: data.webhook?.byEvents,
        },
      });
    }
  }
}
