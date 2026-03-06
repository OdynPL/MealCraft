import { Injectable, inject } from '@angular/core';
import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private config = inject(ConfigurationService);

  validateAvatar(file: File): string | null {
    if (!file.type.startsWith('image/')) {
      return 'Only image files are allowed.';
    }
    if (file.size > this.config.authMaxAvatarSizeBytes) {
      return 'Image is too large. Maximum size is 2 MB.';
    }
    return null;
  }

  async readAvatarFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '').trim();
        if (!result.startsWith('data:image/')) {
          resolve(null);
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
}
