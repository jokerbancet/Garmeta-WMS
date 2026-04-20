// src/components/ui/DynamicIcon.tsx
import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';

interface DynamicIconProps extends LucideProps {
  name: string;
}

export const DynamicIcon = ({ name, ...props }: DynamicIconProps) => {
  const IconComponent = (LucideIcons as any)[name];
  
  if (!IconComponent) {
    return <LucideIcons.HelpCircle {...props} />;
  }

  return <IconComponent {...props} />;
};
