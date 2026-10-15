import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { VariablesGroup } from './types';

@Component({
  standalone: false,
  selector: 'lib-variables-group-table',
  templateUrl: './variables-groups-table.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./variables-groups-table.component.scss'],
})
export class VariablesGroupsTableComponent implements OnInit {
  private prvEnvGroups: VariablesGroup[];
  @Input()
  set envGroups(groups: VariablesGroup[]) {
    this.prvEnvGroups = groups;
  }
  get envGroups() {
    return this.prvEnvGroups;
  }
  @Input() loadErrorMsg = 'Resources not available';
  @Input() loadCompleted = false;

  envGroupsEmpty(): boolean {
    return this.envGroups?.length === 0;
  }

  constructor() {}

  ngOnInit(): void {}
}
