import { CircleAlert } from 'lucide-react';

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      <CircleAlert className="h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}
