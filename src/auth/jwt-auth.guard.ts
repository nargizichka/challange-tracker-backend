import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {

    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}