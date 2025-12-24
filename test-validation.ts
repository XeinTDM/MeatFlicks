import { ValidationError } from './src/lib/server/error-handler';

try {
	throw new ValidationError('Test message');
} catch (error) {
	console.log('Error:', error);
}
