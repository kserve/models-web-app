import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { getNameError, MAX_NAME_LENGTH } from '../validators';

@Component({
  standalone: false,
  selector: 'lib-form-name-namespace-inputs',
  templateUrl: './name-namespace-inputs.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./name-namespace-inputs.component.scss'],
})
export class NameNamespaceInputsComponent implements OnInit {
  private existingNamesPrv: Set<string>;

  @Input()
  nameControl: AbstractControl;

  @Input()
  namespaceControl: AbstractControl;

  @Input()
  resourceName: string;

  @Input()
  maxLength = MAX_NAME_LENGTH;

  @Input()
  existingNames: Set<string>;

  constructor() {}

  ngOnInit() {}
}
