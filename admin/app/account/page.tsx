import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "../../lib/authorize";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <main className="flex justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
