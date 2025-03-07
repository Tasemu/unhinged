import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Set the channel id for recruiter chat'
})
export class RecruiterChannelCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		this.container.logger.debug(this.name);

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'channelId',
					description: 'The channel id',
					type: ApplicationCommandOptionType.Channel,
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

		const channel = interaction.options.getChannel('channelId', true);

		await prisma.configuration.upsert({
			where: { guildId: interaction.guild.id },
			update: { recruiterChannelId: channel.id },
			create: {
				guildId: interaction.guild.id,
				recruiterChannelId: channel.id
			}
		});

		return interaction.reply(`✅ Recruiter channel set to : ${channel.name}!`);
	}
}
