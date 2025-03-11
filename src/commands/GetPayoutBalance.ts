import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, MessageFlags } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Get the current balance of your payout account'
})
export class GetPayoutBalanceCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: 'balance',
			description: this.description,
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const user = interaction.user;

		const payoutAccount = await prisma.payoutAccount.findUnique({
			where: {
				userId: user.id
			}
		});

		if (!payoutAccount) {
			return interaction.reply({
				content: 'You do not have a payout account set up. An account will be created when you receive your first deposit.',
				flags: [MessageFlags.Ephemeral]
			});
		}

		return interaction.reply({
			content: `Your current balance is ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
				.format(payoutAccount.balance)
				.replace('$', '')
				.trim()} silver`,
			flags: [MessageFlags.Ephemeral]
		});
	}
}
