import type { LucideIcon } from 'lucide-react';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'xs' | 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-xs hover:bg-brand-700',
  secondary: 'border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
  danger: 'border border-rose-200 bg-white text-rose-700 shadow-xs hover:bg-rose-50',
  success: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700',
};

const SIZES: Record<Size, string> = {
  xs: 'h-7 gap-1 rounded-md px-2 text-xs',
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[13px]',
  md: 'h-9 gap-1.5 rounded-lg px-3 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  const iconOnly = !children;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        iconOnly && (size === 'md' ? 'w-9 px-0' : size === 'sm' ? 'w-8 px-0' : 'w-7 px-0'),
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className={size === 'xs' ? 'size-3.5' : 'size-4'} aria-hidden /> : null}
      {children}
    </button>
  );
}
