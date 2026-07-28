import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Unauthenticated pages (just /login, in practice) render standalone —
  // there's no sidebar to show until there's a signed-in user.
  if (!session?.user) return <>{children}</>;

  return (
    <SidebarProvider>
      <AppSidebar isSuperAdmin={session.user.isSuperAdmin} />
      <SidebarInset>
        <header className="flex items-center justify-between border-b px-4 py-2">
          <SidebarTrigger />
          <UserMenu email={session.user.email} isSuperAdmin={session.user.isSuperAdmin} />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
