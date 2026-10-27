import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { STATUS_TYPE, Status } from '../resource-table/status/types';

@Component({
  standalone: false,
  selector: 'lib-status-info',
  templateUrl: './status-info.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./status-info.component.scss'],
})
export class StatusInfoComponent {
  @Input() status: Status;

  STATUS_TYPE = STATUS_TYPE;
}
