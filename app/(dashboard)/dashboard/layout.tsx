import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

// Never statically pre-render dashboard pages — requires auth at runtime
export const dynamic = "force-dynamic";

const hasClerkKeys =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only enforce auth when Clerk is fully configured
  if (hasClerkKeys) {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) redirect("/login");
  }

  return <DashboardShell hasClerkKeys={hasClerkKeys}>{children}</DashboardShell>;
}
