import { z } from 'zod';
import { insertSlotSchema, insertBookingSchema, slots, bookings, notifications } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  slots: {
    list: {
      method: 'GET' as const,
      path: '/api/slots',
      input: z.object({
        ownerId: z.string().optional(),
        date: z.string().optional(), // ISO date string
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof slots.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/slots',
      input: insertSlotSchema,
      responses: {
        201: z.custom<typeof slots.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/slots/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    }
  },
  bookings: {
    create: {
      method: 'POST' as const,
      path: '/api/bookings',
      input: z.object({
        slotId: z.number(),
        customerName: z.string().min(1, "Name is required"),
        customerPhone: z.string().min(1, "Phone number is required"),
      }),
      responses: {
        201: z.custom<typeof bookings.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/bookings',
      responses: {
        200: z.array(z.custom<typeof bookings.$inferSelect & { slot: typeof slots.$inferSelect }>()), // Returns bookings with slot details
        401: errorSchemas.unauthorized,
      },
    }
  },
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications',
      responses: {
        200: z.array(z.custom<typeof notifications.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    markRead: {
      method: 'PATCH' as const,
      path: '/api/notifications/:id/read',
      responses: {
        200: z.custom<typeof notifications.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
