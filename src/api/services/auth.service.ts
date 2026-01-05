import { PrismaRepository } from '@api/repository/repository.service';
import { BadRequestException } from '@exceptions';

export class AuthService {
  constructor(private readonly prismaRepository: PrismaRepository) {}

  public async checkDuplicateToken(token: string): Promise<boolean> {
    // Empty tokens are auto-generated, skip duplicate check for them
    if (!token || token.trim().length === 0) {
      return true;
    }

    // Validate token format (basic security check)
    if (token.length < 8) {
      throw new BadRequestException('Token must be at least 8 characters long');
    }

    // Look up instance with the given token; throw if method is missing
    const existingInstance = await this.prismaRepository.instance.findFirst({
      where: { token },
    });

    if (existingInstance) {
      throw new BadRequestException('Token already exists');
    }

    return true;
  }
}
