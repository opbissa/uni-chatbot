import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { AdminHeader } from "@/components/admin-header";
import "./globals.css";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Uni Chatbot Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <AdminHeader />
        {children}
      </body>
    </html>
  );
}
