import {
  Component,
  OnInit,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'lib-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./loading-spinner.component.scss'],
})
export class LoadingSpinnerComponent implements AfterViewInit {
  @Input() diameter = 32;
  @Input()
  message: string;
  @ViewChild('spinnerWrapper')
  wrapper: ElementRef;

  public height = `${this.diameter}px`;
  public initialized = false;

  ngAfterViewInit() {
    if (!this.wrapper) {
      return;
    }

    setTimeout(() => {
      const offset = this.wrapper.nativeElement.getBoundingClientRect().top;
      this.height = `calc(100vh - ${offset}px)`;

      this.initialized = true;
    });
  }
}
