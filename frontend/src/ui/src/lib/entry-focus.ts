/** Shared entry-form focus order, including controls rendered through lookup drawers. */
export function nextEntryControl(current: HTMLElement | null): HTMLElement | null {
  const form = current?.closest('form');
  if (!current || !form) return null;
  const fields = Array.from(form.querySelectorAll<HTMLElement>('[data-entry-field]'));
  const index = fields.findIndex((field) => field.contains(current));
  const selector = 'input:not([type="hidden"]),textarea,select,button[role="combobox"]';
  for (const field of fields.slice(index + 1)) {
    const control = field.querySelector<HTMLElement>(selector);
    if (control && !control.matches(':disabled') && control.getClientRects().length) return control;
  }
  return form.querySelector<HTMLElement>('button[type="submit"]')
    ?? form.ownerDocument.querySelector<HTMLElement>('[data-entry-save="true"]');
}
