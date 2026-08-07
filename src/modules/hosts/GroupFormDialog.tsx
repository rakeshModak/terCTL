import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface GroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  placeholder?: string
  initialValue?: string
  onSubmit: (name: string) => void
}

export function GroupFormDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  placeholder,
  initialValue = '',
  onSubmit,
}: GroupFormDialogProps) {
  const [name, setName] = useState(initialValue)

  // Reset on each open so a reused dialog never shows the previous group name.
  useEffect(() => {
    if (open) setName(initialValue)
  }, [open, initialValue])

  const trimmed = name.trim()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // This dialog is portalled, but React still bubbles through the component
    // tree — stop here so an enclosing form never submits alongside it.
    e.stopPropagation()
    if (!trimmed) return
    onSubmit(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <Input
            label="Name"
            value={name}
            placeholder={placeholder}
            onChange={(e) => setName(e.currentTarget.value)}
            autoFocus
          />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!trimmed}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
