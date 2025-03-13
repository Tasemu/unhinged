import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Get the top 10 members with the highest balance in the guild',
	requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
})
export class GetLeaderboardCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: 'leaderboard',
			description: this.description,
			integrationTypes,
			contexts
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		try {
			const payoutAccounts = await prisma.payoutAccount.findMany({
				orderBy: { balance: 'desc' },
				take: 10
			});

			if (!payoutAccounts.length) {
				return interaction.reply({
					content: 'No payout accounts found in this guild',
					ephemeral: true
				});
			}

			// Fetch member information for all accounts
			const members = await Promise.all(payoutAccounts.map((account) => interaction.guild!.members.fetch(account.userId).catch(() => null)));

			// Create leaderboard lines with emoji decorations
			const leaderboardLines = await Promise.all(
				payoutAccounts.map(async (account, index) => {
					const member = members[index];
					const username = member?.displayName || 'Unknown User';
					const balance = account.balance.toLocaleString();

					// Add medal emojis for top 3
					const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`${(index + 1).toString().padStart(2, ' ')}\``;

					return `${rankEmoji} **${username}** - \`${balance.padStart(12, ' ')} silver\``;
				})
			);

			// Create header with decoration
			const header = [
				'🏆 **Guild Silver Leaderboard** 🏆',
				'══════════════════════════════',
				`👑 Top ${payoutAccounts.length} Members • ${new Date().toLocaleDateString()} 👑`,
				''
			].join('\n');

			const footer = [
				'',
				'══════════════════════════════',
				`💎 Total Silver in Circulation: ${payoutAccounts.reduce((sum, acc) => sum + acc.balance, 0).toLocaleString()} 💎`
			].join('\n');

			return interaction.reply({
				content: header + leaderboardLines.join('\n') + footer,
				allowedMentions: { parse: [] }
			});
		} catch (error) {
			this.container.logger.error('Leaderboard command failed:', error);
			return interaction.reply({
				content: 'Failed to fetch leaderboard. Please try again later.',
				ephemeral: true
			});
		}
	}
}
