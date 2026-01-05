import { InstanceDto } from '@api/dto/instance.dto';
import { prismaRepository } from '@api/server.module';
import { Auth, configService, Database } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { ForbiddenException, UnauthorizedException } from '@exceptions';
import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Prevent length-based timing attack by comparing with a buffer of same length
      const padded = Buffer.alloc(bufA.length);
      bufB.copy(padded);
      timingSafeEqual(bufA, padded);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

const logger = new Logger('GUARD');

async function apikey(req: Request, _: Response, next: NextFunction) {
  const env = configService.get<Auth>('AUTHENTICATION').API_KEY;
  const key = req.get('apikey');
  const db = configService.get<Database>('DATABASE');

  if (!key) {
    throw new UnauthorizedException();
  }

  if (safeCompare(env.KEY, key)) {
    return next();
  }

  // Rotas sensíveis exigem API key global
  if (
    req.originalUrl.includes('/instance/create') ||
    req.originalUrl.includes('/instance/fetchInstances')
  ) {
    throw new ForbiddenException(
      'Global API key required',
      'These endpoints require the global API key, not instance tokens'
    );
  }

  const param = req.params as unknown as InstanceDto;

  try {
    if (param?.instanceName) {
      const instance = await prismaRepository.instance.findUnique({
        where: { name: param.instanceName },
      });
      if (instance?.token && safeCompare(instance.token, key)) {
        return next();
      }
    } else {
      if (
        req.originalUrl.includes('/instance/fetchInstances') &&
        db.SAVE_DATA.INSTANCE
      ) {
        const instanceByKey = await prismaRepository.instance.findFirst({
          where: { token: key },
        });
        if (instanceByKey) {
          return next();
        }
      }
    }
  } catch (error) {
    logger.error(error);
  }

  throw new UnauthorizedException();
}

export const authGuard = { apikey };
