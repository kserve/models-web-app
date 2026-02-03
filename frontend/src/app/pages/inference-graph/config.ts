import {
  PropertyValue,
  StatusValue,
  DialogConfig,
  TableConfig,
  LinkValue,
  LinkType,
} from 'kubeflow';
import { InferenceGraphK8s } from 'src/app/types/kfserving/v1alpha1';

export function generateDeleteConfig(
  inferenceGraph: InferenceGraphK8s,
): DialogConfig {
  return {
    title: $localize`Delete InferenceGraph ${inferenceGraph.metadata.name}?`,
    message: $localize`You cannot undo this action. Are you sure you want to delete this InferenceGraph?`,
    accept: $localize`DELETE`,
    applying: $localize`DELETING`,
    confirmColor: 'warn',
    cancel: $localize`CANCEL`,
  };
}

export const defaultConfig: TableConfig = {
  dynamicNamespaceColumn: true,
  columns: [
    {
      matHeaderCellDef: $localize`Status`,
      matColumnDef: 'status',
      value: new StatusValue({ field: 'ui.status' }),
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
    },
    {
      matHeaderCellDef: $localize`Router Type`,
      matColumnDef: 'routerType',
      value: new PropertyValue({
        field: 'ui.routerType',
      }),
    },
    {
      matHeaderCellDef: $localize`Node Count`,
      matColumnDef: 'nodeCount',
      value: new PropertyValue({
        field: 'ui.nodeCount',
      }),
    },
  ],
};
