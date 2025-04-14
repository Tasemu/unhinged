// Add this new listener class to your existing file
import { Listener, Events } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type GuildMember } from 'discord.js';
import { prisma } from '../client';

export class MemberLeaveListener extends Listener<typeof Events.GuildMemberRemove> {
	public constructor(context: Listener.LoaderContext, options: Listener.Options) {
		super(context, {
			...options,
			event: Events.GuildMemberRemove
		});
	}

	public async run(member: GuildMember) {
		this.container.logger.debug('MemberLeaveListener');

		const configuration = await prisma.configuration.findUnique({
			where: { guildId: member.guild.id }
		});

		if (!configuration) {
			this.container.logger.error('No configuration found for guild:', member.guild.id);
			return;
		}

		const { memberRoleId, recruiterChannelId } = configuration;

		if (!recruiterChannelId) {
			this.container.logger.error('No recruiter channel set for guild:', member.guild.id);
			return;
		}

		if (!memberRoleId) {
			this.container.logger.error('No member role set for guild:', member.guild.id);
			return;
		}

		// Check if the member had the role when they left
		if (member.roles.cache.has(memberRoleId)) {
			const balance = await prisma.payoutAccount.findUnique({
				where: {
					userId: member.id,
					guildId: member.guild.id
				}
			});

			if (!balance) {
				this.container.logger.error('No payout account found for user:', member.id);
				return;
			}

			const contentLines = [
				`⚠️ Member Left Server with Role <@${member.user.id}>`,
				`User ID: ${member.id}`,
				`Balance: ${balance.balance.toLocaleString()} silver`,
				`Would you like to purge the account balance for this user?`
			].join('\n');

			const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId(`purge-balance-approve:${member.id}`).setLabel('Purge').setStyle(ButtonStyle.Success).setEmoji('✅'),
				new ButtonBuilder().setCustomId(`purge-balance-deny:${member.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
			);

			try {
				const recruiterChatChannel = member.guild.channels.cache.get(recruiterChannelId);
				if (recruiterChatChannel?.isTextBased()) {
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
