import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { captureException } from '../lib/sentry.js';

const errorHandlerPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    fastify.log.error({ err: error }, 'Request error');

    // Report genuine server faults to Sentry (no-op until SENTRY_DSN is set). Client
    // errors (validation, 4xx, rate limits) are expected and intentionally not reported.
    const isServerFault =
      !(error instanceof ZodError) &&
      !error.validation &&
      (!error.statusCode || error.statusCode >= 500);
    if (isServerFault) {
      void captureException(error, { method: request.method, url: request.url });
    }

    // Zod validation errors → 400 Bad Request
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten(),
        },
      });
    }

    // Fastify validation errors (if using JSON schema validation alongside Zod)
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.validation,
        },
      });
    }

    // Rate limit errors
    if (error.statusCode === 429) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
        },
      });
    }

    // Known HTTP errors (thrown by route handlers)
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: {
          code: 'CLIENT_ERROR',
          message: error.message,
        },
      });
    }

    // All other errors → 500 Internal Server Error
    // Don't leak error details in production
    const isDev = process.env['NODE_ENV'] !== 'production';
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        ...(isDev ? { details: error.message } : {}),
      },
    });
  });
};

export const errorHandlerPlugin = fp(errorHandlerPluginImpl);
