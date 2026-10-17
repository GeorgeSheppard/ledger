import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from './parse';

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, embedded newlines and CRLF', () => {
    const text = 'a,"b, c","say ""hi"""\r\n1,"two\nlines",3\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', 'two\nlines', '3'],
    ]);
  });

  it('strips a BOM, trims cells and drops empty rows', () => {
    expect(parseCsv('﻿Date , Amount\n\n,\n 2026-01-02 , 5 \n')).toEqual([
      ['Date', 'Amount'],
      ['2026-01-02', '5'],
    ]);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(detectDelimiter('Datum;Betrag;"a,b"\n')).toBe(';');
    expect(detectDelimiter('Date\tAmount\n')).toBe('\t');
    expect(parseCsv('Datum;Betrag\n01.02.2026;-1,50')).toEqual([
      ['Datum', 'Betrag'],
      ['01.02.2026', '-1,50'],
    ]);
  });

  it('keeps a final row without a trailing newline and empty trailing cells', () => {
    expect(parseCsv('a,b,\n1,2,')).toEqual([
      ['a', 'b', ''],
      ['1', '2', ''],
    ]);
  });
});
