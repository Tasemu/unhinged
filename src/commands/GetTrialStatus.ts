import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Get the remaining trial time for a user'
})
export class GetTrialStatusCommand extends Command {
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
					description: 'The user to query',
					type: ApplicationCommandOptionType.User,
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

		const user = interaction.options.getUser('user', true);

		const trial = await prisma.trialStart.findUnique({
			where: {
				userId: user.id
			}
		});

		if (!trial) {
			return interaction.reply('User is not on trial!');
		}

		const trialEnd = new Date(trial.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
		const now = new Date();
		const timeRemaining = trialEnd.getTime() - now.getTime();

		const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
		const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
		const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

		return interaction.reply(`Trial for ${user.displayName} ends in ${days} days, ${hours} hours, and ${minutes} minutes`);
	}
}
