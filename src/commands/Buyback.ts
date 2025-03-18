import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonStyle,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Log a buy-back request for a guild member',
	requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
})
export class BuybackCommand extends Command {
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
					description: 'The user to re-gear',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'silver',
					description: 'The amount of silver in total',
					type: ApplicationCommandOptionType.Integer,
					required: true
				},
				{
					name: 'screenshot',
					description: 'The screenshot of the buyback',
					type: ApplicationCommandOptionType.Attachment,
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

		const creator = interaction.user;

		// Get the user and gear
		const user = interaction.options.getUser('user', true);
		const silver = interaction.options.getInteger('silver', true);
		const screenshot = interaction.options.getAttachment('screenshot', true);

		// Get the buyback modifier from configuration
		const configuration = await prisma.configuration.findUnique({
			where: { guildId: interaction.guild.id }
		});

		if (!configuration || !configuration.buybackPercentModifier) {
			this.container.logger.error('Buyback command failed: Configuration not found');
			return interaction.reply({
				content: 'The buyback modifier has not been set for this server. Please ask an administrator to set it.',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const buybackValue = Math.floor(silver * configuration.buybackPercentModifier);

		try {
			// Create approval buttons
			const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`buyback-approve:${user.id}:${buybackValue}`)
					.setLabel('Approve')
					.setStyle(ButtonStyle.Success)
					.setEmoji('✅'),
				new ButtonBuilder()
					.setCustomId(`buyback-reject:${user.id}:${buybackValue}`)
					.setLabel('Deny')
					.setStyle(ButtonStyle.Secondary)
					.setEmoji('❌')
			);

			return interaction.reply({
				content: [
					`**Buy-back Request for <@${user.id}>**`,
					`**Requested by:** <@${creator.id}>`,
					`**Total Silver:** ${silver.toLocaleString()} silver`,
					`**Buyback Modifier:** ${configuration.buybackPercentModifier * 100}%`,
					`**Buyback Value:** ${buybackValue.toLocaleString()} silver`,
					`**Screenshot:** [View](${screenshot.url})`
				].join('\n'),
				components: [approvalRow]
			});
		} catch (error) {
			this.container.logger.error('Buyback command failed:', error);
			return interaction.reply({
				content: 'Failed to create the buy-back request. Please try again later.',
				ephemeral: true
			});
		}
	}
}
