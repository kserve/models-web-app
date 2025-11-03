import { Component, Input } from '@angular/core';
import { ChipDescriptor } from 'kubeflow';
import { ExplainerSpec } from 'src/app/types/kfserving/v1beta1';
import { getExplainerContainer } from 'src/app/shared/utils';

@Component({
  selector: 'app-explainer-details',
  templateUrl: './explainer.component.html',
})
export class ExplainerComponent {
  public config: ChipDescriptor[];

  @Input()
  set explainerSpec(spec: ExplainerSpec) {
    this.explainerPrv = spec;
    this.config = this.generateConfig(spec);
  }
  get explainerSpec(): ExplainerSpec {
    return this.explainerPrv;
  }

  private explainerPrv: ExplainerSpec;

  private generateConfig(spec: ExplainerSpec): ChipDescriptor[] {
    const chips = [];

    const config = spec?.alibi?.config;
    if (!config) {
      return chips;
    }

    for (const key in config) {
      if (!Object.prototype.hasOwnProperty.call(config, key)) {
        continue;
      }

      const val = config[key];
      chips.push({
        name: key,
        value: val,
        color: 'primary',
      });
    }

    return chips;
  }

  get container() {
    return getExplainerContainer(this.explainerSpec);
  }
}
