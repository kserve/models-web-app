import {
  Component,
  Inject,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { SnackType } from '../types';

@Component({
  standalone: false,
  selector: 'lib-snack-bar',
  templateUrl: './snack-bar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./snack-bar.component.scss'],
})
export class SnackBarComponent {
  constructor(
    public snackBarRef: MatSnackBarRef<SnackBarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: any,
  ) {}

  get icon() {
    switch (this.data.snackType) {
      case SnackType.Success:
        return 'done';
      case SnackType.Error:
        return 'clear';
      case SnackType.Warning:
        return 'warning';
      case SnackType.Info:
        return 'info';
      default:
        return 'warning';
    }
  }

  dismiss() {
    this.snackBarRef.dismiss();
  }
}
