'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* Shared button component. Radix's Slot handles the "render as a Link
   instead of a <button>" case (asChild) and focus-visible semantics.
   The look (pill, lime / solid / outline / ghost, 600 weight, 2px hover lift,
   focus ring) lives in the .btn classes in globals.css, which follow the
   Dark/Light tokens. Sizes only set the height, padding and font size: md and
   lg are the 48px / 15px board buttons; sm and xs are compact sizes for dense
   toolbars and rows. */

const buttonVariants = cva(
  'btn group',
  {
    variants: {
      variant: {
        primary: 'btn-primary',
        solid: 'btn-solid',
        outline: 'btn-outline',
        secondary: 'btn-outline',
        ghost: 'btn-ghost',
        danger: 'btn-danger',
        dangerOutline: 'btn-danger-outline',
      },
      size: {
        xs: '[--btn-h:28px] [--btn-px:12px] [--btn-fs:11px] gap-1.5',
        sm: '[--btn-h:36px] [--btn-px:14px] [--btn-fs:12px]',
        md: '[--btn-px:22px]',
        lg: '[--btn-px:28px]',
        icon: '[--btn-h:36px] [--btn-px:0px] w-9',
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
