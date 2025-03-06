import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { ChannelType, TextChannel } from 'discord.js';
import { prisma } from '../client';

const PING_CHANNEL_NAME = 'recruiter-chat';

export class TrialCheckTask extends ScheduledTask {
	public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'trialCheck',
			interval: 3600000 // 1 hour
		});
	}

	public async run() {
		this.container.logger.debug('Checking trial periods');
		const trials = await prisma.trialStart.findMany();

		for (const trial of trials) {
			try {
				const trialEnd = new Date(trial.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
				const now = new Date();
				const timeRemaining = trialEnd.getTime() - now.getTime();

				if (timeRemaining <= 24 * 60 * 60 * 1000 && timeRemaining > 0) {
					// 24 hours remaining
					const guild = this.container.client.guilds.cache.get(trial.guildId);
					if (!guild) continue;

					const channel = guild.channels.cache.find(
						(ch) => ch.name === PING_CHANNEL_NAME && ch.type === ChannelType.GuildText
					) as TextChannel;

					if (!channel) {
						this.container.logger.error(`Recruiter channel not found in ${guild.name}`);
						continue;
					}

					await channel.send({
						content: `⚠️ Trial period for <@${trial.userId}> ends in 24 hours! @Recruiter Discuss membership eligibility.`
					});

					await prisma.trialStart.delete({
						where: { userId: trial.userId }
					});
				} else {
					const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
					const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
					const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
					this.container.logger.debug(`Trial for ${trial.userId} ends in ${days} days, ${hours} hours, and ${minutes} minutes`);
				}
			} catch (error) {
				this.container.logger.error(`Error processing trial for ${trial.userId}:`, error);
			}
		}
	}
}
