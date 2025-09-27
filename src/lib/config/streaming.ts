import { z } from 'zod';

const streamingSchema = z.object({
  VIDLINK_BASE_URL: z.string().url().default('https://vidlink.pro'),
  VIDLINK_API_KEY: z.string().optional(),
  VIDSRC_BASE_URL: z.string().url().default('https://vidsrc.me'),
  VIDSRC_API_KEY: z.string().optional(),
  EMBEDSU_BASE_URL: z.string().url().default('https://embed.su'),
  TWOEMBED_BASE_URL: z.string().url().default('https://www.2embed.to')
});

const envValues = streamingSchema.parse({
  VIDLINK_BASE_URL: process.env.VIDLINK_BASE_URL,
  VIDLINK_API_KEY: process.env.VIDLINK_API_KEY,
  VIDSRC_BASE_URL: process.env.VIDSRC_BASE_URL,
  VIDSRC_API_KEY: process.env.VIDSRC_API_KEY,
  EMBEDSU_BASE_URL: process.env.EMBEDSU_BASE_URL,
  TWOEMBED_BASE_URL: process.env.TWOEMBED_BASE_URL
});

const normalizeBase = (url: string) => url.replace(/\/$/, '');

export const streamingConfig = {
  vidlink: {
    baseUrl: normalizeBase(envValues.VIDLINK_BASE_URL),
    apiKey: envValues.VIDLINK_API_KEY ?? null
  },
  vidsrc: {
    baseUrl: normalizeBase(envValues.VIDSRC_BASE_URL),
    apiKey: envValues.VIDSRC_API_KEY ?? null
  },
  embedSu: {
    baseUrl: normalizeBase(envValues.EMBEDSU_BASE_URL)
  },
  twoEmbed: {
    baseUrl: normalizeBase(envValues.TWOEMBED_BASE_URL)
  }
} as const;
