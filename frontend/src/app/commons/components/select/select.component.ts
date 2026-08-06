import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string | number;
  label: string;
}

let nextId = 0;

@Component({
  selector: 'pt-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder?: string;
  @Input() options: SelectOption[] = [];

  value: string | number | null = null;
  disabled = false;

  private selectIdSuffix = ++nextId;
  get selectId() {
    return `pt-select-${this.selectIdSuffix}`;
  }

  onChange: (value: string | number | null) => void = () => {};
  onTouched: () => void = () => {};

  onSelect(event: Event) {
    const raw = (event.target as HTMLSelectElement).value;
    this.value = raw;
    this.onChange(raw);
  }

  writeValue(value: string | number | null): void {
    this.value = value;
  }
  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
