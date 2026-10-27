import {
  Component,
  Input,
  EventEmitter,
  Output,
  HostBinding,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ToolbarButton } from './types';

@Component({
  standalone: false,
  selector: 'lib-title-actions-toolbar',
  templateUrl: './title-actions-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./title-actions-toolbar.component.scss'],
})
export class TitleActionsToolbarComponent {
  @Input() buttons: ToolbarButton[] = [];
  @Input() backButton = false;
  @Input() title: string;
  @Output() back = new EventEmitter();
  @HostBinding('class.lib-title-actions-toolbar') selfClass = true;

  emitBack() {
    this.back.emit('backButton');
  }
}
