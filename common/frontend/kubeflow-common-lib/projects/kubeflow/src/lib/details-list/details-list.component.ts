import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ListEntry } from './types';

@Component({
  standalone: false,
  selector: 'lib-details-list',
  templateUrl: './details-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./details-list.component.scss'],
})
export class DetailsListComponent {
  @Input() entries: ListEntry[] = [];
  @Input() topDivider = true;

  @Input() title: string;
}
