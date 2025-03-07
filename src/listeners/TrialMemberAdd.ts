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

		const configuration = await prisma.configuration.findUnique({
			where: { guildId: newMember.guild.id }
		});

		if (!configuration) {
			this.container.logger.error('No configuration found for guild:', newMember.guild.id);
			return;
		}

		const { trialRoleId, recruiterChannelId } = configuration;

		// Check if trial role was added
		const newRoles = newMember.roles.cache;
		const oldRoles = oldMember.roles.cache;

		this.container.logger.debug('Old roles:', oldRoles);
		this.container.logger.debug('New roles:', newRoles);

		if (!trialRoleId) {
			this.container.logger.error('No trial role set for guild:', newMember.guild.id);
			return;
		}

		if (!newRoles.has(trialRoleId) && oldRoles.has(trialRoleId)) {
			try {
				const trialStart = await prisma.trialStart.findUnique({
					where: {
						userId: newMember.id,
						guildId: newMember.guild.id
					}
				});

				if (!trialStart) {
					this.container.logger.error('No trial start found for user:', newMember.id);
					return;
				}

				await prisma.trialStart.delete({
					where: {
						userId: newMember.id,
						guildId: newMember.guild.id
					}
				});

				try {
					if (!recruiterChannelId) {
						this.container.logger.error('No recruiter channel set for guild:', newMember.guild.id);
						return;
					}
					// Notify recruiter chat
					this.container.logger.debug('Attempting to notify recruiter chat');
					const recruiterChatChannel = newMember.guild.channels.cache.get(recruiterChannelId);
					this.container.logger.debug('Recruiter chat channel:', recruiterChatChannel);
					if (recruiterChatChannel && recruiterChatChannel.isTextBased()) {
						this.container.logger.debug('Sending message to recruiter chat');
						await recruiterChatChannel.send({
							content: `❌ Trial role deleted for <@${newMember.user.id}>`
						});
					}
				} catch (error) {
					this.container.logger.error('Error notifying recruiter chat:', error);
				}
			} catch (error) {
				this.container.logger.error('Error deleting trial start:', error);
			}
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
					if (!recruiterChannelId) {
						this.container.logger.error('No recruiter channel set for guild:', newMember.guild.id);
						return;
					}
					// Notify recruiter chat
					this.container.logger.debug('Attempting to notify recruiter chat');
					const recruiterChatChannel = newMember.guild.channels.cache.get(recruiterChannelId);
					this.container.logger.debug('Recruiter chat channel:', recruiterChatChannel);
					if (recruiterChatChannel && recruiterChatChannel.isTextBased()) {
						this.container.logger.debug('Sending message to recruiter chat');
						await recruiterChatChannel.send({
							content: `🎉 Trial start recorded for <@${newMember.user.id}>`
						});
					}
				} catch (error) {
					this.container.logger.error('Error notifying recruiter chat:', error);
				}

				this.container.logger.info(`Trial start recorded for <@${newMember.user.id}>`);
			} catch (error) {
				this.container.logger.error('Error recording trial start:', error);
			}
		}
	}
}
