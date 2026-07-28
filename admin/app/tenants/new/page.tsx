import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "../../../lib/authorize";
import { NewTenantForm } from "./new-tenant-form";

export default async function NewTenantPage() {
  const user = await requireUser();
  if (!user.isSuperAdmin) notFound();

  return (
    <main className="flex justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>New tenant</CardTitle>
          <CardDescription>Onboard a new university.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewTenantForm />
        </CardContent>
      </Card>
    </main>
  );
}
