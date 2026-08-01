import React from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteSlipDialog({ toDelete, onOpenChange, onConfirm }) {
  return (
    <AlertDialog open={!!toDelete} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader><AlertDialogTitle>Hapus slip?</AlertDialogTitle><AlertDialogDescription>Slip <b>{toDelete?.no}</b> ({toDelete?.karyawan_nama}) akan dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" data-testid="payroll-delete-confirm" onClick={onConfirm}>Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
