import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { StatusValue } from '../types';

@Component({
  standalone: false,
  selector: 'lib-status',
  templateUrl: './status.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./status.component.scss'],
})
export class StatusComponent {
  @Input() row: any;
  @Input() config: StatusValue;
}
