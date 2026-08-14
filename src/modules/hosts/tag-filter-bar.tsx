import { Badge } from '@/components/ui/badge';

interface TagFilterBarProps {
  tags: string[];
  value: string | null;
  onChange: (tag: string | null) => void;
}

export default function TagFilterBar({
  tags,
  value,
  onChange,
}: TagFilterBarProps) {
  if (tags.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {['All', ...tags].map((tag) => {
        const isAll = tag === 'All';
        const active = isAll ? value === null : value === tag;
        return (
          <Badge
            key={tag}
            variant={active ? 'default' : 'outline'}
            render={
              <button
                type="button"
                onClick={() => onChange(isAll ? null : tag)}
              />
            }
            aria-pressed={active}
          >
            {tag}
          </Badge>
        );
      })}
    </div>
  );
}
