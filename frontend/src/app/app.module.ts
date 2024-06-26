import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

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
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
