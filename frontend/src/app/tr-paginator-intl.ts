import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Turkish labels for Material paginators. */
@Injectable()
export class TrPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Sayfa başına';
  override nextPageLabel = 'Sonraki sayfa';
  override previousPageLabel = 'Önceki sayfa';
  override firstPageLabel = 'İlk sayfa';
  override lastPageLabel = 'Son sayfa';

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) return '0 / 0';
    const start = page * pageSize + 1;
    const end = Math.min(length, (page + 1) * pageSize);
    return `${start} – ${end} / ${length}`;
  };
}
