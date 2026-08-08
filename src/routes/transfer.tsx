import { createFileRoute } from '@tanstack/react-router'
import TransferView from '../modules/transfer'

export const Route = createFileRoute('/transfer')({
  component: TransferView,
})
