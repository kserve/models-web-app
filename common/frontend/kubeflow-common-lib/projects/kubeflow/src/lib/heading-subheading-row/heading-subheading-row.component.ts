import {
  Component,
  Input,
  HostBinding,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-heading-row',
  templateUrl: './heading-subheading-row.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./heading-subheading-row.component.scss'],
})
export class HeadingSubheadingRowComponent {
  @Input() heading: string;
  @Input() subHeading: string;
  @Input() tooltip: string;

  @HostBinding('class.lib-heading-row') selfClass = true;
}
