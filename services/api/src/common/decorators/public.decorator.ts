import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as publicly accessible (bypasses JWT guard).
 *
 * @example
 * @Public()
 * @Get('health')
 * health() { return 'ok'; }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
