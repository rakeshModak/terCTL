import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

interface InputProps extends React.ComponentProps<'input'> {
  label?: string
  error?: string
}

function Input({ className, type, label, error, id, ...props }: InputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  const input = (
    <InputPrimitive
      type={type}
      id={inputId}
      data-slot="input"
      aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={error ? errorId : props['aria-describedby']}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring/30 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )

  if (!label && !error) return input

  return (
    <div className="w-full">
      {label && (
        <Label className="mb-2" htmlFor={inputId}>
          {label}
        </Label>
      )}
      {input}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export { Input }
export type { InputProps }
