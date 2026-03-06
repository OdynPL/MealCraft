import { Injectable } from '@angular/core';

export type ThemeName = 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray';

interface ThemePalette {
  name: ThemeName;
  background: string;
  foreground: string;
  accent: string;
  header: string;
  headerText: string;
}

const THEME_PALETTES: Record<ThemeName, ThemePalette> = {
    gray: {
      name: 'gray',
      background: '#34373b',
      foreground: '#f4f5f7',
      accent: '#7a7d85',
      header: '#23272b',
      headerText: '#f4f5f7'
    },
  light: {
    name: 'light',
    background: '#fff',
    foreground: '#222',
    accent: '#007bff',
    header: '#f8f9fa',
    headerText: '#222'
  },
  blue: {
    name: 'blue',
    background: '#e3f0ff',
    foreground: '#0d223a',
    accent: '#007bff',
    header: '#0056b3',
    headerText: '#fff'
  },
  green: {
    name: 'green',
    background: '#e6f9ed',
    foreground: '#1b3d2f',
    accent: '#28a745',
    header: '#218838',
    headerText: '#fff'
  },
  red: {
    name: 'red',
    background: '#ffeaea',
    foreground: '#3a1a1a',
    accent: '#dc3545',
    header: '#b21f2d',
    headerText: '#fff'
  },
  purple: {
    name: 'purple',
    background: '#f3e6ff',
    foreground: '#2d1a3a',
    accent: '#6f42c1',
    header: '#4b286d',
    headerText: '#fff'
  },
  orange: {
    name: 'orange',
    background: '#fff4e6',
    foreground: '#3a2a1a',
    accent: '#fd7e14',
    header: '#c75c00',
    headerText: '#fff'
  },
  teal: {
    name: 'teal',
    background: '#e6fcfa',
    foreground: '#1a3a3a',
    accent: '#20c997',
    header: '#13896b',
    headerText: '#fff'
  }
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
      /**
       * Applies the theme class to the document body, removing all previous theme classes.
       */
      public applyTheme(theme: ThemeName): void {
        const allThemes = this.getAllPalettes().map(p => `theme-${p.name}`);
        document.body.classList.remove(...allThemes);
        document.body.classList.add(`theme-${theme}`);
      }
    /**
     * Returns the valid theme for a user, checking localStorage and user.theme.
     * @param user The user object (should have id and theme fields)
     */
    public resolveUserTheme(user: { id?: string | number; theme?: string } | null): ThemeName {
      if (!user) return 'light';
      try {
        const userId = user.id != null ? String(user.id) : '';
        const stored = (localStorage.getItem('food-explorer.user-theme-' + userId) ?? '') as string;
        if (this.getAllPalettes().some(p => p.name === stored)) {
          return stored as ThemeName;
        } else if (this.getAllPalettes().some(p => p.name === user.theme)) {
          return (user.theme ?? 'light') as ThemeName;
        }
      } catch { /* ignore */ }
      return 'light';
    }
  getPalette(theme: ThemeName): ThemePalette {
    return THEME_PALETTES[theme] || THEME_PALETTES['light'];
  }

  getAllPalettes(): ThemePalette[] {
    return Object.values(THEME_PALETTES);
  }
}
