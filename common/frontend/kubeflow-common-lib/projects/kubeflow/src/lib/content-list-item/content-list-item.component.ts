import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-content-list-item',
  templateUrl: './content-list-item.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./content-list-item.component.scss'],
})
export class ContentListItemComponent implements OnInit {
  @Input() key: string;
  @Input() keyTooltip: string;
  @Input() topDivider = false;
  @Input() bottomDivider = true;
  @Input() keyMinWidth = '250px';
  @Input() loadErrorMsg = 'Resources not available';

  constructor() {}

  ngOnInit(): void {}
}
