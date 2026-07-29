"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { approvePdf, rejectPdf } from "./actions";

export function PdfRowActions({ tenantId, docId }: { tenantId: string; docId: string }) {
  const [openDialog, setOpenDialog] = useState<"approve" | "reject" | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmApprove() {
    setPending(true);
    await approvePdf(tenantId, docId);
    setPending(false);
    setOpenDialog(null);
  }

  async function confirmReject() {
    setPending(true);
    await rejectPdf(tenantId, docId);
    setPending(false);
    setOpenDialog(null);
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <AlertDialog
        open={openDialog === "approve"}
        onOpenChange={(open) => setOpenDialog(open ? "approve" : null)}
      >
        <AlertDialogTrigger render={<Button size="sm" />}>Approve</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be queued for extraction and added to the knowledge base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove} disabled={pending}>
              {pending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={openDialog === "reject"}
        onOpenChange={(open) => setOpenDialog(open ? "reject" : null)}
      >
        <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>
          Reject
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              It won't be processed into the knowledge base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              disabled={pending}
              variant="destructive"
            >
              {pending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
