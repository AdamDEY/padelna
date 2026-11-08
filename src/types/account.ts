/** The signed-in player's saved details, as stored */
export type MyAccount = {
  id: string;
  email: string | undefined;
  firstName: string;
  lastName: string;
  /** The 8 digits after +216 */
  phone: string;
  city: string;
  bio: string;
  hand: "right" | "left";
  side: "left" | "right" | "both";
  playStyle: "aggressive" | "balanced" | "defensive" | "tactical";
  /** Missing for players who set up before gender and birthday were asked */
  gender: "male" | "female" | undefined;
  /** "YYYY-MM-DD" */
  birthDate: string | undefined;
  level: number | undefined;
  avatarUrl: string | undefined;
};
