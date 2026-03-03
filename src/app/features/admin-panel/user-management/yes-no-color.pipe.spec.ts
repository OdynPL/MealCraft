import { YesNoColorPipe } from './yes-no-color.pipe';

describe('YesNoColorPipe', () => {
  const pipe = new YesNoColorPipe();

  it('should map yes to yes-no-yes', () => {
    expect(pipe.transform('yes')).toBe('yes-no-yes');
    expect(pipe.transform(' YES ')).toBe('yes-no-yes');
  });

  it('should map no to yes-no-no', () => {
    expect(pipe.transform('no')).toBe('yes-no-no');
  });

  it('should return empty string for unknown values', () => {
    expect(pipe.transform('maybe')).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
