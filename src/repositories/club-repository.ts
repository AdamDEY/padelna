import { supabase } from "@/lib/supabase";
import type { Club, ClubStatus } from "@/types/club";

const LOGO_BUCKET = "club-logos";

type ClubRow = {
  id: string;
  name: string;
  area: string;
  city: string;
  region: string;
  address: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  facilities: string[];
  logo_path: string | null;
  status: ClubStatus;
  closed_note: string | null;
  courts: { id: string; number: number; indoor: boolean; active: boolean }[];
  club_hours: { day: number; closed: boolean; opens_at: string | null; closes_at: string | null }[];
  club_photos: { count: number }[];
};

const CLUB_SELECT = `
  id, name, area, city, region, address, description, latitude, longitude,
  phone, whatsapp, website, instagram, facebook, facilities, logo_path, status, closed_note,
  courts(id, number, indoor, active),
  club_hours(day, closed, opens_at, closes_at),
  club_photos(count)
`;

/** "18:30:00" -> "18:30" */
function toClock(time: string | null) {
  return time ? time.slice(0, 5) : undefined;
}

/** Every club players can see, by name. Drafts stay hidden by the database. */
export async function fetchClubs(): Promise<Club[]> {
  const { data, error } = await supabase.from("clubs").select(CLUB_SELECT).order("name");
  if (error) throw error;

  return (data as unknown as ClubRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    area: row.area,
    city: row.city,
    region: row.region,
    address: row.address,
    description: row.description,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    phone: row.phone ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    website: row.website ?? undefined,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    facilities: row.facilities,
    status: row.status,
    closedNote: row.closed_note ?? undefined,
    courts: [...row.courts].sort((a, b) => a.number - b.number),
    hours: row.club_hours.map((item) => ({
      day: item.day,
      closed: item.closed,
      opensAt: toClock(item.opens_at),
      closesAt: toClock(item.closes_at),
    })),
    photoCount: row.club_photos[0]?.count ?? 0,
    logoUrl: row.logo_path
      ? supabase.storage.from(LOGO_BUCKET).getPublicUrl(row.logo_path).data.publicUrl
      : undefined,
  }));
}
