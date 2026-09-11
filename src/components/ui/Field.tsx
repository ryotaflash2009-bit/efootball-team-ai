import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

const CONTROL =
  "w-full rounded-md border bg-surface-2 px-3 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus-visible:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const H = "h-10";

function Wrap({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-text-dim">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-2xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-2xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Wrap label={label} hint={hint} error={error} htmlFor={fieldId}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={`${CONTROL} ${H} ${error ? "border-danger" : "border-border"} ${className}`}
        {...rest}
      />
    </Wrap>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  ...rest
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Wrap label={label} hint={hint} error={error} htmlFor={fieldId}>
      <select
        id={fieldId}
        className={`${CONTROL} ${H} cursor-pointer appearance-none bg-[right_0.6rem_center] bg-no-repeat pr-9 ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239aa6b0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m5 9 7 7 7-7'/></svg>\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  );
}

/** ラベルなしのプレーンなコントロールクラス（既存フォームの段階的移行用）。 */
export const controlClass = `${CONTROL} ${H} border-border`;
