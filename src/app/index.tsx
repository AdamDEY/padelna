import { NextMatchCard, type NextMatch } from "@/components/next-match-card";
import { Page } from "@/components/page";

// Mock data until the matches API exists
function inDays(days: number, hours: number, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const nextMatch: NextMatch = {
  id: "match-1",
  startsAt: inDays(2, 18),
  clubName: "Lac Padel Arena",
  courtName: "Court 2",
  players: [
    { id: "p-youssef", firstName: "Youssef", lastName: "Ben Ali" },
    { id: "p-amine", firstName: "Amine", lastName: "Khelifi" },
    { id: "p-mehdi", firstName: "Mehdi", lastName: "Trabelsi" },
    { id: "p-sarra", firstName: "Sarra", lastName: "Hamdi" },
  ],
};

export default function Home() {
  return (
    <Page>
      <Page.Body>
        <NextMatchCard match={nextMatch} />
      </Page.Body>
    </Page>
  );
}
