import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { load, dump } from 'js-yaml';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';

@Component({
  standalone: false,
  selector: 'app-yamls',
  templateUrl: './yamls.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./yamls.component.scss'],
})
export class YamlsComponent {
  @Input() inferenceService: InferenceServiceK8s;

  get data() {
    if (!this.inferenceService) {
      return 'No data has been found...';
    }

    return dump(this.inferenceService);
  }
}
