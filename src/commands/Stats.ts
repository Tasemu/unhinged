import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Get activity statistics for a user',
	requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
})
export class GetStatsCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: 'stats',
			description: this.description,
			options: [
				{
					name: 'user',
					description: 'The user to get stats for',
					type: ApplicationCommandOptionType.User,
					required: true
				}
			],
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const user = interaction.options.getUser('user', true);

		const configuration = await prisma.configuration.findUnique({
			where: { guildId: interaction.guild.id }
		});

		if (!configuration || !configuration.lootSplitPercentModifier) {
			this.container.logger.error('No configuration found for guild:', interaction.guild.id);
			return interaction.reply({
				content: '❌ Lootsplit percent modifier not set',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const lootsplits = await prisma.lootSplitSession.findMany({
			where: {
				guildId: interaction.guild.id,
				participants: {
					contains: user.id
				}
			}
		});

		if (lootsplits.length === 0) {
			return interaction.reply({
				content: `No loot splits found for <@${user.id}>`,
				flags: [MessageFlags.Ephemeral]
			});
		}

		const totalSilverForUser = lootsplits.reduce((acc, session) => {
			if (!session.participants || !configuration.lootSplitPercentModifier) return acc;
			const participantIds = session.participants.split(',');

			const silverForGuild = Math.floor(session.silver * configuration.lootSplitPercentModifier);
			const individualShare = silverForGuild / participantIds.length + session.donated / participantIds.length;

			return acc + individualShare;
		}, 0);

		// Create leaderboard lines with emoji decorations
		const leaderboardLines = [
			`- Member has participated in **${lootsplits.length}** loot splits`,
			`- Worth a total of **${lootsplits.reduce((acc, session) => acc + session.silver + session.donated, 0).toLocaleString()}** silver to the guild`,
			`- Of which **${totalSilverForUser.toLocaleString()}** silver has been accrued by <@${user.id}>`
		];

		// Create header with decoration
		const header = [`🏆 **Guild Member Statistics for: <@${user.id}>** 🏆`, '══════════════════════════════', ''].join('\n');

		const footer = ['', '══════════════════════════════'].join('\n');

		return interaction.reply({
			content: header + leaderboardLines.join('\n') + footer,
			allowedMentions: { parse: [] }
		});
	}
}
