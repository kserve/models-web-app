import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  Input,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-submit-bar',
  templateUrl: './submit-bar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./submit-bar.component.scss'],
})
export class SubmitBarComponent implements OnInit {
  @Input() createDisabled = false;
  @Input() allowYAMLEditing = true;
  @Input() isApplying = false;
  @Output() create = new EventEmitter<boolean>();
  @Output() cancel = new EventEmitter<boolean>();
  @Output() yaml = new EventEmitter<boolean>();

  constructor() {}

  ngOnInit() {}
}
