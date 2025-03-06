import { Listener, Events } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { prisma } from '../client';

export class TrialMemberAddListener extends Listener<typeof Events.GuildMemberUpdate> {
	public constructor(context: Listener.LoaderContext, options: Listener.Options) {
		super(context, {
			...options,
			event: Events.GuildMemberUpdate
		});
	}

	public async run(oldMember: GuildMember, newMember: GuildMember) {
		this.container.logger.debug('TrialMemberAddListener');
		// Configure your trial role ID here
		const TRIAL_ROLE_ID = 'Trial';

		// Check if trial role was added
		const addedRoles = newMember.roles.cache.difference(oldMember.roles.cache).filter((role) => role.name === TRIAL_ROLE_ID);

		if (addedRoles.size === 0) return;

		try {
			// Store in database
			await prisma.trialStart.create({
				data: {
					userId: newMember.id,
					guildId: newMember.guild.id
				}
			});

			this.container.logger.info(`Trial start recorded for ${newMember.user.tag}`);
		} catch (error) {
			this.container.logger.error('Error recording trial start:', error);
		}
	}
}
