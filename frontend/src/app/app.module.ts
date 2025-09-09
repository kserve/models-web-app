import { BrowserModule } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { configureAce } from './ace-config';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { IndexModule } from './pages/index/index.module';
import { KubeflowModule } from 'kubeflow';
import { ServerInfoModule } from './pages/server-info/server-info.module';
import { SubmitFormModule } from './pages/submit-form/submit-form.module';
import {
  MatSnackBarConfig,
  MAT_SNACK_BAR_DEFAULT_OPTIONS,
} from '@angular/material/snack-bar';
import { ConfigService } from './services/config.service';
import { take, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * MAT_SNACK_BAR_DEFAULT_OPTIONS values can be found
 * here
 * https://github.com/angular/components/blob/main/src/material/snack-bar/snack-bar-config.ts#L25-L58
 */
const MwaSnackBarConfig: MatSnackBarConfig = {
  duration: 5000,
};

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    IndexModule,
    KubeflowModule,
    ServerInfoModule,
    SubmitFormModule,
  ],
  providers: [
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: MwaSnackBarConfig },
    {
      provide: APP_INITIALIZER,
      useFactory: () => configureAce,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: ConfigService) => () =>
        configService
          .getConfig()
          .pipe(
            take(1),
            catchError(error => {
              console.warn(
                'Configuration loading failed during app initialization, using defaults:',
                error,
              );
              return of(null);
            }),
          )
          .toPromise(),
      deps: [ConfigService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
