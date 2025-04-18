import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
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

		const newComposition = await prisma.composition.create({
			data: {
				guildId: interaction.guild.id,
				userId: interaction.user.id,
				name: name,
				roles: rolesString
			}
		});

		return interaction.reply(`✅ Composition created with name: ${newComposition.name}`);
	}
}
