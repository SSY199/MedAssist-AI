import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SosQuickProvider } from "@/components/SosQuickProvider";
import { Navbar } from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <SosQuickProvider>
      <div className="min-h-screen bg-bg text-ink">
        <Navbar userEmail={session.user.email} />
        <main>{children}</main>
      </div>
    </SosQuickProvider>
  );
}
