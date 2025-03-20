import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, GuildMemberRoleManager, InteractionContextType, MessageFlags } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: "Deposit silver into a user's payout account"
})
export class DepositPayoutBalanceCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: 'deposit',
			description: this.description,
			options: [
				{
					name: 'user',
					description: 'The user to deposit silver into balance',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'amount',
					description: 'The amount of silver to deposit',
					type: ApplicationCommandOptionType.Integer,
					required: true
				},
				{
					name: 'reason',
					description: 'The reason for the withdrawal',
					type: ApplicationCommandOptionType.String,
					required: false
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
		const amount = interaction.options.getInteger('amount', true);
		const reason = interaction.options.getString('reason', false);

		const configuration = await prisma.configuration.findUnique({
			where: {
				guildId: interaction.guild.id
			}
		});

		if (!configuration || !configuration.lootSplitAuthRoleId) {
			return interaction.reply({
				content: 'Configuration not found!',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const roles = (interaction.member?.roles as GuildMemberRoleManager).cache;

		if (!roles.has(configuration.lootSplitAuthRoleId)) {
			return interaction.reply({
				content: '❌ Only officers can initiate a balance deposit!',
				flags: [MessageFlags.Ephemeral]
			});
		}

		try {
			const account = await prisma.payoutAccount.upsert({
				where: {
					userId: user.id
				},
				update: {
					balance: {
						increment: amount
					}
				},
				create: {
					userId: user.id,
					guildId: interaction.guild.id,
					balance: amount
				}
			});

			return interaction.reply({
				content: `Successfully deposit ${amount} silver into account for <@${user.id}>. New balance: ${account.balance.toLocaleString()} silver. Reason: ${reason || 'No reason provided'}`
			});
		} catch (error) {
			return interaction.reply({
				content: `Failed to deposit silver into account for <@${user.id}>`,
				flags: [MessageFlags.Ephemeral]
			});
		}
	}
}
