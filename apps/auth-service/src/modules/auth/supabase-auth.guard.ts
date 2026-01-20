import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const client = this.supabaseService.getClient();

      // Verify the JWT token with Supabase
      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);

      if (error || !user) {
        return false;
      }

      // Attach user to request object
      request.user = user;
      return true;
    } catch (error) {
      return false;
    }
  }
}
