#!/usr/bin/env bash

# strict mode http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source ${SCRIPT_DIR}/variables.sh

# Apply a wide set of InferenceServices to help test the app
cd ${KSERVE_DIR}
kubectl apply -f docs/samples/v1beta1/sklearn/v1/sklearn.yaml
kubectl apply -f docs/samples/v1beta1/tensorflow/tensorflow.yaml
kubectl apply -f docs/samples/v1beta1/transformer/torchserve_image_transformer/transformer.yaml
kubectl apply -f docs/samples/v1beta1/custom/paddleserving/paddleserving-custom.yaml
kubectl apply -f docs/samples/v1beta1/xgboost/xgboost.yaml
