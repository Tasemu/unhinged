import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../client';

const IGNORED_USER_IDS = ['95537980663406592']; // Replace with actual user IDs to ignore

@ApplyOptions<Command.Options>({
	description: 'Get the total of all payout accounts in the guild',
	requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
})
export class GetTotalBalanceCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: 'totalbalance',
			description: this.description,
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const totalBalance = await prisma.payoutAccount.aggregate({
			_sum: {
				balance: true
			},
			where: {
				guildId: interaction.guild.id,
				userId: { not: { in: IGNORED_USER_IDS } }
			}
		});

		if (!totalBalance || totalBalance._sum.balance === null) {
			return interaction.reply({
				content: 'No payout accounts found in this guild',
				flags: [MessageFlags.Ephemeral]
			});
		}

		return interaction.reply({
			content: `The total balance of all payout accounts in this guild is ${totalBalance._sum.balance.toLocaleString()} silver`,
			flags: [MessageFlags.Ephemeral]
		});
	}
}
