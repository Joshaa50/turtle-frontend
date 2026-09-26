import { describe, it, expect } from 'vitest';
import { parseCsv, parseNestCsv, normaliseDate, importTemplateCsv } from '../lib/csvImport';

const HEAD = 'nest_code,beach,date_found,gps_lat,gps_long,distance_to_sea_s,depth_top_egg_h';
const ROW = 'LG2-1,Loggos 2,2024-06-01,38.17,20.54,14,41';
const BEACHES = ['Loggos 2', 'Xi'];

describe('parseCsv', () => {
  it('keeps a comma inside a quoted cell instead of shifting every column after it', () => {
    const rows = parseCsv('a,b,c\n1,"hello, world",3');
    expect(rows[1]).toEqual(['1', 'hello, world', '3']);
  });

  it('handles an escaped quote', () => {
    expect(parseCsv('a\n"she said ""no"""')[1]).toEqual(['she said "no"']);
  });

  it('keeps a newline inside a quoted cell', () => {
    const rows = parseCsv('a,b\n1,"line one\nline two"');
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe('line one\nline two');
  });

  it('strips the BOM Excel writes, which would stop the first header matching', () => {
    expect(parseCsv('﻿nest_code,beach\nA,B')[0][0]).toBe('nest_code');
  });

  it('ignores blank lines and trailing newlines', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toHaveLength(2);
  });
});

describe('normaliseDate', () => {
  it('accepts ISO', () => expect(normaliseDate('2024-06-01')).toBe('2024-06-01'));
  it('accepts DD/MM/YYYY, which is what a European field spreadsheet holds', () => {
    expect(normaliseDate('01/06/2024')).toBe('2024-06-01');
  });
  it('pads single digits', () => expect(normaliseDate('1/6/2024')).toBe('2024-06-01'));
  it.each(['', 'yesterday', '2024/13/01', '32/01/2024'])('rejects %s rather than guessing', (raw) => {
    expect(normaliseDate(raw)).toBeNull();
  });
});

describe('parseNestCsv', () => {
  it('parses a good row', () => {
    const { rows, issues } = parseNestCsv(`${HEAD}\n${ROW}`, BEACHES);
    expect(issues).toHaveLength(0);
    expect(rows[0]).toMatchObject({ nest_code: 'LG2-1', beach: 'Loggos 2', date_found: '2024-06-01', gps_lat: 38.17 });
  });

  it('names the missing columns instead of failing row by row', () => {
    const { issues, rows } = parseNestCsv('nest_code,beach\nA,Xi', BEACHES);
    expect(rows).toHaveLength(0);
    expect(issues[0].message).toMatch(/missing required columns.*date_found/i);
  });

  it('reports the spreadsheet row number, header counted', () => {
    const { issues } = parseNestCsv(`${HEAD}\n${ROW}\n,Xi,2024-06-01,38.1,20.5,10,40`, BEACHES);
    expect(issues[0].row).toBe(3);
  });

  it('rejects a beach that is not configured rather than inventing one', () => {
    // A typo silently creating "Loggos2" would split a season across two names.
    const { issues, rows } = parseNestCsv(`${HEAD}\nA,Loggos2,2024-06-01,38.1,20.5,10,40`, BEACHES);
    expect(rows).toHaveLength(0);
    expect(issues[0].message).toMatch(/not one of your beaches/i);
  });

  it('matches a configured beach case-insensitively and stores the configured spelling', () => {
    const { rows } = parseNestCsv(`${HEAD}\nA,loggos 2,2024-06-01,38.1,20.5,10,40`, BEACHES);
    expect(rows[0].beach).toBe('Loggos 2');
  });

  it('catches a nest code repeated within the file', () => {
    const { issues, rows } = parseNestCsv(`${HEAD}\n${ROW}\n${ROW}`, BEACHES);
    expect(rows).toHaveLength(1);
    expect(issues[0].message).toMatch(/more than once/i);
  });

  it('rejects a non-numeric measurement rather than importing it as zero', () => {
    const { issues, rows } = parseNestCsv(`${HEAD}\nA,Xi,2024-06-01,38.1,20.5,about ten,40`, BEACHES);
    expect(rows).toHaveLength(0);
    expect(issues[0].field).toBe('distance_to_sea_s');
  });

  it('keeps good rows when another row is bad, so one typo does not block the file', () => {
    const { rows, issues } = parseNestCsv(`${HEAD}\n${ROW}\nBAD,Xi,nonsense,38.1,20.5,10,40`, BEACHES);
    expect(rows).toHaveLength(1);
    expect(issues).toHaveLength(1);
  });

  it('flags columns it does not understand instead of dropping them silently', () => {
    const { unknownColumns } = parseNestCsv(`${HEAD},observer\n${ROW},Elena`, BEACHES);
    expect(unknownColumns).toEqual(['observer']);
  });

  it('treats an absent optional value as absent, not as zero', () => {
    const { rows } = parseNestCsv(`${HEAD},total_num_eggs\n${ROW},`, BEACHES);
    expect(rows[0].total_num_eggs).toBeUndefined();
  });

  it('reports an empty file plainly', () => {
    expect(parseNestCsv('', BEACHES).issues[0].message).toMatch(/empty/i);
  });
});

describe('importTemplateCsv', () => {
  it('lists every column the importer reads', () => {
    const header = importTemplateCsv().trim();
    expect(header).toContain('nest_code');
    expect(header).toContain('notes');
    // A template that parses as empty rather than as a broken file.
    expect(parseNestCsv(importTemplateCsv(), BEACHES).rows).toHaveLength(0);
  });
});
