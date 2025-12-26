import { z } from 'zod';

const optionalSecret = z
	.string()
	.optional()
	.transform((value) => {
		const trimmed = value?.trim();
		return trimmed && trimmed.length > 0 ? trimmed : undefined;
	});

const streamingSchema = z.object({
	VIDLINK_BASE_URL: z.string().url().default('https://vidlink.pro'),
	VIDLINK_API_KEY: optionalSecret,
	VIDSRC_BASE_URL: z.string().url().default('https://vidsrcme.su'),
	VIDSRC_API_KEY: optionalSecret,
	VIDSRC_EMBED_RU_BASE_URL: z.string().url().default('https://vidsrc-embed.ru'),
	VIDSRC_EMBED_SU_BASE_URL: z.string().url().default('https://vidsrc-embed.su'),
	VIDSRCME_SU_BASE_URL: z.string().url().default('https://vidsrcme.su'),
	VSRC_SU_BASE_URL: z.string().url().default('https://vsrc.su'),
	VIDSRCXYZ_BASE_URL: z.string().url().default('https://vidsrc.xyz'),
	EMBEDSU_BASE_URL: z.string().url().default('https://embed.su'),
	TWOEMBED_BASE_URL: z.string().url().default('https://2embed.cc'),
	HNEMBED_CC_BASE_URL: z.string().url().default('https://hnembed.cc'),
	HNEMBED_NET_BASE_URL: z.string().url().default('https://hnembed.net'),
	MAPPLETV_BASE_URL: z.string().url().default('https://mappletv.uk'),
	PRIMEWIRE_BASE_URL: z.string().url().default('https://primewire.tf'),
	MULTIEMBED_BASE_URL: z.string().url().default('https://multiembed.mov'),
	VIDBINGE_BASE_URL: z.string().url().default('https://vidbinge.dev'),
	MOVIESAPI_BASE_URL: z.string().url().default('https://moviesapi.club'),
	AUTOEMBED_BASE_URL: z.string().url().default('https://player.autoembed.cc')
});

const envValues = streamingSchema.parse({
	VIDLINK_BASE_URL: process.env.VIDLINK_BASE_URL,
	VIDLINK_API_KEY: process.env.VIDLINK_API_KEY,
	VIDSRC_BASE_URL: process.env.VIDSRC_BASE_URL,
	VIDSRC_API_KEY: process.env.VIDSRC_API_KEY,
	VIDSRC_EMBED_RU_BASE_URL: process.env.VIDSRC_EMBED_RU_BASE_URL,
	VIDSRC_EMBED_SU_BASE_URL: process.env.VIDSRC_EMBED_SU_BASE_URL,
	VIDSRCME_SU_BASE_URL: process.env.VIDSRCME_SU_BASE_URL,
	VSRC_SU_BASE_URL: process.env.VSRC_SU_BASE_URL,
	VIDSRCXYZ_BASE_URL: process.env.VIDSRCXYZ_BASE_URL,
	EMBEDSU_BASE_URL: process.env.EMBEDSU_BASE_URL,
	TWOEMBED_BASE_URL: process.env.TWOEMBED_BASE_URL,
	HNEMBED_CC_BASE_URL: process.env.HNEMBED_CC_BASE_URL,
	HNEMBED_NET_BASE_URL: process.env.HNEMBED_NET_BASE_URL,
	MAPPLETV_BASE_URL: process.env.MAPPLETV_BASE_URL,
	PRIMEWIRE_BASE_URL: process.env.PRIMEWIRE_BASE_URL,
	MULTIEMBED_BASE_URL: process.env.MULTIEMBED_BASE_URL,
	VIDBINGE_BASE_URL: process.env.VIDBINGE_BASE_URL,
	MOVIESAPI_BASE_URL: process.env.MOVIESAPI_BASE_URL,
	AUTOEMBED_BASE_URL: process.env.AUTOEMBED_BASE_URL
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
	vidsrcEmbedRu: {
		baseUrl: normalizeBase(envValues.VIDSRC_EMBED_RU_BASE_URL)
	},
	vidsrcEmbedSu: {
		baseUrl: normalizeBase(envValues.VIDSRC_EMBED_SU_BASE_URL)
	},
	vidsrcmeSu: {
		baseUrl: normalizeBase(envValues.VIDSRCME_SU_BASE_URL)
	},
	vsrcSu: {
		baseUrl: normalizeBase(envValues.VSRC_SU_BASE_URL)
	},
	vidsrcxyz: {
		baseUrl: normalizeBase(envValues.VIDSRCXYZ_BASE_URL)
	},
	embedSu: {
		baseUrl: normalizeBase(envValues.EMBEDSU_BASE_URL)
	},
	twoEmbed: {
		baseUrl: normalizeBase(envValues.TWOEMBED_BASE_URL)
	},
	hnembedCc: {
		baseUrl: normalizeBase(envValues.HNEMBED_CC_BASE_URL)
	},
	hnembedNet: {
		baseUrl: normalizeBase(envValues.HNEMBED_NET_BASE_URL)
	},
	mappletv: {
		baseUrl: normalizeBase(envValues.MAPPLETV_BASE_URL)
	},
	primewire: {
		baseUrl: normalizeBase(envValues.PRIMEWIRE_BASE_URL)
	},
	multiEmbed: {
		baseUrl: normalizeBase(envValues.MULTIEMBED_BASE_URL)
	},
	vidBinge: {
		baseUrl: normalizeBase(envValues.VIDBINGE_BASE_URL)
	},
	moviesApi: {
		baseUrl: normalizeBase(envValues.MOVIESAPI_BASE_URL)
	},
	autoEmbed: {
		baseUrl: normalizeBase(envValues.AUTOEMBED_BASE_URL)
	}
} as const;
