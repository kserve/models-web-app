import {
  Component,
  Input,
  TrackByFunction,
  ChangeDetectionStrategy,
} from '@angular/core';
import { UrlItem } from './types';

@Component({
  standalone: false,
  selector: 'lib-urls',
  templateUrl: './urls.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./urls.component.scss'],
})
export class UrlsComponent {
  @Input() urlList: UrlItem[];

  urlTrackByFn: TrackByFunction<UrlItem> = (id: number, url: UrlItem) =>
    url.name;

  constructor() {}
}
