import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, AutocompleteInteraction, InteractionContextType } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Delete a composition for group content'
})
export class DeleteCompCommand extends Command {
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

		const id = interaction.options.getString('name', true);

		try {
			const deletedComposition = await prisma.composition.delete({
				where: {
					guildId: interaction.guild.id,
					userId: interaction.user.id,
					id
				}
			});

			return interaction.reply(`✅ Composition deleted with name: ${deletedComposition.name}`);
		} catch (error) {
			this.container.logger.error('Delete composition error:', error);
			return interaction.reply('❌ An error occurred while deleting the composition.');
		}
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
