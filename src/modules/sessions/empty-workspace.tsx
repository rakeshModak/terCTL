import { useNavigate } from '@tanstack/react-router'
import { useSetAtom } from 'jotai'
import { Server, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { openLocalTerminalAtom, setNewTabPickerAtom } from '../../store/app'

/** Shown over the terminal area when no tabs are open. */
export default function EmptyWorkspace() {
  const openLocalTerminal = useSetAtom(openLocalTerminalAtom)
  const setNewTabPicker = useSetAtom(setNewTabPickerAtom)
  const navigate = useNavigate()

  return (
    <div className="absolute inset-0 z-[4] flex items-center justify-center bg-background">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SquareTerminal />
          </EmptyMedia>
          <EmptyTitle>No sessions open</EmptyTitle>
          <EmptyDescription>
            Start a local shell, or open a saved host to get a secure terminal.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => void openLocalTerminal()}>
              <SquareTerminal />
              New local terminal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setNewTabPicker(false)
                navigate({ to: '/hosts' })
              }}
            >
              <Server />
              Browse hosts
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  )
}
