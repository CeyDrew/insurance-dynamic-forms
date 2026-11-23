import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { formatAmount, parseAmount } from '../fields/currency-input.directive';
import { FieldDefinition } from '../model';
import { TrDateAdapter } from './tr-date-adapter';
import { errorMessage, fieldValidators } from './validators';

describe('money input', () => {
  it.each([
    ['1250000', 1250000],
    ['1.250.000', 1250000],
    ['1.250.000,50', 1250000.5],
    ['12,5', 12.5],
    [' 1 000 ', 1000],
    ['', null],
  ])('parses %j as %j', (text, value) => {
    expect(parseAmount(text)).toBe(value);
  });

  it.each(['1,250.00', '12.34', 'abc', '1.25.000'])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNaN();
  });

  it('formats with Turkish grouping', () => {
    expect(formatAmount(1250000.5, 2)).toBe('1.250.000,5');
    expect(formatAmount(null, 2)).toBe('');
  });
});

describe('TrDateAdapter', () => {
  const adapter = TestBed.runInInjectionContext(() => new TrDateAdapter());

  it('reads day-first dates', () => {
    expect(adapter.parse('03.04.2026')).toEqual(new Date(2026, 3, 3));
    expect(adapter.parse('3/4/2026')).toEqual(new Date(2026, 3, 3));
  });

  it('rejects impossible dates and garbage', () => {
    expect(adapter.isValid(adapter.parse('31.02.2026')!)).toBe(false);
    expect(adapter.isValid(adapter.parse('yarın')!)).toBe(false);
    expect(adapter.parse('  ')).toBeNull();
  });
});

describe('field validation messages', () => {
  const plate: FieldDefinition = {
    id: 'plate',
    type: 'text',
    label: 'Plaka',
    validators: [
      { type: 'pattern', value: '^[0-9]{2}[A-Z]+[0-9]+$', message: 'Geçersiz plaka' },
      { type: 'maxLength', value: 8 },
    ],
  };

  function check(field: FieldDefinition, value: unknown, required = false) {
    const control = new FormControl(value, fieldValidators(field, () => required, () => '2026-03-15'));
    return errorMessage(field, control);
  }

  it('uses the definition message when there is one', () => {
    expect(check(plate, 'abc')).toBe('Geçersiz plaka');
  });

  it('falls back to a Turkish default', () => {
    expect(check(plate, '34ABCDEF1')).toBe('En fazla 8 karakter olabilir');
    expect(check(plate, null, true)).toBe('Bu alan zorunlu');
  });

  it('leaves empty optional values to the required check', () => {
    expect(check(plate, '')).toBeNull();
    expect(check(plate, null)).toBeNull();
  });

  it('matches patterns against the whole value', () => {
    const digits: FieldDefinition = {
      id: 'd',
      type: 'text',
      label: 'D',
      validators: [{ type: 'pattern', value: '[0-9]{3}' }],
    };
    expect(check(digits, '123')).toBeNull();
    expect(check(digits, '12345')).toBe('Geçersiz biçim');
  });

  it('words repeater limits as rows', () => {
    const drivers: FieldDefinition = {
      id: 'drivers',
      type: 'repeater',
      label: 'Sürücüler',
      fields: [{ id: 'n', type: 'text', label: 'N' }],
      validators: [{ type: 'maxItems', value: 1 }],
    };
    expect(check(drivers, [{}, {}])).toBe('En fazla 1 satır eklenebilir');
    expect(check(drivers, [], true)).toBe('En az bir satır eklenmeli');
  });

  it("compares dates with 'today'", () => {
    const start: FieldDefinition = {
      id: 's',
      type: 'date',
      label: 'S',
      validators: [{ type: 'minDate', value: 'today' }],
    };
    expect(check(start, new Date(2026, 2, 15))).toBeNull();
    expect(check(start, new Date(2026, 2, 14))).toBe('15.03.2026 veya sonrası olmalı');
  });
});
