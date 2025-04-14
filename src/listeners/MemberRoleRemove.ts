import { Listener, Events } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type GuildMember } from 'discord.js';
import { prisma } from '../client';

export class MemberRoleRemoveListener extends Listener<typeof Events.GuildMemberUpdate> {
	public constructor(context: Listener.LoaderContext, options: Listener.Options) {
		super(context, {
			...options,
			event: Events.GuildMemberUpdate
		});
	}

	public async run(oldMember: GuildMember, newMember: GuildMember) {
		this.container.logger.debug('MemberRoleRemoveListener');

		const configuration = await prisma.configuration.findUnique({
			where: { guildId: newMember.guild.id }
		});

		if (!configuration) {
			this.container.logger.error('No configuration found for guild:', newMember.guild.id);
			return;
		}

		const { memberRoleId, recruiterChannelId } = configuration;

		if (!recruiterChannelId) {
			this.container.logger.error('No recruiter channel set for guild:', newMember.guild.id);
			return;
		}

		// Check if trial role was added
		const newRoles = newMember.roles.cache;
		const oldRoles = oldMember.roles.cache;

		if (!memberRoleId) {
			this.container.logger.error('No member role set for guild:', newMember.guild.id);
			return;
		}

		if (!newRoles.has(memberRoleId) && oldRoles.has(memberRoleId)) {
			const balance = await prisma.payoutAccount.findUnique({
				where: {
					userId: newMember.id,
					guildId: newMember.guild.id
				}
			});

			if (!balance) {
				this.container.logger.error('No payout account found for user:', newMember.id);
				return;
			}

			const contentLines = [
				`❌ Member Role Removed for <@${newMember.user.id}>`,
				`User ID: ${newMember.id}`,
				`Balance: ${balance.balance.toLocaleString()} silver`,
				`Would you like to purge the account balance for this user?`
			].join('\n');

			// Create approval buttons
			const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`purge-balance-approve:${newMember.id}`)
					.setLabel('Purge')
					.setStyle(ButtonStyle.Success)
					.setEmoji('✅'),
				new ButtonBuilder().setCustomId(`purge-balance-deny:${newMember.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
			);

			try {
				// Notify recruiter chat
				this.container.logger.debug('Attempting to notify recruiter chat');
				const recruiterChatChannel = newMember.guild.channels.cache.get(recruiterChannelId);
				this.container.logger.debug('Recruiter chat channel:', recruiterChatChannel);
				if (recruiterChatChannel && recruiterChatChannel.isTextBased()) {
					this.container.logger.debug('Sending message to recruiter chat');
					await recruiterChatChannel.send({
						content: contentLines,
						components: [approvalRow]
					});
				}
			} catch (error) {
				this.container.logger.error('Error notifying recruiter chat:', error);
			}
		}
	}
}
