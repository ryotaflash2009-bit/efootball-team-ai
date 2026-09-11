import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import type { ButtonVariant } from "./Button";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "border border-border-strong bg-surface-2 text-text hover:border-accent",
  ghost: "text-text-dim hover:bg-surface-2 hover:text-text",
  danger: "border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20",
  outline: "border border-border text-text hover:border-accent hover:bg-surface-2",
};

/** アイコンのみのボタン。aria-label 必須。 */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = 36,
  className = "",
  ...rest
}: {
  icon: IconName;
  label: string;
  variant?: ButtonVariant;
  size?: number;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </button>
  );
}
