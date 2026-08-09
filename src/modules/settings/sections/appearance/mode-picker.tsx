import { Monitor, Moon, Sun } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ThemeMode } from '@/lib/theme';

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

interface ModePickerProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

export default function ModePicker({ value, onChange }: Readonly<ModePickerProps>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (typeof next === 'string') onChange(next as ThemeMode);
      }}
    >
      <TabsList aria-label="Color mode" className={"py-6"}>
        {OPTIONS.map(({ value: mode, label, Icon }) => (
          <TabsTrigger key={mode} value={mode} className={"w-30 py-5"}>
            <Icon />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
