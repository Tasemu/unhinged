import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Get the current balance of a guild members payout account',
	requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
})
export class GetMemberBalanceCommand extends Command {
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
			options: [
				{
					name: 'user',
					description: 'The user to get the balance of',
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

		const payoutAccount = await prisma.payoutAccount.findUnique({
			where: {
				userId: user.id
			}
		});

		if (!payoutAccount) {
			return interaction.reply({
				content: 'Member does not have a payout account set up.',
				flags: [MessageFlags.Ephemeral]
			});
		}

		return interaction.reply({
			content: `Current balance for ${user.displayName} is ${payoutAccount.balance.toLocaleString()} silver`,
			flags: [MessageFlags.Ephemeral]
		});
	}
}
