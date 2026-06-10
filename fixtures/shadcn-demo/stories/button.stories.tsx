/**
 * Storybook stories for the fixture. Not consumed by the prototype
 * (Storybook enrichment is deferred); present so the fixture stays a
 * realistic shadcn project shape for later phases.
 */
import { Button } from '@/components/ui/button';

export default {
  title: 'UI/Button',
  component: Button,
};

export const Default = { args: { children: 'Button' } };
export const Destructive = { args: { variant: 'destructive', children: 'Delete' } };
export const Outline = { args: { variant: 'outline', children: 'Outline' } };
export const Small = { args: { size: 'sm', children: 'Small' } };
