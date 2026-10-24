'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* Shared button component. Radix's Slot handles the "render as a Link
   instead of a <button>" case (asChild) and focus-visible semantics;
   all visual styling stays in Tailwind via cva variants, driven by the
   th-* theme tokens so it still follows light/dark automatically. */

const buttonVariants = cva(
  'group inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap ' +
  'rounded-th-full transition-all duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent focus-visible:ring-offset-2 focus-visible:ring-offset-th-bg ' +
  'disabled:opacity-50 disabled:pointer-events-none ' +
  'active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary:
          'bg-th-accent text-th-accent-fg shadow-[0_1px_2px_rgba(0,0,0,0.08)] ' +
          'hover:shadow-[0_4px_12px_rgba(0,0,0,0.16)] hover:-translate-y-px ' +
          'hover:bg-th-accent-hover',
        secondary:
          'bg-th-surface text-th-text border border-th-border ' +
          'hover:border-th-text/30 hover:bg-th-surface-alt hover:-translate-y-px ' +
          'hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
        ghost:
          'text-th-muted hover:text-th-text hover:bg-th-surface-alt',
        danger:
          'bg-th-changes text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] ' +
          'hover:shadow-[0_4px_12px_rgba(0,0,0,0.16)] hover:-translate-y-px hover:brightness-110',
      },
      size: {
        sm: 'h-8 px-3.5 text-[12px]',
        md: 'h-10 px-4.5 text-[14px]',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    // Radix's Slot requires exactly one element child — it can't carry an
    // extra (even falsy) sibling node alongside the thing it's slotting
    // onto. asChild is for rendering as a Link, which has no loading
    // state anyway, so skip the spinner branch entirely in that case.
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : null}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { buttonVariants }

/* Wrap a trailing icon (e.g. ArrowRight) in this inside a Button to get a
   consistent "nudge forward" micro-interaction on hover/press: the icon
   drifts up-and-right a couple px with its own easing, independent of the
   button's own hover/press transform. */
export function ButtonIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex transition-transform duration-200 ease-out',
        'group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
        'group-active:translate-x-1 group-active:-translate-y-1',
        className
      )}
    >
      {children}
    </span>
  )
}
