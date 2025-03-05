// src/prisma/client.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
	log: ['query', 'info', 'warn', 'error']
});

// Connect to database when bot starts
prisma
	.$connect()
	.then(() => console.log('Connected to database'))
	.catch((error: Error) => console.error('Database connection error:', error));
