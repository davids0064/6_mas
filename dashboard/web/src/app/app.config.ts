import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

// Sin esto, DatePipe formatea en inglés ("15 de August") aunque el texto de
// la app esté en español. Se registra es-CO por ser el mercado inicial:
// nombres de mes y día en español y formato de fecha local.
registerLocaleData(localeEsCO);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    provideRouter(
      routes,
      // Al cambiar de sección el scroll vuelve arriba; sin esto se navega a
      // otra pantalla y se aterriza a media página.
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
