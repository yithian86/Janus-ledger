import { Component, Input, Output, EventEmitter, TemplateRef, ContentChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn<T = any> {
  key: string;
  header: string;
  /** Right-align + monospace tabular styling — use for any numeric/currency column. */
  numeric?: boolean;
  sortable?: boolean;
  accessor?: (row: T) => string | number | null | undefined;
  width?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

@Component({
  selector: 'pt-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent<T = any> {
  @Input() columns: TableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() emptyMessage = 'No records yet.';
  @Input() trackByFn?: (row: T) => unknown;
  @Input() sortKey: string | null = null;
  @Input() sortDirection: SortDirection = null;

  @Output() rowClick = new EventEmitter<T>();
  @Output() sortChange = new EventEmitter<{ key: string; direction: SortDirection }>();

  @ContentChild(TemplateRef) cellTemplate?: TemplateRef<unknown>;

  onSort(key: string) {
    let direction: SortDirection = 'asc';
    if (this.sortKey === key) {
      direction = this.sortDirection === 'asc' ? 'desc' : this.sortDirection === 'desc' ? null : 'asc';
    }
    this.sortKey = direction ? key : null;
    this.sortDirection = direction;
    this.sortChange.emit({ key, direction });
  }

  cellValue(row: T, col: TableColumn<T>): string | number | null | undefined {
    return col.accessor ? col.accessor(row) : (row as Record<string, any>)[col.key];
  }
}
