import { useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './sheet';
import { nextEntryControl } from '../lib/entry-focus';
import { cn } from '../lib/utils';

export type LookupOption = { label: string; value: string };
export type LookupDrawerProps = {
  id?: string;
  label: string;
  value: string;
  options: readonly LookupOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

/** One selection/search pattern for all LogicX entry-form lookups. */
export function LookupDrawer({ id, label, value, options, onValueChange, placeholder,
  allowCustom, required, invalid, disabled, loading, error, onRetry }: LookupDrawerProps) {
  const generatedId = useId();
  const triggerId = id ?? `lookup-${generatedId}`;
  const searchId = `${triggerId}-search`;
  const listId = `${triggerId}-results`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const advance = useRef(false);
  const matches = useMemo(() => options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [options, query]);
  const customValue = query.trim();
  const canUseCustom = allowCustom && customValue && !options.some(option => option.value.toLocaleLowerCase() === customValue.toLocaleLowerCase());
  const selected = options.find((option) => option.value === value);

  function choose(option: LookupOption) {
    onValueChange(option.value);
    advance.current = true;
    setOpen(false);
  }

  function moveHighlight(next: number) {
    if (!matches.length) return;
    const index = (next + matches.length) % matches.length;
    setHighlight(index);
    document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' });
  }

  return <Sheet open={open} onOpenChange={(next) => {
    if (next) { advance.current = false; setQuery(''); setHighlight(0); }
    setOpen(next);
  }}>
    <SheetTrigger render={<Button id={triggerId} type="button" role="combobox"
      aria-label={label} aria-required={required} aria-invalid={invalid} aria-haspopup="dialog"
      data-lookup-trigger data-lookup-value={value} disabled={disabled} variant="outline"
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setQuery(''); setHighlight(0); advance.current = false; setOpen(true); }
      }}
      className="h-11 w-full justify-between gap-3 rounded-lg bg-background px-3 font-normal">
      <span className={cn('truncate', !value && 'text-muted-foreground')}>{selected?.label || value || placeholder || `Select ${label.toLowerCase()}`}</span>
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
    </Button>} />
    <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      initialFocus={() => document.getElementById(searchId)}
      finalFocus={() => {
        const trigger = document.getElementById(triggerId);
        return advance.current ? nextEntryControl(trigger) ?? trigger : trigger;
      }}>
      <SheetHeader className="border-b bg-muted/30 px-6 py-6 pr-12">
        <span className="mb-3 flex size-10 items-center justify-center rounded-xl border bg-background"><SearchIcon className="size-4" /></span>
        <SheetTitle className="text-lg font-semibold">Search {label}</SheetTitle>
        <SheetDescription>{allowCustom ? 'Choose an existing value or enter a new one.' : 'Choose an existing value.'} Selection returns you to the next field.</SheetDescription>
      </SheetHeader>
      <div className="border-b p-4">
        <Input id={searchId} role="combobox" aria-label={`Search ${label}`} aria-controls={listId}
          aria-expanded="true" aria-autocomplete="list"
          aria-activedescendant={matches.length ? `${listId}-${highlight}` : undefined}
          autoComplete="off" placeholder={`Search ${label.toLowerCase()}…`} value={query}
          onChange={(event) => { setQuery(event.target.value); setHighlight(0); }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); moveHighlight(highlight + 1); }
            if (event.key === 'ArrowUp') { event.preventDefault(); moveHighlight(highlight - 1); }
            if (event.key === 'Enter') {
              event.preventDefault(); event.stopPropagation();
              if (!loading && !error) {
                if (matches[highlight]) choose(matches[highlight]);
                else if (canUseCustom) choose({ label: customValue, value: customValue });
              }
            }
          }} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? <p role="status" className="p-3 text-muted-foreground">Loading values…</p> :
          error ? <div role="alert" className="space-y-3 p-3"><p>{error}</p>
            {onRetry && <Button type="button" variant="outline" onClick={onRetry}>Retry</Button>}</div> :
          <div id={listId} role="listbox" aria-label={`${label} results`} className="space-y-1">
            {canUseCustom && <Button type="button" variant="outline" className="mb-2 w-full justify-start"
              onClick={() => choose({ label: customValue, value: customValue })}>Use “{customValue}”</Button>}
            {!matches.length && <p role="status" className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">No existing values match.</p>}
            {matches.map((option, index) => <Button key={option.value} id={`${listId}-${index}`}
              type="button" role="option" aria-selected={option.value === value} variant="ghost"
              className={cn('h-auto min-h-12 w-full justify-between rounded-lg px-3 py-3 text-left font-normal', highlight === index && 'bg-accent')}
              onPointerMove={() => setHighlight(index)} onClick={() => choose(option)}>
              <span className="min-w-0 break-words">{option.label}</span>
              {option.value === value ? <CheckIcon className="size-4 shrink-0" /> : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
            </Button>)}
          </div>}
      </div>
      <div className="border-t bg-muted/20 px-6 py-4 text-xs text-muted-foreground">↑ ↓ to browse · Enter to select · Esc to close</div>
    </SheetContent>
  </Sheet>;
}
