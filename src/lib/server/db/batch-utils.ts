import { db } from './client';
import { logger } from '../logger';
import { sql } from 'drizzle-orm';

/**
 * Batch insert utility with transaction support
 */
export async function batchInsert<T>(
	table: string,
	data: T[],
	batchSize: number = 50,
	transform: (item: T) => Record<string, unknown> = (item) => item as Record<string, unknown>
): Promise<number> {
	if (data.length === 0) {
		return 0;
	}

	try {
		let insertedCount = 0;

		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);
			const transformed = batch.map(transform);

			// Use transaction for each batch
			await db.transaction(async (tx) => {
				for (const item of transformed) {
					const columns = Object.keys(item).join(', ');
					const placeholders = Object.keys(item).map(() => '?').join(', ');
					const values = Object.values(item);

					const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
					await tx.run(query, values);
					insertedCount++;
				}
			});
		}

		logger.info({ table, count: insertedCount }, 'Batch insert completed');
		return insertedCount;
	} catch (error) {
		logger.error({ error, table, count: data.length }, 'Batch insert failed');
		throw error;
	}
}

/**
 * Batch update utility with transaction support
 */
export async function batchUpdate<T>(
	table: string,
	data: T[],
	keyColumn: string,
	batchSize: number = 50,
	transform: (item: T) => Record<string, unknown> = (item) => item as Record<string, unknown>
): Promise<number> {
	if (data.length === 0) {
		return 0;
	}

	try {
		let updatedCount = 0;

		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);

			// Use transaction for each batch
			await db.transaction(async (tx) => {
				for (const item of batch) {
					const transformed = transform(item);
					const keyValue = transformed[keyColumn];
					delete transformed[keyColumn];

					const setClause = Object.keys(transformed)
						.map(col => `${col} = ?`)
						.join(', ');
					const values = [...Object.values(transformed), keyValue];

					const query = `UPDATE ${table} SET ${setClause} WHERE ${keyColumn} = ?`;
					const result = await tx.run(query, values);

					if (result.changes && result.changes > 0) {
						updatedCount++;
					}
				}
			});
		}

		logger.info({ table, count: updatedCount }, 'Batch update completed');
		return updatedCount;
	} catch (error) {
		logger.error({ error, table, count: data.length }, 'Batch update failed');
		throw error;
	}
}

/**
 * Batch upsert utility (insert or update)
 */
export async function batchUpsert<T>(
	table: string,
	data: T[],
	keyColumn: string,
	batchSize: number = 50,
	transform: (item: T) => Record<string, unknown> = (item) => item as Record<string, unknown>
): Promise<{ inserted: number; updated: number }> {
	if (data.length === 0) {
		return { inserted: 0, updated: 0 };
	}

	try {
		let insertedCount = 0;
		let updatedCount = 0;

		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);

			// Use transaction for each batch
			await db.transaction(async (tx) => {
				for (const item of batch) {
					const transformed = transform(item);
					const keyValue = transformed[keyColumn];
					delete transformed[keyColumn];

					// Try to update first
					const setClause = Object.keys(transformed)
						.map(col => `${col} = ?`)
						.join(', ');
					const updateValues = [...Object.values(transformed), keyValue];

					const updateQuery = `UPDATE ${table} SET ${setClause} WHERE ${keyColumn} = ?`;
					const updateResult = await tx.run(updateQuery, updateValues);

					if (updateResult.changes && updateResult.changes > 0) {
						updatedCount++;
					} else {
						// Insert if update didn't affect any rows
						const columns = Object.keys(transformed).join(', ');
						const placeholders = Object.keys(transformed).map(() => '?').join(', ');
						const insertValues = [...Object.values(transformed), keyValue];

						const insertQuery = `INSERT INTO ${table} (${columns}, ${keyColumn}) VALUES (${placeholders}, ?)`;
						await tx.run(insertQuery, insertValues);
						insertedCount++;
					}
				}
			});
		}

		logger.info({
			table,
			inserted: insertedCount,
			updated: updatedCount,
			total: data.length
		}, 'Batch upsert completed');

		return { inserted: insertedCount, updated: updatedCount };
	} catch (error) {
		logger.error({ error, table, count: data.length }, 'Batch upsert failed');
		throw error;
	}
}

/**
 * Execute multiple queries in a single transaction
 */
export async function executeInTransaction<T>(
	queries: (() => Promise<T>)[],
	maxRetries: number = 3
): Promise<T[]> {
	let lastError: unknown;
	let attempt = 0;

	while (attempt < maxRetries) {
		try {
			return await db.transaction(async (tx) => {
				const results: T[] = [];

				for (const query of queries) {
					// Pass the transaction to the query function if it can handle it
					if (query.length === 1) {
						results.push(await query(tx as any));
					} else {
						results.push(await query());
					}
				}

				return results;
			});
		} catch (error) {
			lastError = error;
			attempt++;
			logger.warn({
				attempt,
				maxRetries,
				error: error instanceof Error ? error.message : String(error)
			}, 'Transaction failed, retrying...');

			if (attempt < maxRetries) {
				await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
			}
		}
	}

	logger.error({ error: lastError, attempts: maxRetries }, 'Transaction failed after retries');
	throw lastError;
}

/**
 * Database query performance monitoring wrapper
 */
export async function monitorQuery<T>(
	name: string,
	query: () => Promise<T>,
	logSlowQueries: boolean = true,
	slowThresholdMs: number = 1000
): Promise<T> {
	const startTime = Date.now();

	try {
		const result = await query();
		const duration = Date.now() - startTime;

		if (logSlowQueries && duration > slowThresholdMs) {
			logger.warn({
				name,
				duration,
				threshold: slowThresholdMs
			}, 'Slow database query detected');
		} else {
			logger.debug({
				name,
				duration
			}, 'Database query completed');
		}

		return result;
	} catch (error) {
		const duration = Date.now() - startTime;
		logger.error({
			name,
			duration,
			error: error instanceof Error ? error.message : String(error)
		}, 'Database query failed');

		throw error;
	}
}
