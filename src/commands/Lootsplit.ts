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
	UserSelectMenuBuilder
} from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Log a loot-split for a group of users'
})
export class LootSplitCommand extends Command {
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
					name: 'silver',
					description: 'The estimated silver value from the loot split tab',
					type: ApplicationCommandOptionType.Number,
					required: true
				},
				{
					name: 'silverbags',
					description: 'The silver collected from silver bags and donated to the guild for redistribution',
					type: ApplicationCommandOptionType.Number,
					required: true
				},
				{
					name: 'screenshot',
					description: 'A screenshot of the loot',
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

		const silver = interaction.options.getNumber('silver', true);
		const donated = interaction.options.getNumber('silverbags', true);
		const screenshot = interaction.options.getAttachment('screenshot', true);

		this.container.logger.info(`Loot Split: ${silver} silver, ${donated} donated, ${screenshot.url}`);

		// Create database session
		const session = await prisma.lootSplitSession.create({
			data: {
				guildId: interaction.guild.id,
				silver,
				donated,
				screenshotUrl: screenshot.url,
				creatorId: interaction.user.id
			}
		});

		// Create user selection menu
		const selectMenu = new UserSelectMenuBuilder()
			.setCustomId(`lootsplit-select:${session.id}`)
			.setPlaceholder('Select participants')
			.addDefaultUsers([interaction.user.id])
			.setMinValues(1)
			.setMaxValues(25);

		// Create approval buttons
		const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`lootsplit-confirm:${session.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅')
		);

		const actionRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

		// Send initial response
		const message = await interaction.reply({
			content: '**Loot Split Setup**\nSelect participants:',
			components: [actionRow, approvalRow],
			flags: [MessageFlags.Ephemeral]
		});

		// Set up interaction collector
		const collector = message.createMessageComponentCollector({
			filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('lootsplit-select:'),
			time: 300_000 // 5 minutes timeout
		});

		collector.on('collect', async (i) => {
			try {
				if (i.isUserSelectMenu()) {
					// Update session with participants using set
					await prisma.lootSplitSession.update({
						where: { id: session.id },
						data: {
							participants: {
								set: i.values.join(',') // Changed from connect to set
							}
						}
					});

					await i.deferUpdate();
				}
			} catch (error) {
				this.container.logger.error('Error handling interaction:', error);
				await i.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
			}
		});

		collector.on('end', async () => {
			// Cleanup if needed
			try {
				await message.edit({ components: [] });
			} catch (error) {
				this.container.logger.error('Error cleaning up message:', error);
			}
		});

		return message;
	}
}
