import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin dashboard — Ever After",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
