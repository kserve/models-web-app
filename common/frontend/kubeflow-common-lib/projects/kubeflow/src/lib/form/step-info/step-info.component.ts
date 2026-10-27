import {
  Component,
  OnInit,
  Input,
  HostBinding,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-step-info',
  templateUrl: './step-info.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./step-info.component.scss'],
})
export class StepInfoComponent implements OnInit {
  @Input() header: string;
  @HostBinding('class.lib-step-info') selfClass = true;

  constructor() {}

  ngOnInit() {}
}
