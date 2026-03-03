import { RoleLabelPipe } from './role-label.pipe';

describe('RoleLabelPipe', () => {
  const pipe = new RoleLabelPipe();

  it('should map admin to Admin', () => {
    expect(pipe.transform('admin')).toBe('Admin');
  });

  it('should map user to User', () => {
    expect(pipe.transform('user')).toBe('User');
  });

  it('should fallback to User for unknown values', () => {
    expect(pipe.transform('something-else')).toBe('User');
    expect(pipe.transform(undefined)).toBe('User');
  });
});
