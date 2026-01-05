import { Constructor } from '@api/integrations/integration.dto';
import { JsonValue } from '@prisma/client/runtime/library';

export class EventDto {
  webhook?: {
    enabled?: boolean;
    events?: string[];
    url?: string;
    headers?: JsonValue;
    byEvents?: boolean;
    base64?: boolean;
  };
}

export function EventInstanceMixin<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    webhook?: {
      enabled?: boolean;
      events?: string[];
      headers?: JsonValue;
      url?: string;
      byEvents?: boolean;
      base64?: boolean;
    };
  };
}
