import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, GuildMemberRoleManager, InteractionContextType, MessageFlags } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: "Withdraw all silver from a user's payout account"
})
export class FullPayoutCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: 'payout',
			description: this.description,
			options: [
				{
					name: 'user',
					description: 'The user to withdraw silver from balance',
					type: ApplicationCommandOptionType.User,
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
				content: '❌ Only officers can initiate a balance withdraw!',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const payoutAccount = await prisma.payoutAccount.findUnique({
			where: {
				userId: user.id
			}
		});

		if (!payoutAccount) {
			return interaction.reply({
				content: `<@${user.id}> does not have a payout account!`,
				flags: [MessageFlags.Ephemeral]
			});
		}

		try {
			const newBalance = await prisma.payoutAccount.update({
				where: {
					userId: payoutAccount.userId
				},
				data: {
					balance: 0
				}
			});

			return interaction.reply({
				content: `Successfully withdrew ${payoutAccount.balance} silver from <@${user.id}>. New balance: ${newBalance.balance.toLocaleString()} silver. Reason: ${reason || 'No reason provided'}`
			});
		} catch (error) {
			return interaction.reply({
				content: `Failed to withdraw silver from <@${user.id}>`,
				flags: [MessageFlags.Ephemeral]
			});
		}
	}
}
