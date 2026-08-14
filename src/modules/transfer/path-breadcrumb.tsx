import { Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { pathSegments } from '@/lib/path';

interface PathBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

/** Clickable path trail; the last segment is the folder currently open. */
export default function PathBreadcrumb({ path, onNavigate }: PathBreadcrumbProps) {
  const segments = pathSegments(path);

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1 text-xs sm:gap-1">
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <button type="button" onClick={() => onNavigate('/')} title="Root" />
            }
          >
            <Home className="size-3.5" />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, i) => {
          const last = i === segments.length - 1;
          return (
            <BreadcrumbItem key={segment.path} className="min-w-0">
              <BreadcrumbSeparator />
              {last ? (
                <BreadcrumbPage className="truncate font-medium">{segment.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={
                    <button
                      type="button"
                      onClick={() => onNavigate(segment.path)}
                      className="truncate"
                    />
                  }
                >
                  {segment.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
