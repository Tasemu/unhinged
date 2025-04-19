import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Create a new composition for group content'
})
export class NewCompCommand extends Command {
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
					name: 'roles',
					description: 'E.g. Tank, Healer, DPS',
					type: ApplicationCommandOptionType.String,
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

		const name = interaction.options.getString('name', true);
		const rolesString = interaction.options.getString('roles', true);

		// Check if the composition already exists
		const existingComposition = await prisma.composition.findFirst({
			where: {
				guildId: interaction.guild.id,
				name: name
			}
		});

		if (existingComposition) {
			return interaction.reply({
				content: `❌ A composition with the name "${name}" already exists.`,
				flags: MessageFlags.Ephemeral
			});
		}

		// Check the roles string is in the format "Tank, Healer, DPS"
		const rolesRegex = /^[a-zA-Z0-9\s,]+$/;
		if (!rolesRegex.test(rolesString)) {
			return interaction.reply({
				content: '❌ Invalid roles format. Please use the format: "Tank, Healer, DPS".',
				flags: MessageFlags.Ephemeral
			});
		}

		// Check if the roles string is in the correct format
		const rolesArray = rolesString.split(',').map((role) => role.trim());
		if (rolesArray.length < 1) {
			return interaction.reply({
				content: '❌ Please provide at least one role in the format: "Tank, Healer, DPS".',
				flags: MessageFlags.Ephemeral
			});
		}

		try {
			const newComposition = await prisma.composition.create({
				data: {
					guildId: interaction.guild.id,
					userId: interaction.user.id,
					name: name,
					roles: rolesString
				}
			});

			return interaction.reply({
				content: `✅ Composition created with name: ${newComposition.name}`,
				flags: MessageFlags.Ephemeral
			});
		} catch (error) {
			this.container.logger.error('Create composition error:', error);
			return interaction.reply({
				content: '❌ An error occurred while creating the composition.',
				flags: MessageFlags.Ephemeral
			});
		}
	}
}
