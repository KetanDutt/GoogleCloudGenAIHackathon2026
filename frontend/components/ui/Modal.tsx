"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { Button, FormError } from "./Primitives";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal-content ${wide ? "max-w-2xl" : "max-w-lg"}`}
        >
          <div className="pr-9">
            <Dialog.Title className="text-xl font-semibold tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Description
              className={
                description
                  ? "mt-2 text-sm leading-relaxed text-muted"
                  : "sr-only"
              }
            >
              {description || title}
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="icon-button absolute right-4 top-4"
            aria-label="Close dialog"
          >
            <X size={19} />
          </Dialog.Close>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  label = "Delete",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<unknown>;
  label?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setError("");
          onOpenChange(value);
        }
      }}
      title={title}
      description={description}
    >
      <div className="space-y-4">
        {children}
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={confirm}>
            {label}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
