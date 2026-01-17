import { init } from '@paralleldrive/cuid2';

export const createId = init({
	length: 12,
	fingerprint: process.env.CUID_FINGERPRINT
});
