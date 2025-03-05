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
		// Configure your trial role ID here
		const TRIAL_ROLE_ID = 'YOUR_TRIAL_ROLE_ID_HERE';

		// Check if trial role was added
		const addedRoles = newMember.roles.cache.difference(oldMember.roles.cache).filter((role) => role.id === TRIAL_ROLE_ID);

		if (addedRoles.size === 0) return;

		try {
			// Store in database
			await prisma.trialStart.upsert({
				where: { userId: newMember.id },
				update: { startTime: new Date() },
				create: {
					userId: newMember.id,
					guildId: newMember.guild.id,
					startTime: new Date()
				}
			});

			this.container.logger.info(`Trial start recorded for ${newMember.user.tag}`);
		} catch (error) {
			this.container.logger.error('Error recording trial start:', error);
		}
	}
}
