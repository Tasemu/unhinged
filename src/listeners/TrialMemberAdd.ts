import { Listener, Events } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { prisma } from '../client';

export class TrialMemberAddListener extends Listener<typeof Events.GuildMemberUpdate> {
	public constructor(context: Listener.LoaderContext, options: Listener.Options) {
		super(context, {
			...options,
			event: Events.GuildMemberUpdate
		});
	}

	public async run(oldMember: GuildMember, newMember: GuildMember) {
		this.container.logger.debug('TrialMemberAddListener');

		const recruiterChatChannelId = '123456789012345678'; // Replace with your channel ID

		const configuration = await prisma.configuration.findUnique({
			where: { guildId: newMember.guild.id }
		});

		if (!configuration) {
			this.container.logger.error('No configuration found for guild:', newMember.guild.id);
			return;
		}

		const { trialRoleId } = configuration;

		// Check if trial role was added
		const newRoles = newMember.roles.cache;
		const oldRoles = oldMember.roles.cache;

		this.container.logger.debug('Old roles:', oldRoles);
		this.container.logger.debug('New roles:', newRoles);

		if (!trialRoleId) {
			this.container.logger.error('No trial role set for guild:', newMember.guild.id);
			return;
		}

		if (!oldRoles.has(trialRoleId) && newRoles.has(trialRoleId)) {
			try {
				// Store in database
				await prisma.trialStart.create({
					data: {
						userId: newMember.id,
						guildId: newMember.guild.id
					}
				});

				try {
					// Notify recruiter chat
					const recruiterChatChannel = newMember.guild.channels.cache.get(recruiterChatChannelId);
					if (recruiterChatChannel && recruiterChatChannel.isTextBased()) {
						await recruiterChatChannel.send({
							content: `🎉 Trial start recorded for ${newMember.user.tag}`
						});
					}
				} catch (error) {
					this.container.logger.error('Error notifying recruiter chat:', error);
				}

				this.container.logger.info(`Trial start recorded for ${newMember.user.tag}`);
			} catch (error) {
				this.container.logger.error('Error recording trial start:', error);
			}
		}
	}
}
