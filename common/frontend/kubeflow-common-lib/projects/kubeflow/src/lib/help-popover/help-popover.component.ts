import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-help-popover',
  templateUrl: './help-popover.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./help-popover.component.scss'],
})
export class HelpPopoverComponent implements OnInit {
  @Input() popoverPosition = 'below';

  @Input()
  showStatus: boolean;

  @Input()
  showDate: boolean;

  constructor() {}

  ngOnInit(): void {}
}
