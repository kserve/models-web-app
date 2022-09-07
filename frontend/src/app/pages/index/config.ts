import {
  PropertyValue,
  StatusValue,
  ActionListValue,
  ActionIconValue,
  DateTimeValue,
  DialogConfig,
  TableConfig,
  ComponentValue,
  LinkValue,
  LinkType,
} from 'kubeflow';
import { StorageUriColumnComponent } from 'src/app/shared/storage-uri-column/storage-uri-column.component';
import { getPredictorExtensionSpec } from 'src/app/shared/utils';
import { parseRuntime } from 'src/app/shared/utils';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';

export function generateDeleteConfig(svc: InferenceServiceK8s): DialogConfig {
  return {
    title: $localize`Delete Endpoint ${svc.metadata.name}?`,
    message: $localize`You cannot undo this action. Are you sure you want to delete this Endpoint?`,
    accept: $localize`DELETE`,
    applying: $localize`DELETING`,
    confirmColor: 'warn',
    cancel: $localize`CANCEL`,
  };
}

export const defaultConfig: TableConfig = {
  columns: [
    {
      matHeaderCellDef: $localize`Status`,
      matColumnDef: 'status',
      value: new StatusValue({ field: 'ui.status' }),
      sort: true,
    },
    {
      matHeaderCellDef: $localize`Name`,
      matColumnDef: 'name',
      value: new LinkValue({
        field: 'ui.link',
        popoverField: 'metadata.name',
        truncate: true,
        linkType: LinkType.Internal,
      }),
      sort: true,
    },
    {
      matHeaderCellDef: $localize`Created at`,
      matColumnDef: 'age',
      textAlignment: 'right',
      value: new DateTimeValue({
        field: 'metadata.creationTimestamp',
      }),
      sort: true,
    },
    {
      matHeaderCellDef: $localize`Predictor`,
      matColumnDef: 'predictorType',
      value: new PropertyValue({
        field: 'ui.predictorType',
      }),
      sort: true,
    },
    {
      matHeaderCellDef: $localize`Runtime`,
      matColumnDef: 'runtimeVersion',
      value: new PropertyValue({
        valueFn: parseRuntime,
        popoverField: 'ui.runtimeVersion',
      }),
      sort: true,
    },
    {
      matHeaderCellDef: $localize`Protocol`,
      matColumnDef: 'protocol',
      value: new PropertyValue({
        field: 'ui.protocolVersion',
      }),
      sort: true,
    },
    {
      matHeaderCellDef: $localize`Storage URI`,
      matColumnDef: 'storageUri',
      value: new ComponentValue({
        component: StorageUriColumnComponent,
      }),
      sort: true,
      sortingPreprocessorFn: element => {
        return getPredictorExtensionSpec(element.spec.predictor)?.storageUri;
      },
      filteringPreprocessorFn: element => {
        return getPredictorExtensionSpec(element.spec.predictor)?.storageUri;
      },
    },
    {
      matHeaderCellDef: '',
      matColumnDef: 'actions',
      value: new ActionListValue([
        new ActionIconValue({
          name: 'copy-link',
          tooltip: $localize`Copy endpoint's url`,
          color: 'primary',
          field: 'ui.actions.copy',
          iconReady: 'material:content_copy',
        }),
        new ActionIconValue({
          name: 'delete',
          tooltip: $localize`Delete endpoint`,
          color: '',
          field: 'ui.actions.delete',
          iconReady: 'material:delete',
        }),
      ]),
    },
  ],
};
