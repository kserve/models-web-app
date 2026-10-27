import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { V1PodSpec } from '@kubernetes/client-node';

@Component({
  standalone: false,
  selector: 'app-pod-details',
  templateUrl: './pod.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./pod.component.scss'],
})
export class PodComponent {
  @Input() pod: V1PodSpec;
}
