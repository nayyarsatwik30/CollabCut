'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  'inline-flex items-center justify-center shrink-0 rounded-full ' +
  'transition-all duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent ' +
  'disabled:opacity-40 disabled:pointer-events-none active:scale-90',
  {
    variants: {
      variant: {
        ghost: 'text-th-muted hover:text-th-text hover:bg-th-surface-alt',
        subtle: 'text-th-muted hover:text-th-text bg-th-surface-alt hover:bg-th-border/60',
      },
      size: {
        sm: 'h-7 w-7',
        md: 'h-9 w-9',
        lg: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  asChild?: boolean
  label: string // required: icon-only buttons need an accessible name
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, asChild = false, label, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
IconButton.displayName = 'IconButton'

export { iconButtonVariants }
