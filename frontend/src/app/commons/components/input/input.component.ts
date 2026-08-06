import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

@Component({
  selector: 'pt-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() type: 'text' | 'number' | 'date' = 'text';
  @Input() placeholder = '';
  @Input() prefix?: string;
  @Input() error?: string;
  /** Renders the value in the monospace tabular-number style used across the app. */
  @Input() numeric = false;
  @Input() step: string = 'any';

  value: string | number | null = null;
  disabled = false;

  private inputIdSuffix = ++nextId;
  get inputId() {
    return `pt-input-${this.inputIdSuffix}`;
  }

  onChange: (value: string | number | null) => void = () => {};
  onTouched: () => void = () => {};

  onInput(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = this.type === 'number' ? (raw === '' ? null : Number(raw)) : raw;
    this.value = parsed;
    this.onChange(parsed);
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
