import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-panel',
  templateUrl: './panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./panel.component.scss'],
})
export class PanelComponent {
  @Input() icon = 'info';
  @Input() color = 'primary';
  @Input() message: string;
}
