import { useId } from 'react'
import { LookupDrawer } from '../../components/lookup-drawer'
import { Field, FieldLabel } from '../../components/field'

export type FormLookupOption = {
  label: string
  value: string
}

export function FormLookupField({
  label,
  onValueChange,
  options,
  placeholder,
  required = false,
  value,
}: {
  label: string
  onValueChange: (value: string) => void
  options: readonly FormLookupOption[]
  placeholder: string
  required?: boolean
  value: string
}) {
  const id = useId()
  return (
    <Field data-entry-field>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      <LookupDrawer id={id} label={label} required={required} options={options}
        value={value} onValueChange={onValueChange} placeholder={placeholder} />
    </Field>
  )
}
