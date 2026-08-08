import { parseSettingsText, tenantSettingsFormSchema } from './schemas';

describe('tenantSettingsFormSchema', () => {
  it('accepts a non-empty name', () => {
    expect(tenantSettingsFormSchema.shape.name.parse('Acme')).toBe('Acme');
  });

  it('rejects a blank name', () => {
    expect(() => tenantSettingsFormSchema.shape.name.parse('')).toThrow();
  });

  it('rejects a whitespace-only name', () => {
    expect(() => tenantSettingsFormSchema.shape.name.parse('   ')).toThrow();
  });

  it('trims surrounding whitespace', () => {
    expect(tenantSettingsFormSchema.shape.name.parse('  Acme  ')).toBe('Acme');
  });
});

describe('parseSettingsText', () => {
  it('omits settings for blank text', () => {
    expect(parseSettingsText('')).toEqual({});
    expect(parseSettingsText('   ')).toEqual({});
  });

  it('parses a valid JSON object', () => {
    expect(parseSettingsText('{"plan": "pro"}')).toEqual({ settings: { plan: 'pro' } });
  });

  it('rejects invalid JSON', () => {
    expect(parseSettingsText('{not-json')).toEqual({ error: 'Settings must be valid JSON' });
  });

  it('rejects non-object JSON (array, primitive, null)', () => {
    expect(parseSettingsText('[1,2,3]')).toEqual({ error: 'Settings must be a JSON object' });
    expect(parseSettingsText('"just a string"')).toEqual({
      error: 'Settings must be a JSON object',
    });
    expect(parseSettingsText('null')).toEqual({ error: 'Settings must be a JSON object' });
  });
});
