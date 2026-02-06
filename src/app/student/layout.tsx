import { redirect } from "next/navigation";
import { getUserRole } from "@/app/auth/getRole";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { role } = await getUserRole();

  if (!role) redirect("/auth/login");
  if (role === "INACTIVE") redirect("/auth/pending");
  if (role !== "STUDENT") redirect("/teacher");

  return <>{children}</>;
}
