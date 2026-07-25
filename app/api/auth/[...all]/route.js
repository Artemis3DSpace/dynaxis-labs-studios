import { toNextJsHandler } from 'better-auth/next-js';
import { getDynaxisAuthHandler } from '@/lib/dynaxis/auth/server.js';

const handlers = toNextJsHandler((request) => getDynaxisAuthHandler()(request));

export const GET = handlers.GET;
export const POST = handlers.POST;
