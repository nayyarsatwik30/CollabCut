'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* Round icon-only button. The look (40px disc, sm 32, lg 44, huge 72 with the
   lime ring + glow) lives in the .disc classes in globals.css so it follows
   the Dark/Light tokens and keeps a 40px touch target on mobile. `label` is
   required: icon-only buttons need an accessible name. */
const iconButtonVariants = cva('disc', {
  variants: {
    variant: {
      ghost: 'disc-ghost',
      subtle: 'disc-subtle',
      outline: 'disc-outline',
      glass: 'disc-glass',
      primary: 'disc-primary',
      danger: 'disc-danger',
      delete: 'disc-delete',
    },
    size: {
      xs: 'disc-xs',
      sm: 'disc-sm',
      md: '',
      lg: 'disc-lg',
      huge: 'disc-huge',
    },
  },
  defaultVariants: { variant: 'ghost', size: 'md' },
})

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
