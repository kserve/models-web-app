import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-form-section',
  templateUrl: './section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./section.component.scss'],
})
export class FormSectionComponent implements OnInit {
  @Input()
  title: string;

  @Input()
  text: string;

  @Input()
  readOnly: string;

  @Input()
  style: string;

  @Input()
  icon: string;

  @Input()
  helpText: string;

  constructor() {}

  ngOnInit() {}
}
