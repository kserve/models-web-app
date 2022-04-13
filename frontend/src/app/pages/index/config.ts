import {
  PropertyValue,
  StatusValue,
  ActionListValue,
  ActionIconValue,
  ActionButtonValue,
  MenuValue,
  DateTimeValue,
  DialogConfig,
  TableConfig,
} from 'kubeflow';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { parseRuntime } from './utils';

export function generateDeleteConfig(svc: InferenceServiceK8s): DialogConfig {
  return {
    title: $localize`Delete Model server? ${svc.metadata.name}`,
    message: $localize`You cannot undo this action. Are you sure you want to delete this Model server?`,
    accept: $localize`DELETE`,
    applying: $localize`DELETING`,
    confirmColor: 'warn',
    cancel: $localize`CANCEL`,
  };
}

export const defaultConfig: TableConfig = {
  title: $localize`Model Servers`,
  newButtonText: $localize`NEW MODEL SERVER`,
  columns: [
    {
      matHeaderCellDef: $localize`Status`,
      matColumnDef: 'status',
      value: new StatusValue({ field: 'ui.status' }),
    },
    {
      matHeaderCellDef: $localize`Name`,
      matColumnDef: 'name',
      value: new PropertyValue({
        field: 'metadata.name',
        truncate: true,
        popoverField: 'metadata.name',
        isLink: true,
      }),
    },
    {
      matHeaderCellDef: $localize`Age`,
      matColumnDef: 'age',
      value: new DateTimeValue({
        field: 'metadata.creationTimestamp',
      }),
    },
    {
      matHeaderCellDef: $localize`Predictor`,
      matColumnDef: 'predictorType',
      value: new PropertyValue({
        field: 'ui.predictorType',
      }),
    },
    {
      matHeaderCellDef: $localize`Runtime`,
      matColumnDef: 'runtimeVersion',
      value: new PropertyValue({
        field: 'ui.runtimeVersion',
      }),
    },
    {
      matHeaderCellDef: $localize`Protocol`,
      matColumnDef: 'protocol',
      value: new PropertyValue({
        field: 'ui.protocolVersion',
      }),
      // minWidth: '40px',
    },
    {
      matHeaderCellDef: $localize`Storage URI`,
      matColumnDef: 'storageUri',
      value: new PropertyValue({
        field: 'ui.storageUri',
        truncate: true,
        popoverField: 'ui.storageUri',
      }),
    },
    {
      matHeaderCellDef: '',
      matColumnDef: 'actions',
      value: new ActionListValue([
        new ActionIconValue({
          name: 'copy-link',
          tooltip: $localize`Copy the server's endpoint`,
          color: 'primary',
          field: 'ui.actions.copy',
          iconReady: 'material:content_copy',
        }),
        new ActionIconValue({
          name: 'delete',
          tooltip: $localize`Delete Server`,
          color: '',
          field: 'ui.actions.delete',
          iconReady: 'material:delete',
        }),
      ]),
    },
  ],
};
