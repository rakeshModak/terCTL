import { useState, type FormEvent } from 'react'
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <GroupForm
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          placeholder={placeholder}
          initialValue={initialValue}
          onSubmit={(next) => {
            onSubmit(next)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function GroupForm({
  title,
  description,
  confirmLabel,
  placeholder,
  initialValue,
  onSubmit,
}: {
  title: string
  description: string
  confirmLabel: string
  placeholder?: string
  initialValue: string
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState(initialValue)
  const trimmed = name.trim()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
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
  )
}
