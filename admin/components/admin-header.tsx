import Link from "next/link";
import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";

export async function AdminHeader() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href="/" className="font-medium">
        Uni Chatbot Admin
      </Link>
      <UserMenu email={session.user.email} isSuperAdmin={session.user.isSuperAdmin} />
    </header>
  );
}
