import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	InteractionContextType
} from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Create a new event for group content'
})
export class CreateEventCommand extends Command {
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
					name: 'name',
					description: 'The name for the composition',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'date',
					description: 'The date for the event (YYYY-MM-DD)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'time',
					description: 'The time for the event (HH:MM)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'composition',
					description: 'The name of the composition to use',
					type: ApplicationCommandOptionType.String,
					required: true,
					autocomplete: true
				}
			],
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const name = interaction.options.getString('name', true);
		const date = interaction.options.getString('date', true);
		const time = interaction.options.getString('time', true);

		// Validate date and time format
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
			return interaction.reply('❌ Invalid date or time format. Use YYYY-MM-DD for date and HH:MM for time.');
		}

		// Check if the date and time are in the future
		const eventDate = new Date(`${date}T${time}`);
		if (eventDate <= new Date()) {
			return interaction.reply('❌ The event date and time must be in the future.');
		}

		const compositionId = interaction.options.getString('composition', true);

		const newEvent = await prisma.event.create({
			data: {
				guildId: interaction.guild.id,
				userId: interaction.user.id,
				name: name,
				date: new Date(`${date}T${time}`),
				compositionId: compositionId
			},
			include: {
				composition: true
			}
		});

		if (!newEvent) {
			return interaction.reply('❌ An error occurred while creating the event.');
		}

		// Build the embed
		const eventEmbed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle(newEvent.name)
			.setDescription(`**Event Details**`)
			.addFields(
				{ name: '📅 Date', value: `<t:${Math.floor(newEvent.date.getTime() / 1000)}:R>`, inline: true },
				{ name: '🛠️ Composition', value: newEvent.composition.name, inline: true },
				{ name: '👥 Participants', value: '', inline: false }
			)
			.setFooter({ text: `Event ID: ${newEvent.id}` });

		// Add role slots
		newEvent.composition.roles.split(', ').forEach((role) => {
			eventEmbed.addFields({
				name: `⬜ ${role}`,
				value: ``,
				inline: false
			});
		});

		// Create action buttons
		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`event-signup:${newEvent.id}`).setLabel('Sign Up').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId(`event-leave:${newEvent.id}`).setLabel('Leave Event').setStyle(ButtonStyle.Danger)
		);

		// In your chatInputRun after sending the reply:
		const replyMessage = await interaction.reply({
			embeds: [eventEmbed],
			components: [buttons],
			fetchReply: true
		});

		// Update the event with message details
		await prisma.event.update({
			where: { id: newEvent.id },
			data: {
				messageId: replyMessage.id,
				channelId: replyMessage.channelId
			}
		});

		return replyMessage;
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);
		const input = focusedOption.value.trim();

		try {
			const compositions = await prisma.composition.findMany({
				where: { name: { contains: input }, userId: interaction.user.id },
				take: 25
			});

			const choices = compositions.map((composition) => ({
				name: composition.name,
				value: composition.id
			}));

			return interaction.respond(choices);
		} catch (error) {
			this.container.logger.error('Autocomplete error:', error);
			return interaction.respond([]);
		}
	}
}
