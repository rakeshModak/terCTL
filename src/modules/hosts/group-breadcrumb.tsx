import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { BreadcrumbEntry } from './useHostsBrowser'

interface GroupBreadcrumbProps {
  trail: BreadcrumbEntry[]
  /** Called with the depth to truncate the open path to. */
  onNavigate: (depth: number) => void
}

/** Root-to-current group trail. The last entry is the group being viewed. */
export function GroupBreadcrumb({ trail, onNavigate }: GroupBreadcrumbProps) {
  return (
    <Breadcrumb className="mb-5">
      <BreadcrumbList>
        {trail.map((entry, i) => {
          const last = i === trail.length - 1
          return (
            <BreadcrumbItem key={entry.id ?? 'root'}>
              {last ? (
                <BreadcrumbPage className="font-medium">{entry.name}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink
                    render={
                      <button
                        type="button"
                        onClick={() => onNavigate(i)}
                        className="cursor-pointer"
                      />
                    }
                  >
                    {entry.name}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
