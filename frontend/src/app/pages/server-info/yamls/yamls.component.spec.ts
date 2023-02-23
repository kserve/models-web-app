import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AceEditorModule } from '@derekbaker/ngx-ace-editor-wrapper';

import { YamlsComponent } from './yamls.component';

describe('YamlsComponent', () => {
  let component: YamlsComponent;
  let fixture: ComponentFixture<YamlsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [YamlsComponent],
      imports: [CommonModule, AceEditorModule],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(YamlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
