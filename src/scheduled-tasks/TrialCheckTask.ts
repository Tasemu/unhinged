import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { ChannelType, TextChannel } from 'discord.js';
import { prisma } from '../client';

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

				const configuration = await prisma.configuration.findUnique({
					where: { guildId: trial.guildId }
				});
				if (!configuration) {
					this.container.logger.error('No configuration found for guild:', trial.guildId);
					continue;
				}

				if (!configuration.recruiterChannelId) {
					this.container.logger.error('No recruiter channel set for guild:', trial.guildId);
					continue;
				}

				if (!configuration.recruiterRoleId) {
					this.container.logger.error('No recruiter role set for guild:', trial.guildId);
					continue;
				}

				if (timeRemaining <= 24 * 60 * 60 * 1000 && timeRemaining > 0) {
					this.container.logger.debug(`Trial for ${trial.userId} has ended`);
					this.container.logger.debug(`attempting to notify recruiter chat for ${trial.userId}`);
					// 24 hours remaining
					const guild = this.container.client.guilds.cache.get(trial.guildId);
					if (!guild) continue;

					const channel = guild.channels.cache.find(
						(ch) => ch.id === configuration.recruiterChannelId && ch.type === ChannelType.GuildText
					) as TextChannel;

					if (!channel) {
						this.container.logger.error(`Recruiter channel not found in ${guild.name}`);
						continue;
					}

					await channel.send({
						content: `⚠️ Trial period for <@${trial.userId}> ends in 24 hours! <@&${configuration.recruiterRoleId}> Discuss membership eligibility.`
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
