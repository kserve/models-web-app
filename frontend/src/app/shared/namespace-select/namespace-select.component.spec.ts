import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { NamespaceSelectComponent } from './namespace-select.component';
import { MWANamespaceService } from '../../services/mwa-namespace.service';

describe('NamespaceSelectComponent', () => {
  let component: NamespaceSelectComponent;
  let fixture: ComponentFixture<NamespaceSelectComponent>;
  let mockService: jasmine.SpyObj<MWANamespaceService>;

  beforeEach(waitForAsync(() => {
    mockService = jasmine.createSpyObj('MWANamespaceService', [
      'getNamespaceConfig$',
      'getSelectedNamespace',
      'shouldHideNamespaceSelector',
      'getSelectableNamespaces',
      'initialize',
      'setSelectedNamespace',
    ]);

    // Setup mock returns
    mockService.getNamespaceConfig$.and.returnValue(
      of({
        namespaces: ['ns1', 'ns2'],
        allowedNamespaces: ['ns1', 'ns2'],
        isSingleNamespace: false,
        autoSelectedNamespace: undefined,
      }),
    );
    mockService.getSelectedNamespace.and.returnValue(of('ns1'));
    mockService.shouldHideNamespaceSelector.and.returnValue(of(false));
    mockService.getSelectableNamespaces.and.returnValue(of(['ns1', 'ns2']));
    mockService.initialize.and.returnValue(of('ns1'));

    TestBed.configureTestingModule({
      declarations: [NamespaceSelectComponent],
      imports: [
        MatSelectModule,
        MatFormFieldModule,
        MatIconModule,
        NoopAnimationsModule,
      ],
      providers: [{ provide: MWANamespaceService, useValue: mockService }],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NamespaceSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize service on ngOnInit', () => {
    expect(mockService.initialize).toHaveBeenCalled();
  });

  it('should call setSelectedNamespace when namespace changes', () => {
    component.onNamespaceChange('ns2');
    expect(mockService.setSelectedNamespace).toHaveBeenCalledWith('ns2');
  });

  it('should track namespaces by value', () => {
    const result = component.trackByNamespace(0, 'test-namespace');
    expect(result).toBe('test-namespace');
  });
});
