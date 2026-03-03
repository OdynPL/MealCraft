import { ActivityStatusColorPipe } from './activity-status-color.pipe';

describe('ActivityStatusColorPipe', () => {
  const pipe = new ActivityStatusColorPipe();

  it('should map success status', () => {
    expect(pipe.transform('success')).toBe('log-status-success');
    expect(pipe.transform(' SUCCESS ')).toBe('log-status-success');
  });

  it('should map info status', () => {
    expect(pipe.transform('info')).toBe('log-status-info');
  });

  it('should map warning status', () => {
    expect(pipe.transform('warning')).toBe('log-status-warning');
  });

  it('should map error status', () => {
    expect(pipe.transform('error')).toBe('log-status-error');
  });

  it('should return empty string for unknown status', () => {
    expect(pipe.transform('other')).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
