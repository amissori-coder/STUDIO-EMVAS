"use client";
import { Button, type ButtonProps } from "@/components/ui/Button";

/** Bottone di submit che chiede conferma prima di inviare il form che lo contiene. */
export function ConfirmButton({ message, children, ...props }: ButtonProps & { message: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </Button>
  );
}
