import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@codexsun/ui/components/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@codexsun/ui/components/field';
import { Input } from '@codexsun/ui/components/input';
import { LookupDrawer } from '@codexsun/ui/components/lookup-drawer';
import { nextEntryControl } from '@codexsun/ui/lib/entry-focus';
import { Textarea } from '@codexsun/ui/components/textarea';
import { cn } from '@codexsun/ui/lib/utils';
import type { MasterField, MasterFormValues } from './types';

export type MasterFormProps = {
  fields: readonly MasterField[];
  values: MasterFormValues;
  onValueChange: (fieldId: string, value: string) => void;
  onSubmit: (values: MasterFormValues) => void | Promise<void>;
  onCancel: () => void;
  title: string;
  description?: string;
  submitLabel?: string;
  formId?: string;
  hideSubmitButton?: boolean;
  compact?: boolean;
  variant?: 'page' | 'panel';
  renderField?: (field: MasterField, control: {
    id: string; value: string; onChange: (value: string) => void; invalid: boolean;
  }) => ReactNode;
};

function fieldControl(
  field: MasterField,
  id: string,
  value: string,
  onChange: (value: string) => void,
  invalid: boolean,
) {
  if (field.type === 'textarea') {
    return (
      <Textarea
        className="min-h-24 rounded-lg"
        aria-invalid={invalid}
        aria-required={field.required}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        value={value}
      />
    );
  }
  if (field.type === 'select' || field.type === 'lookup') {
    return (
      <LookupDrawer id={id} label={field.label} required={field.required} invalid={invalid}
        options={field.options ?? []} value={value} onValueChange={onChange} placeholder={field.placeholder} />
    );
  }
  return (
    <Input
      className="h-11 rounded-lg"
      aria-invalid={invalid}
      aria-required={field.required}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      type={field.type ?? 'text'}
      value={value}
    />
  );
}

export function MasterForm({
  fields,
  values,
  onValueChange,
  onSubmit,
  onCancel,
  title,
  description,
  submitLabel = 'Save',
  formId: providedFormId,
  hideSubmitButton = false,
  variant = 'page',
  compact = false,
  renderField,
}: MasterFormProps) {
  const generatedFormId = useId();
  const resolvedFormId = providedFormId ?? generatedFormId;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors = Object.fromEntries(
      fields
        .filter((field) => field.required && !values[field.id]?.trim())
        .map((field) => [field.id, `${field.label} is required.`]),
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(`${resolvedFormId}-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form
      className={cn('w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-sm', variant === 'panel' && 'max-w-none')}
      data-form-id={resolvedFormId}
      id={resolvedFormId}
      noValidate
      onSubmit={handleSubmit}
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (!event.currentTarget.contains(target) || event.nativeEvent.isComposing) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault(); event.stopPropagation(); event.currentTarget.requestSubmit();
          return;
        }
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
        if (!target.closest('[data-entry-field]') || target.getAttribute('aria-expanded') === 'true') return;
        const lookup = target.closest('[data-lookup-trigger]');
        if (lookup && !lookup.getAttribute('data-lookup-value')) return;
        event.preventDefault();
        event.stopPropagation();
        nextEntryControl(target)?.focus();
      }}
    >
      <header className={cn("border-b bg-muted/30 px-6 py-5", compact && "flex h-12 items-center px-4 py-0")}>
        <h2 className={cn("text-lg font-semibold tracking-tight", compact && "text-sm")}>{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <fieldset disabled={submitting} className="flex min-w-0 flex-col gap-5 p-6">
        {fields.map((field) => {
          const id = `${resolvedFormId}-${field.id}`;
          const error = errors[field.id];
          return (
            <Field
              data-entry-field
              data-invalid={Boolean(error)}
              key={field.id}
            >
              <FieldLabel htmlFor={id}>
                {field.label}
                {field.required ? (
                  <span aria-hidden="true" className="text-destructive">
                    {' '}
                    *
                  </span>
                ) : null}
              </FieldLabel>
              {renderField?.(field, {
                id,
                value: values[field.id] ?? '',
                onChange: (value) => {
                  onValueChange(field.id, value);
                  if (error) setErrors((current) => ({ ...current, [field.id]: '' }));
                },
                invalid: Boolean(error),
              }) ?? fieldControl(
                field,
                id,
                values[field.id] ?? '',
                (value) => {
                  onValueChange(field.id, value);
                  if (error) setErrors((current) => ({ ...current, [field.id]: '' }));
                },
                Boolean(error),
              )}
              {!compact && field.placeholder ? <FieldDescription>{field.placeholder}</FieldDescription> : null}
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          );
        })}
      </fieldset>
      {!compact && <div className="border-t bg-muted/20 px-6 py-3 text-xs text-muted-foreground">Enter: next field · Shift+Enter: new line · Ctrl/Cmd+S: save</div>}
      {!hideSubmitButton && <footer className="flex justify-end gap-2 border-t p-4">
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        {!hideSubmitButton ? (
          <Button disabled={submitting} type="submit">
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        ) : null}
      </footer>}
    </form>
  );
}
