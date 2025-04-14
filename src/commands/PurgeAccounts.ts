import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonStyle,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Purge all payout account for users no longer in the guild',
	requiredUserPermissions: [PermissionFlagsBits.Administrator]
})
export class PurgeAccountsCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const activeMembers = await interaction.guild.members.fetch();
		const activeMemberIds = activeMembers.keys();

		const inactiveAccounts = await prisma.payoutAccount.findMany({
			where: {
				guildId: interaction.guild.id,
				userId: { notIn: Array.from(activeMemberIds) }
			}
		});

		const contentLines = [
			`🗑️ Request to purge ${inactiveAccounts.length} payout accounts for users no longer in the guild`,
			`For a total of ${inactiveAccounts.reduce((acc, account) => acc + account.balance, 0).toLocaleString()} silver`
		].join('\n');

		// Create approval buttons
		const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`purge-all-approve`).setLabel('Purge').setStyle(ButtonStyle.Success).setEmoji('✅'),
			new ButtonBuilder().setCustomId(`purge-all-deny`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
		);

		return interaction.reply({
			content: contentLines,
			flags: [MessageFlags.Ephemeral],
			components: [approvalRow]
		});
	}
}
