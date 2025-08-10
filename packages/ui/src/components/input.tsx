import * as React from 'react';
import { cn, getTextDirection } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  autoDirection?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, autoDirection = true, onChange, ...props }, ref) => {
    const [direction, setDirection] = React.useState<'ltr' | 'rtl'>('ltr');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (autoDirection) {
        const newDirection = getTextDirection(e.target.value);
        setDirection(newDirection);
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        dir={autoDirection ? direction : undefined}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input }; 