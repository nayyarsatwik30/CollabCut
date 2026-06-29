'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'approve'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:  'bg-th-accent text-th-accent-fg hover:opacity-90',
  secondary:'bg-th-surface-alt text-th-text border border-th-border hover:bg-th-surface-hov',
  ghost:    'bg-transparent text-th-muted hover:text-th-text hover:bg-th-surface-alt',
  danger:   'bg-transparent text-th-changes border border-th-changes/40 hover:bg-th-changes/10',
  approve:  'bg-th-resolved text-white hover:opacity-90',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-7  px-3   text-xs  gap-1.5',
  md: 'h-9  px-4   text-sm  gap-2',
  lg: 'h-11 px-5   text-sm  gap-2   font-semibold',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', fullWidth, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base
          'inline-flex items-center justify-center font-medium select-none',
          'rounded-th transition-all duration-100 ease-out',
          'btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent',
          'disabled:opacity-40 disabled:pointer-events-none',
          // Variant
          variantClasses[variant],
          // Size
          sizeClasses[size],
          // Width
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
