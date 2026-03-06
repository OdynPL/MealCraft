import { Injectable } from '@angular/core';

export type ThemeName = 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray';

export interface ThemePalette {
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
  getPalette(theme: ThemeName): ThemePalette {
    return THEME_PALETTES[theme] || THEME_PALETTES['light'];
  }

  getAllPalettes(): ThemePalette[] {
    return Object.values(THEME_PALETTES);
  }
}
