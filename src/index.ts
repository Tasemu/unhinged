import './lib/setup';
import '@sapphire/plugin-scheduled-tasks/register';

import { LogLevel, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';
import { prisma } from './client';

const client = new SapphireClient({
	defaultPrefix: '!',
	caseInsensitiveCommands: true,
	logger: {
		level: LogLevel.Debug
	},
	intents: [
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers
	],
	loadMessageCommandListeners: true,
	tasks: {
		bull: {
			connection: {
				host: 'localhost',
				port: 6379
			}
		}
	}
});

const main = async () => {
	try {
		client.logger.info('Logging in');
		await client.login().finally(async () => {
			// Close Prisma connection when bot shuts down
			await prisma.$disconnect();
		});
		client.logger.info('logged in');
	} catch (error) {
		client.logger.fatal(error);
		await client.destroy();
		process.exit(1);
	}
};

void main();
