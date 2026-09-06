"use client";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export function SubmitButton({ children, pendingText, disabled, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || disabled}>
      {pending && <Spinner className="h-4 w-4" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
