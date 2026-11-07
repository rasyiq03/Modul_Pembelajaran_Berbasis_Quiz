/* Dipakai server (app/layout.tsx) dan klien (lib/theme.ts), jadi sengaja tanpa 'use client' */
export const THEME_KEY = 'cognify-theme';

/** Dijalankan inline di <head> sebelum halaman tampil, agar tidak ada kedipan tema yang salah */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
