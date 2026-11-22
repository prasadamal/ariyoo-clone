/** Crew rules with no phone dependencies (unit-tested). See crew.ts for the cloud calls. */
type TripShareFields = { my_role?: string | null; owner_id?: string | null; crew_count?: number | null };

export type TripRole = 'owner' | 'admin' | 'member';

export type CrewPerson = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  role: TripRole;
};

export type Traveller = { id: string; username: string; display_name: string | null; avatar_path: string | null };

export const tripRole = (trip: Pick<TripShareFields, 'my_role'>): TripRole => (trip.my_role as TripRole) || 'owner';

/** Owner and admins change things; members only look. */
export const canEditTrip = (trip: Pick<TripShareFields, 'my_role'>) => tripRole(trip) !== 'member';

export const isSharedTrip = (trip: Pick<TripShareFields, 'owner_id' | 'crew_count'>) => Boolean(trip.owner_id) || (trip.crew_count ?? 0) > 1;

export const ROLE_LABEL: Record<TripRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };

export const personName = (p: Pick<CrewPerson, 'display_name' | 'username'>) => p.display_name || (p.username ? `@${p.username}` : 'Traveller');

/** A normalised handle: "@Anna.K " → "anna.k". */
export const cleanHandle = (text: string) => text.trim().replace(/^@+/, '').toLowerCase();

export const validHandle = (handle: string) => /^[a-z0-9_.]{3,24}$/.test(handle);

