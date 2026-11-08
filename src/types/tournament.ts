export type TournamentCategory = "men" | "women" | "mixed";

/** A tournament players can see on Home while it is open for entries. */
export type UpcomingTournament = {
  id: string;
  name: string;
  category: TournamentCategory;
  startsAt?: Date;
  clubName?: string;
};
