export const CATEGORIES = [
  "Bride’s Family",
  "Groom’s Family",
  "Groom’s Friend",
  "Bride’s Friend",
  "Church Leader",
] as const;

export type GuestCategory = (typeof CATEGORIES)[number] | "Uncategorised";

export type Guest = {
  id: number;
  code: string;
  name: string;
  category: string;
  seats: number;
  plusOne: boolean;
  plusOneName: string;
  ceremony: boolean;
  reception: boolean;
  table: number | null;
  checked: boolean;
};

export type ReceptionTable = {
  id: number;
  name: string;
  capacity: number;
};

export type GuestRow = {
  id: number;
  invitation_code: string;
  name: string;
  category: string;
  reserved_seats: number;
  plus_one_allowed: boolean;
  plus_one_name: string;
  attending_ceremony: boolean;
  attending_reception: boolean;
  table_id: number | null;
  checked_in_at: string | null;
};

export type TableRow = {
  id: number;
  name: string;
  capacity: number;
};
