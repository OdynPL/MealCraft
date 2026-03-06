import { TestBed } from '@angular/core/testing';
import { AvatarService } from './avatar.service';
import { ConfigurationService } from './configuration.service';

describe('AvatarService', () => {
  let service: AvatarService;

  class MockConfig {
    authMaxAvatarSizeBytes = 2 * 1024 * 1024; // 2 MB
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AvatarService,
        { provide: ConfigurationService, useClass: MockConfig }
      ]
    });
    service = TestBed.inject(AvatarService);
  });

  function createFile({ type = 'image/png', size = 1000 } = {}): File {
    // Mock File: only type and size are used by service
    return { type, size } as File;
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should accept valid image file', () => {
    const file = createFile({ type: 'image/jpeg', size: 1000 });
    expect(service.validateAvatar(file)).toBeNull();
  });

  it('should reject non-image file', () => {
    const file = createFile({ type: 'application/pdf', size: 1000 });
    expect(service.validateAvatar(file)).toContain('Only image files');
  });

  it('should reject too large image', () => {
    const file = createFile({ type: 'image/png', size: 3 * 1024 * 1024 });
    expect(service.validateAvatar(file)).toContain('too large');
  });

  it('should resolve null for non-image data in readAvatarFile', async () => {
    // Mock FileReader
    const file = createFile();
    const originalFileReader = (globalThis as any).FileReader;
    (globalThis as any).FileReader = class {
      onload: any; onerror: any;
      readAsDataURL() { this.onload({ target: { result: 'data:application/pdf;base64,xxx' } }); }
    };
    const result = await service.readAvatarFile(file);
    expect(result).toBeNull();
    (globalThis as any).FileReader = originalFileReader;
  });

  it('should resolve base64 string for valid image in readAvatarFile', async () => {
    const file = createFile();
    const originalFileReader = (globalThis as any).FileReader;
    (globalThis as any).FileReader = class {
      result = 'data:image/png;base64,xxx';
      onload: any; onerror: any;
      readAsDataURL() { this.onload({ target: this }); }
    };
    const result = await service.readAvatarFile(file);
    expect(result).not.toBeNull();
    expect(result?.startsWith('data:image/png')).toBe(true);
    (globalThis as any).FileReader = originalFileReader;
  });
});
