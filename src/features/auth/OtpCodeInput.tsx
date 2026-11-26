"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const LENGTH = 6;

export const OtpCodeInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    hasError?: boolean;
    describedBy?: string;
  }
>(function OtpCodeInput({ value, onChange, disabled, hasError, describedBy }, ref) {
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, index) => value[index] ?? "");

  React.useImperativeHandle(ref, () => inputsRef.current[0] as HTMLInputElement);

  const commitDigits = (next: string[]) => {
    onChange(next.join("").slice(0, LENGTH));
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      commitDigits(next);
      return;
    }

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let offset = 0; offset < cleaned.length && index + offset < LENGTH; offset += 1) {
        next[index + offset] = cleaned[offset] ?? "";
      }
      commitDigits(next);
      const focusAt = Math.min(index + cleaned.length, LENGTH - 1);
      inputsRef.current[focusAt]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    commitDigits(next);
    if (index < LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      commitDigits(next);
      inputsRef.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < LENGTH - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    const focusAt = Math.min(pasted.length, LENGTH - 1);
    inputsRef.current[focusAt]?.focus();
  };

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      aria-describedby={describedBy}
      className="grid grid-cols-6 gap-2"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          aria-invalid={hasError ? "true" : undefined}
          disabled={disabled}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            "h-12 w-full rounded-control border bg-[#13151b] text-center font-mono text-lg font-semibold text-ink transition-colors focus-visible:border-action-link disabled:cursor-not-allowed disabled:opacity-50",
            hasError ? "border-error" : "border-control",
          )}
        />
      ))}
    </div>
  );
});
